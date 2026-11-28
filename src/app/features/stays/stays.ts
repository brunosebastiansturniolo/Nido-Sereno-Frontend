import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StayService } from '../../services/stay.service';
import { StayResponse, StayRequest, StayFinalizationRequest, CheckInRequest, RetroactiveStayRequest } from '../../models/stay.models';
import { TenantRequest, TenantSearchResponse } from '../../models/tenant.models';
import { ReservationService } from '../../services/reservation.service';
import { ReservationResponse } from '../../models/reservation.models';
import { DepartmentService } from '../../services/department.service';
import { DepartmentResponse } from '../../models/department.models';
import { TenantService } from '../../services/tenant.service';
import { DateControllerService } from '../../services/date-controller.service';
import { AutoFillService } from '../../services/auto-fill.service';
import { ErrorModalComponent } from '../../shared/error-modal/error-modal';
import { addNightsToDate, calculateNightCount } from '../../shared/pricing.utils';
import { debounceTime, distinctUntilChanged, switchMap, tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-stays',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ErrorModalComponent, RouterLink],
  templateUrl: './stays.html',
  styleUrl: './stays.css'
})
export class StaysComponent implements OnInit {
  private stayService = inject(StayService);
  private resService = inject(ReservationService);
  private deptService = inject(DepartmentService);
  private tenantService = inject(TenantService);
  private dateCtrl = inject(DateControllerService);
  private autoFill = inject(AutoFillService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);

  isCheckInView = this.route.snapshot.data['view'] === 'check-in';

  stays: StayResponse[] = [];
  reservations: ReservationResponse[] = [];
  departments: DepartmentResponse[] = [];
  loading = false;
  error = '';
  success = '';
  checkoutStayId: number | null = null;
  showErrorModal = false;
  errorMessage = '';

  get noDepartments(): boolean {
    return this.departments.length === 0;
  }

  get noReservations(): boolean {
    return this.reservations.length === 0;
  }

  // Modal de justificación de fecha
  showJustificationModal = false;
  justificationContext = ''; // 'checkIn' | 'checkout'
  justificationMessage = '';
  justificationComment = '';
  justificationError = '';
  // Datos temporales para procesar después del modal
  pendingCheckInRequest: CheckInRequest | null = null;
  showCheckoutPaymentReminder = false;
  showCheckoutClassificationReminder = false;
  pendingCheckoutStayId: number | null = null;
  pendingCheckoutRequest: StayFinalizationRequest | null = null;
  checkoutPaymentAmount: number | null = 0;
  checkoutDebtComment = '';
  checkoutPaymentError = '';

  // Mapa de inquilinos encontrados por DNI, claveado por índice de tenant
  // Ej: { 0: TenantSearchResponse, 2: TenantSearchResponse }
  foundTenants: { [key: number]: TenantSearchResponse } = {};
  searchingTenants: { [key: number]: boolean } = {};

  // Mode: 'express' = check-in express, 'existing' = check-in desde reserva, 'retroactive' = cargar historial
  checkInMode = 'express';

  expressForm!: FormGroup;
  existingForm!: FormGroup;
  retroactiveForm!: FormGroup;
  checkoutForm!: FormGroup;

  // Reserva seleccionada para check-in desde reserva existente
  selectedReservation: ReservationResponse | null = null;
  
  // Checkbox para usar el reservante como inquilino
  useReservanteAsTenant = false;
  showTenantCountConfirmation = false;
  tenantCountDialogReservationCount = 0;
  tenantCountDialogProposedCount = 0;
  pendingTenantCountAction: { type: 'add' } | { type: 'remove'; index: number } | null = null;

  // Variables para cálculo de precio en express
  selectedDepartmentPrice: number | null = null;
  calculatedNights: number | null = null;
  calculatedTotal: number | null = null;
  
  // Variables para cálculo de precio en retroactivo
  retroactiveSelectedDepartmentPrice: number | null = null;
  retroactiveCalculatedTotal: number | null = null;

  ngOnInit(): void {
    this.loadStays();
    this.loadReservations();
    this.loadDepartments();

    this.expressForm = this.fb.group({
      departmentId: [null, [Validators.required]],
      fechaHoraCheckInReal: [this.dateCtrl.getDateTimeStr()],
      fechaCheckOutPlaneada: ['', [Validators.required]],
      horaCheckOutPlaneada: [''],
      cantidadPersonas: [1, [Validators.required, Validators.min(1)]],
      cantidadVehiculos: [0, [Validators.min(0)]],
      precioTotal: [null, [Validators.required, Validators.min(0.01)]],
      comentariosCheckIn: [''],
      tenants: this.fb.array([this.createTenant()])
    }, { validators: this.expressSameDayCheckOutValidator() });

    // Calcular precio total automáticamente cuando cambian departamento o fechas
    this.expressForm.get('departmentId')?.valueChanges.subscribe(() => this.calculateExpressPricing());
    this.expressForm.get('fechaCheckOutPlaneada')?.valueChanges.subscribe(() => {
      this.updateExpressCheckOutTimeDefault();
      this.calculateExpressPricing();
    });
    this.calculateExpressPricing();

    this.existingForm = this.fb.group({
      reservationId: [null, [Validators.required]],
      fechaHoraCheckInReal: [this.dateCtrl.getDateTimeStr()],
      comentariosCheckIn: [''],
      montoPagadoEnCheckIn: [0, [Validators.min(0)]],
      tenants: this.fb.array([this.createTenant()])
    });

    // Cuando se selecciona una reserva, prellenar datos
    this.existingForm.get('reservationId')?.valueChanges.subscribe((resId: any) => {
      this.onReservationSelected(resId);
    });

    this.retroactiveForm = this.fb.group({
      departmentId: [null, [Validators.required]],
      fechaCheckIn: ['', [Validators.required]],
      fechaCheckOut: ['', [Validators.required]],
      cantidadNoches: [null, [Validators.min(1)]],
      cantidadPersonas: [1, [Validators.required, Validators.min(1)]],
      cantidadVehiculos: [0, [Validators.min(0)]],
      precioTotal: [null],
      montoSenia: [null],
      comentariosCheckIn: [''],
      classificationScore: [null, [Validators.min(1), Validators.max(5)]],
      classificationReviewComment: [''],
      tenants: this.fb.array([this.createTenant()])
    }, { validators: this.checkoutAfterCheckInValidator() });

    // Cuando cambian las fechas del retroactivo, calcular las noches y el precio
    this.retroactiveForm.get('fechaCheckIn')!.valueChanges.subscribe(() => {
      this.calculateRetroactiveNights();
      this.calculateRetroactivePricing();
    });
    this.retroactiveForm.get('fechaCheckOut')!.valueChanges.subscribe(() => {
      this.calculateRetroactiveNights();
      this.calculateRetroactivePricing();
    });
    // Cuando cambia la cantidad de noches, ajustar el check-out y el precio
    this.retroactiveForm.get('cantidadNoches')!.valueChanges.subscribe((nights: number | null) => {
      this.onRetroactiveNightsChange(nights);
      this.calculateRetroactivePricing();
    });
    // Cuando cambia el departamento, recalcular el precio
    this.retroactiveForm.get('departmentId')!.valueChanges.subscribe(() => {
      this.calculateRetroactivePricing();
    });
    this.calculateRetroactivePricing();

    this.checkoutForm = this.fb.group({
      fechaHoraCheckOutReal: [this.dateCtrl.getDateTimeStr()],
      comentariosCheckOut: [''],
      estadoDepartamento: ['GOOD', [Validators.required]],
      classificationScore: [null, [Validators.min(1), Validators.max(5)]],
      classificationReviewComment: ['']
    });

    // Suscribir a la búsqueda por DNI para los tenants iniciales (una sola vez)
    this.subscribeToDocumentSearch(this.expressTenants, 0);
    this.subscribeToDocumentSearch(this.existingTenants, 0);
    this.subscribeToDocumentSearch(this.retroactiveTenants, 0);
  }

  createTenant(): FormGroup {
    return this.fb.group({
      documentNumber: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(20)]],
      firstName: ['', [Validators.required, Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
      phoneNumber: ['', [Validators.required, Validators.maxLength(30)]],
      dateOfBirth: ['', { validators: [Validators.maxLength(10)], asyncValidators: [this.dateNotInFuture()] }]
    });
  }

  /**
   * Validador: la fecha de nacimiento no puede ser posterior a la fecha actual.
   */
  dateNotInFuture(): (control: AbstractControl) => Promise<ValidationErrors | null> {
    return (control: AbstractControl): Promise<ValidationErrors | null> => {
      return Promise.resolve(
        (() => {
          const value = control.value;
          if (!value) return null;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const birthDate = new Date(value);
          if (birthDate > today) {
            return { dateInFuture: true };
          }
          return null;
        })()
      );
    };
  }

  get expressTenants(): FormArray {
    return this.expressForm.get('tenants') as FormArray;
  }

  get existingTenants(): FormArray {
    return this.existingForm.get('tenants') as FormArray;
  }

  get retroactiveTenants(): FormArray {
    return this.retroactiveForm.get('tenants') as FormArray;
  }

  addTenantRetroactive(): void {
    const newIndex = this.retroactiveTenants.length;
    this.retroactiveTenants.push(this.createTenant());
    this.subscribeToDocumentSearch(this.retroactiveTenants, newIndex);
  }

  removeTenantRetroactive(index: number): void {
    if (this.retroactiveTenants.length > 1) {
      delete this.foundTenants[index];
      delete this.searchingTenants[index];
      this.retroactiveTenants.removeAt(index);
    }
  }

  addTenantExpress(): void {
    const newIndex = this.expressTenants.length;
    this.expressTenants.push(this.createTenant());
    this.subscribeToDocumentSearch(this.expressTenants, newIndex);
  }

  removeTenantExpress(index: number): void {
    if (this.expressTenants.length > 1) {
      delete this.foundTenants[index];
      delete this.searchingTenants[index];
      this.expressTenants.removeAt(index);
    }
  }

  addTenantExisting(): void {
    if (!this.selectedReservation) {
      this.addTenantExistingForm();
      return;
    }
    this.requestTenantCountChange({ type: 'add' });
  }

  removeTenantExisting(index: number): void {
    if (this.existingTenants.length <= 1) return;
    if (!this.selectedReservation) {
      this.removeTenantExistingForm(index);
      return;
    }
    this.requestTenantCountChange({ type: 'remove', index });
  }

  private addTenantExistingForm(): void {
    const newIndex = this.existingTenants.length;
    this.existingTenants.push(this.createTenant());
    this.subscribeToDocumentSearch(this.existingTenants, newIndex);
  }

  private removeTenantExistingForm(index: number): void {
    delete this.foundTenants[index];
    delete this.searchingTenants[index];
    this.existingTenants.removeAt(index);
  }

  private requestTenantCountChange(action: { type: 'add' } | { type: 'remove'; index: number }): void {
    this.pendingTenantCountAction = action;
    this.tenantCountDialogReservationCount = this.selectedReservation?.cantidadPersonas || 1;
    this.tenantCountDialogProposedCount = this.existingTenants.length + (action.type === 'add' ? 1 : -1);
    this.showTenantCountConfirmation = true;
  }

  confirmTenantCountChange(): void {
    const action = this.pendingTenantCountAction;
    if (!action) return;
    if (action.type === 'add') {
      this.addTenantExistingForm();
    } else {
      this.removeTenantExistingForm(action.index);
    }
    this.closeTenantCountConfirmation();
  }

  closeTenantCountConfirmation(): void {
    this.showTenantCountConfirmation = false;
    this.pendingTenantCountAction = null;
  }

  private setExistingTenantCount(count: number): void {
    const tenantCount = Math.max(1, Math.floor(count || 1));
    this.existingTenants.clear({ emitEvent: false });
    this.foundTenants = {};
    this.searchingTenants = {};
    for (let index = 0; index < tenantCount; index++) {
      this.existingTenants.push(this.createTenant(), { emitEvent: false });
      this.subscribeToDocumentSearch(this.existingTenants, index);
    }
  }

  loadStays(): void {
    this.loading = true;
    this.stayService.getMyStays().subscribe({
      next: (data) => { this.stays = data; this.loading = false; },
      error: (err) => { console.error(err); this.loading = false; }
    });
  }

  loadReservations(): void {
    this.resService.getMyReservations().subscribe({
      next: (data) => {
        this.reservations = data.filter(r =>
          (r.estado === 'PENDING' || r.estado === 'CONFIRMED') && !r.checkInRealizado
        );
      },
      error: (err) => console.error(err)
    });
  }

  loadDepartments(): void {
    this.deptService.getMyDepartments().subscribe({
      next: (data) => {
        this.departments = data;
        if (this.expressForm) this.calculateExpressPricing();
        if (this.retroactiveForm) this.calculateRetroactivePricing();
      },
      error: (err) => console.error(err)
    });
  }

  /**
   * Devuelve la fecha mínima para el check-out express; admite la salida el mismo día.
   */
  getExpressCheckOutMinDate(): string {
    const checkIn = this.expressForm.get('fechaHoraCheckInReal')?.value;
    if (!checkIn) return '';
    return checkIn.slice(0, 10);
  }

  isExpressSameDayCheckOut(): boolean {
    const checkIn = this.expressForm.get('fechaHoraCheckInReal')?.value;
    const checkOut = this.expressForm.get('fechaCheckOutPlaneada')?.value;
    return Boolean(checkIn && checkOut && checkIn.slice(0, 10) === checkOut);
  }

  private updateExpressCheckOutTimeDefault(): void {
    const timeControl = this.expressForm.get('horaCheckOutPlaneada');
    if (this.isExpressSameDayCheckOut()) {
      timeControl?.setValue('10:00', { emitEvent: false });
    } else {
      timeControl?.setValue('', { emitEvent: false });
    }
  }

  private expressSameDayCheckOutValidator(): (control: AbstractControl) => ValidationErrors | null {
    return (control: AbstractControl): ValidationErrors | null => {
      const checkIn = control.get('fechaHoraCheckInReal')?.value;
      const checkOut = control.get('fechaCheckOutPlaneada')?.value;
      if (!checkIn || !checkOut || checkIn.slice(0, 10) !== checkOut) return null;

      const checkOutTime = control.get('horaCheckOutPlaneada')?.value;
      if (!checkOutTime) return { sameDayCheckOutTimeRequired: true };
      if (`${checkOut}T${checkOutTime}` <= checkIn) return { sameDayCheckOutTimeInvalid: true };
      return null;
    };
  }

  /**
   * Calcula el precio total automáticamente para el check-in express.
   * Usa el precioPorNoche del departamento seleccionado y la cantidad de noches.
   */
  calculateExpressPricing(): void {
    const deptId = this.expressForm.get('departmentId')?.value;
    const checkOut = this.expressForm.get('fechaCheckOutPlaneada')?.value;
    const checkIn = this.expressForm.get('fechaHoraCheckInReal')?.value;
    const dept = this.departments.find(d => d.id === Number(deptId));
    this.selectedDepartmentPrice = dept?.precioPorNoche ?? null;
    this.calculatedNights = checkIn && checkOut && checkIn.slice(0, 10) === checkOut
      ? 1
      : calculateNightCount(checkIn, checkOut);
    this.calculatedTotal = this.selectedDepartmentPrice !== null && this.calculatedNights !== null
      ? this.calculatedNights * this.selectedDepartmentPrice
      : null;

    const priceControl = this.expressForm.get('precioTotal');
    if (priceControl?.pristine) {
      priceControl.setValue(this.calculatedTotal, { emitEvent: false });
    }
  }

  onCheckInExpress(): void {
    if (this.expressForm.invalid) {
      this.expressForm.markAllAsTouched();
      return;
    }
    const formValue = this.expressForm.value;
    const department = this.departments.find(item => item.id === Number(formValue.departmentId));
    if (department?.pausado) {
      this.errorMessage = 'El departamento está pausado y no admite nuevos check-in express.';
      this.showErrorModal = true;
      return;
    }

    const request: StayRequest = {
      departmentId: formValue.departmentId,
      fechaHoraCheckInReal: formValue.fechaHoraCheckInReal,
      fechaCheckOutPlaneada: formValue.fechaCheckOutPlaneada,
      fechaHoraCheckOutPlaneada: this.isExpressSameDayCheckOut()
        ? `${formValue.fechaCheckOutPlaneada}T${formValue.horaCheckOutPlaneada}:00`
        : undefined,
      cantidadPersonas: formValue.cantidadPersonas,
      cantidadVehiculos: formValue.cantidadVehiculos,
      precioTotal: formValue.precioTotal,
      montoSenia: formValue.precioTotal,
      comentariosCheckIn: formValue.comentariosCheckIn,
      tenants: formValue.tenants as TenantRequest[]
    };
    this.error = '';
    this.success = '';
    this.stayService.createStay(request).subscribe({
      next: () => {
        this.success = 'Check-in express realizado exitosamente.';
        this.expressForm.reset({
          fechaHoraCheckInReal: this.dateCtrl.getDateTimeStr(),
          horaCheckOutPlaneada: '',
          cantidadPersonas: 1,
          cantidadVehiculos: 0
        });
        this.calculateExpressPricing();
        while (this.expressTenants.length > 1) this.expressTenants.removeAt(1);
        this.loadStays();
      },
      error: (err) => {
        this.errorMessage = this.extractErrorMessage(err);
        this.showErrorModal = true;
        console.error(err);
      }
    });
  }

  /**
   * Handler para el evento change del select de reservas.
   * Lee el valor del formControl y lo pasa a onReservationSelected.
   */
  onReservationChange(): void {
    const reservationId = this.existingForm.get('reservationId')?.value;
    this.onReservationSelected(reservationId);
  }

  /**
   * Cuando se selecciona una reserva existente, prellenar los datos del formulario:
   * - Fecha de check-in (usando la fecha de la reserva)
   * - Datos del inquilino (nombre, apellido, DNI, teléfono)
   */
  onReservationSelected(reservationId: any): void {
    if (!reservationId) {
      this.selectedReservation = null;
      this.useReservanteAsTenant = false;
      this.setExistingTenantCount(1);
      this.existingForm.get('montoPagadoEnCheckIn')?.setValue(0, { emitEvent: false });
      this.existingForm.get('montoPagadoEnCheckIn')?.setValidators([Validators.min(0), Validators.max(0)]);
      this.existingForm.get('montoPagadoEnCheckIn')?.updateValueAndValidity({ emitEvent: false });
      return;
    }

    // El <select> devuelve el value como string, pero ReservationResponse.id es number.
    // Convertimos para que la comparación estricta funcione.
    const id = typeof reservationId === 'string' ? parseInt(reservationId, 10) : reservationId;

    const reservation = this.reservations.find(r => r.id === id);

    if (!reservation) {
      this.selectedReservation = null;
      this.useReservanteAsTenant = false;
      this.setExistingTenantCount(1);
      this.existingForm.get('montoPagadoEnCheckIn')?.setValue(0, { emitEvent: false });
      return;
    }

    this.selectedReservation = reservation;
    this.useReservanteAsTenant = false;
    this.setExistingTenantCount(reservation.cantidadPersonas);
    const paymentControl = this.existingForm.get('montoPagadoEnCheckIn');
    paymentControl?.setValue(0, { emitEvent: false });
    paymentControl?.setValidators([Validators.min(0), Validators.max(this.getCheckInOutstandingAmount())]);
    paymentControl?.updateValueAndValidity({ emitEvent: false });

    // Prellenar la fecha de check-in con la fecha simulada actual (no la fecha de la reserva).
    // Así, si la fecha simulada no coincide con la fecha de la reserva, la validación
    // en onCheckInFromReservation() detectará la diferencia y mostrará el modal de justificación.
    this.existingForm.get('fechaHoraCheckInReal')?.setValue(
      this.dateCtrl.getDateTimeStr(),
      { emitEvent: false }
    );

  }

  /**
   * Cuando el usuario marca/desmarca el checkbox "Usar reservante como inquilino",
   * se prellena o limpia el primer tenant con los datos de quien hizo la reserva.
   * IMPORTANTE: [checked] es unidireccional, así que hay que invertir el booleano
   * manualmente al inicio del método.
   */
  onUseReservanteAsTenant(): void {
    if (!this.selectedReservation) return;

    // Invertir el booleano porque [checked] no actualiza la variable automáticamente
    this.useReservanteAsTenant = !this.useReservanteAsTenant;

    const firstTenant = this.existingTenants.at(0) as FormGroup;
    if (!firstTenant) return;

    if (this.useReservanteAsTenant) {
      firstTenant.patchValue({
        documentNumber: this.selectedReservation.documentNumber || '',
        firstName: this.selectedReservation.firstName || '',
        lastName: this.selectedReservation.lastName || '',
        phoneNumber: this.selectedReservation.phoneNumber || ''
      }, { emitEvent: false });
    } else {
      firstTenant.reset({
        documentNumber: '',
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        dateOfBirth: ''
      }, { emitEvent: false });
    }
  }

  onCheckInFromReservation(): void {
    this.updateCheckInPaymentValidator();
    if (this.existingForm.invalid) return;
    const formValue = this.existingForm.value;
    const paymentAmount = Number(formValue.montoPagadoEnCheckIn || 0);
    if (!Number.isFinite(paymentAmount) || paymentAmount < 0 || paymentAmount > this.getCheckInOutstandingAmount()) {
      this.errorMessage = 'El pago ingresado no puede superar el saldo pendiente de la reserva.';
      this.showErrorModal = true;
      return;
    }

    // Check if check-in date matches the reservation's check-in date.
    // Usamos la fecha del simulador (dateCtrl.getDateStr()) como referencia,
    // igual que el tutorial, para que la validación funcione correctamente
    // incluso si el usuario editó manualmente el campo datetime-local.
    if (this.selectedReservation) {
      const simDate = this.dateCtrl.getDateStr(); // YYYY-MM-DD (simulada o real según switch)
      if (simDate !== this.selectedReservation.fechaCheckIn) {
        // Show justification modal instead of blocking
        const direction = simDate < this.selectedReservation.fechaCheckIn ? 'antes' : 'después';
        this.justificationContext = 'checkIn';
        this.justificationMessage =
          `📅 La reserva tiene fecha de check-in: <strong>${this.selectedReservation.fechaCheckIn}</strong>. ` +
          `El huésped llegó <strong>${direction}</strong> del día planeado (fecha actual: <strong>${simDate}</strong>).`;
        this.justificationComment = '';
        this.justificationError = '';

        // Prepare the pending request
        this.pendingCheckInRequest = {
          reservationId: formValue.reservationId,
          fechaHoraCheckInReal: formValue.fechaHoraCheckInReal,
          comentariosCheckIn: formValue.comentariosCheckIn,
          montoPagadoEnCheckIn: paymentAmount,
          tenants: formValue.tenants as TenantRequest[]
        };
        this.showJustificationModal = true;
        return;
      }
    }

    // Date matches — proceed normally
    this.executeCheckInFromReservation({
      reservationId: formValue.reservationId,
      fechaHoraCheckInReal: formValue.fechaHoraCheckInReal,
      comentariosCheckIn: formValue.comentariosCheckIn,
      montoPagadoEnCheckIn: paymentAmount,
      tenants: formValue.tenants as TenantRequest[]
    });
  }

  getCheckInOutstandingAmount(): number {
    if (!this.selectedReservation) return 0;
    return Math.max(0, this.getCheckInTotalAmount() - (this.selectedReservation.montoSenia || 0));
  }

  getCheckInOriginalTotalAmount(): number {
    return this.selectedReservation?.precioTotal || 0;
  }

  getCheckInAdditionalNights(): number {
    if (!this.selectedReservation) return 0;
    const actualCheckInDateTime = this.pendingCheckInRequest?.fechaHoraCheckInReal
      || this.existingForm?.get('fechaHoraCheckInReal')?.value;
    const actualCheckInDate = actualCheckInDateTime?.slice(0, 10);
    if (!actualCheckInDate || actualCheckInDate >= this.selectedReservation.fechaCheckIn) return 0;

    const plannedDate = Date.parse(`${this.selectedReservation.fechaCheckIn}T00:00:00Z`);
    const actualDate = Date.parse(`${actualCheckInDate}T00:00:00Z`);
    return Math.round((plannedDate - actualDate) / 86_400_000);
  }

  getCheckInTotalAmount(): number {
    if (!this.selectedReservation) return 0;
    const department = this.departments.find(item => item.id === this.selectedReservation?.departmentId);
    return this.getCheckInOriginalTotalAmount() + this.getCheckInAdditionalNights() * (department?.precioPorNoche || 0);
  }

  updateCheckInPaymentValidator(): void {
    const paymentControl = this.existingForm.get('montoPagadoEnCheckIn');
    if (!paymentControl) return;
    paymentControl.setValidators([Validators.min(0), Validators.max(this.getCheckInOutstandingAmount())]);
    paymentControl.updateValueAndValidity({ emitEvent: false });
  }

  getCheckInOutstandingAfterPayment(): number {
    const payment = Number(this.existingForm?.get('montoPagadoEnCheckIn')?.value || 0);
    return Math.max(0, this.getCheckInOutstandingAmount() - payment);
  }

  getCheckoutOutstandingAmount(stayId: number | null): number {
    if (stayId === null) return 0;
    const stay = this.stays.find(item => item.id === stayId);
    return Math.max(0, this.getCheckoutTotalAmount(stayId) - (stay?.montoPagadoReserva || 0));
  }

  getCheckoutTotalAmount(stayId: number | null): number {
    if (stayId === null) return 0;
    const stay = this.stays.find(item => item.id === stayId);
    if (!stay) return 0;

    const department = this.departments.find(item => item.id === stay.departmentId);
    return (stay.precioTotalReserva || 0) + this.getCheckoutAdditionalNights(stayId) * (department?.precioPorNoche || 0);
  }

  getCheckoutPreviousTotalAmount(stayId: number | null): number {
    if (stayId === null) return 0;
    return this.stays.find(item => item.id === stayId)?.precioTotalReserva || 0;
  }

  getCheckoutAdditionalNights(stayId: number | null): number {
    if (stayId === null) return 0;
    const stay = this.stays.find(item => item.id === stayId);
    const actualCheckOutDate = this.checkoutForm?.get('fechaHoraCheckOutReal')?.value?.slice(0, 10);
    if (!stay?.fechaCheckOutPlaneada || !actualCheckOutDate || actualCheckOutDate <= stay.fechaCheckOutPlaneada) return 0;

    const plannedDate = Date.parse(`${stay.fechaCheckOutPlaneada}T00:00:00Z`);
    const actualDate = Date.parse(`${actualCheckOutDate}T00:00:00Z`);
    return Math.round((actualDate - plannedDate) / 86_400_000);
  }

  getCheckoutRemainingAfterPayment(): number {
    if (this.pendingCheckoutStayId === null) return 0;
    const outstanding = this.getCheckoutOutstandingAmount(this.pendingCheckoutStayId);
    return Math.max(0, outstanding - Number(this.checkoutPaymentAmount || 0));
  }

  formatCheckoutAmount(amount: number): string {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(amount);
  }

  executeCheckInFromReservation(request: CheckInRequest): void {
    this.error = '';
    this.success = '';
    this.stayService.checkInFromReservation(request).subscribe({
      next: () => {
        this.success = 'Check-in realizado exitosamente.';
        this.selectedReservation = null;
        this.existingForm.reset({
          fechaHoraCheckInReal: this.dateCtrl.getDateTimeStr(),
          montoPagadoEnCheckIn: 0
        });
        while (this.existingTenants.length > 1) this.existingTenants.removeAt(1);
        this.loadStays();
        this.loadReservations();
      },
      error: (err) => {
        this.errorMessage = this.extractErrorMessage(err);
        this.showErrorModal = true;
        console.error(err);
      }
    });
  }

  onCreateRetroactive(): void {
    if (this.retroactiveForm.invalid) return;
    const formValue = this.retroactiveForm.value;

    // Validar que la fecha de check-out no sea posterior a la fecha actual
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const checkOutDate = new Date(formValue.fechaCheckOut);
    if (checkOutDate > today) {
      this.errorMessage = 'No se pueden cargar estadías retroactivas con fecha de check-out en el futuro.';
      this.showErrorModal = true;
      return;
    }

    const request: RetroactiveStayRequest = {
      departmentId: formValue.departmentId,
      fechaCheckIn: formValue.fechaCheckIn,
      fechaCheckOut: formValue.fechaCheckOut,
      cantidadPersonas: formValue.cantidadPersonas,
      cantidadVehiculos: formValue.cantidadVehiculos,
      precioTotal: formValue.precioTotal,
      montoSenia: formValue.montoSenia,
      comentariosCheckIn: formValue.comentariosCheckIn,
      tenants: formValue.tenants as TenantRequest[],
      classificationScore: formValue.classificationScore,
      classificationReviewComment: formValue.classificationReviewComment
    };
    this.error = '';
    this.success = '';
    this.stayService.createRetroactiveStay(request).subscribe({
      next: () => {
        this.success = 'Estadía retroactiva cargada exitosamente.';
        this.retroactiveForm.reset({
          cantidadPersonas: 1,
          cantidadVehiculos: 0,
          cantidadNoches: null
        });
        this.calculateRetroactivePricing();
        while (this.retroactiveTenants.length > 1) this.retroactiveTenants.removeAt(1);
        this.loadStays();
      },
      error: (err) => {
        this.errorMessage = this.extractErrorMessage(err);
        this.showErrorModal = true;
        console.error(err);
      }
    });
  }

  /**
   * Validador personalizado: la fecha de check-out debe ser posterior a la de check-in.
   */
  checkoutAfterCheckInValidator(): (control: AbstractControl) => ValidationErrors | null {
    return (control: AbstractControl): ValidationErrors | null => {
      const checkIn = control.get('fechaCheckIn')?.value;
      const checkOut = control.get('fechaCheckOut')?.value;
      if (!checkIn || !checkOut) return null;
      if (new Date(checkOut) <= new Date(checkIn)) {
        return { checkoutAfterCheckIn: true };
      }
      return null;
    };
  }

  /**
   * Devuelve la fecha mínima para el check-out en retroactivo (día después del check-in).
   */
  getRetroactiveCheckOutMinDate(): string {
    const checkIn = this.retroactiveForm.get('fechaCheckIn')?.value;
    if (!checkIn) return '';
    return addNightsToDate(checkIn, 1);
  }

  /**
   * Calcula la cantidad de noches del formulario retroactivo a partir de las fechas.
   */
  calculateRetroactiveNights(): void {
    const checkIn = this.retroactiveForm.get('fechaCheckIn')?.value;
    const checkOut = this.retroactiveForm.get('fechaCheckOut')?.value;
    this.retroactiveForm.get('cantidadNoches')?.setValue(calculateNightCount(checkIn, checkOut), { emitEvent: false });
  }

  /**
   * Calcula el precio total automáticamente para la estadía retroactiva.
   * Usa el precioPorNoche del departamento seleccionado y la cantidad de noches.
   */
  calculateRetroactivePricing(): void {
    const deptId = this.retroactiveForm.get('departmentId')?.value;
    const nights = Number(this.retroactiveForm.get('cantidadNoches')?.value);

    const dept = this.departments.find(d => d.id === Number(deptId));
    this.retroactiveSelectedDepartmentPrice = dept?.precioPorNoche ?? null;
    this.retroactiveCalculatedTotal = Number.isFinite(nights) && nights >= 1 && this.retroactiveSelectedDepartmentPrice !== null
      ? nights * this.retroactiveSelectedDepartmentPrice
      : null;

    const priceControl = this.retroactiveForm.get('precioTotal');
    if (priceControl?.pristine) {
      priceControl.setValue(this.retroactiveCalculatedTotal, { emitEvent: false });
    }
  }

  /**
   * Cuando el usuario cambia la cantidad de noches en el formulario retroactivo,
   * ajustar la fecha de check-out.
   */
  onRetroactiveNightsChange(nights: number | null): void {
    const checkIn = this.retroactiveForm.get('fechaCheckIn')?.value;
    if (!checkIn || !nights || nights < 1) return;

    const checkOut = addNightsToDate(checkIn, nights);
    if (!checkOut) return;
    this.retroactiveForm.get('fechaCheckOut')?.setValue(checkOut, { emitEvent: false });
  }

  onCheckout(stayId: number): void {
    if (this.checkoutForm.invalid) return;
    const formValue = this.checkoutForm.value;
    const request: StayFinalizationRequest = {
      fechaHoraCheckOutReal: formValue.fechaHoraCheckOutReal,
      comentariosCheckOut: formValue.comentariosCheckOut,
      estadoDepartamento: formValue.estadoDepartamento,
      classificationScore: formValue.classificationScore && formValue.classificationReviewComment?.trim()
        ? formValue.classificationScore
        : undefined,
      classificationReviewComment: formValue.classificationScore && formValue.classificationReviewComment?.trim()
        ? formValue.classificationReviewComment.trim()
        : undefined
    };

    if (this.getCheckoutOutstandingAmount(stayId) > 0) {
      this.pendingCheckoutStayId = stayId;
      this.pendingCheckoutRequest = request;
      this.checkoutPaymentAmount = 0;
      this.checkoutDebtComment = '';
      this.checkoutPaymentError = '';
      this.showCheckoutPaymentReminder = true;
      return;
    }

    this.continueCheckout(stayId, request);
  }

  private continueCheckout(stayId: number, request: StayFinalizationRequest, skipClassificationReminder = false): void {
    if (!skipClassificationReminder && (!request.classificationScore || !request.classificationReviewComment?.trim())) {
      this.pendingCheckoutStayId = stayId;
      this.pendingCheckoutRequest = request;
      this.showCheckoutClassificationReminder = true;
      return;
    }

    // Check if check-out date matches the planned check-out date.
    // Usamos la fecha del simulador (dateCtrl.getDateStr()) como referencia,
    // igual que el tutorial, para que la validación funcione correctamente.
    const stay = this.stays.find(s => s.id === stayId);
    if (stay && stay.fechaCheckOutPlaneada) {
      const simDate = this.dateCtrl.getDateStr(); // YYYY-MM-DD (simulada o real según switch)
      if (simDate !== stay.fechaCheckOutPlaneada) {
        // Show justification modal instead of blocking
        const direction = simDate < stay.fechaCheckOutPlaneada ? 'antes' : 'después';
        this.justificationContext = 'checkout';
        this.justificationMessage =
          `📅 La estadía tiene fecha de check-out planeada: <strong>${stay.fechaCheckOutPlaneada}</strong>. ` +
          `El huésped se va <strong>${direction}</strong> del día planeado (fecha actual: <strong>${simDate}</strong>).`;
        this.justificationComment = '';
        this.justificationError = '';

        // Prepare the pending request
        this.pendingCheckoutStayId = stayId;
        this.pendingCheckoutRequest = request;
        this.showJustificationModal = true;
        return;
      }
    }

    // Date matches — proceed normally
    this.executeCheckout(stayId, request);
  }

  confirmCheckoutPaymentReminder(): void {
    const stayId = this.pendingCheckoutStayId;
    const request = this.pendingCheckoutRequest;
    if (stayId === null || !request) return;

    const outstanding = this.getCheckoutOutstandingAmount(stayId);
    const paymentReceived = Number(this.checkoutPaymentAmount);
    if (!Number.isFinite(paymentReceived) || paymentReceived < 0) {
      this.checkoutPaymentError = 'Ingresá un importe válido, igual o mayor a cero.';
      return;
    }
    if (paymentReceived > outstanding + 0.01) {
      this.checkoutPaymentError = 'El pago no puede superar el saldo pendiente.';
      return;
    }

    const remaining = Math.max(outstanding - paymentReceived, 0);
    if (remaining > 0.01 && !this.checkoutDebtComment.trim()) {
      this.checkoutPaymentError = 'Explicá el motivo del saldo impago para cerrar la estadía.';
      return;
    }

    request.montoPagadoEnCheckOut = paymentReceived;
    if (remaining > 0.01) {
      const debtNote = `[SALDO IMPAGO: $${this.formatCheckoutAmount(remaining)}] Motivo: ${this.checkoutDebtComment.trim()}`;
      request.comentariosCheckOut = [request.comentariosCheckOut?.trim(), debtNote]
        .filter(Boolean)
        .join('\n');
    }

    this.showCheckoutPaymentReminder = false;
    this.pendingCheckoutStayId = null;
    this.pendingCheckoutRequest = null;
    this.checkoutPaymentAmount = 0;
    this.checkoutDebtComment = '';
    this.checkoutPaymentError = '';
    this.continueCheckout(stayId, request);
  }

  confirmCheckoutWithoutClassification(): void {
    const stayId = this.pendingCheckoutStayId;
    const request = this.pendingCheckoutRequest;
    if (stayId === null || !request) return;

    this.showCheckoutClassificationReminder = false;
    this.pendingCheckoutStayId = null;
    this.pendingCheckoutRequest = null;
    this.continueCheckout(stayId, request, true);
  }

  closeCheckoutClassificationReminder(): void {
    this.showCheckoutClassificationReminder = false;
    this.pendingCheckoutStayId = null;
    this.pendingCheckoutRequest = null;
  }

  closeCheckoutPaymentReminder(): void {
    this.showCheckoutPaymentReminder = false;
    this.pendingCheckoutStayId = null;
    this.pendingCheckoutRequest = null;
    this.checkoutPaymentAmount = 0;
    this.checkoutDebtComment = '';
    this.checkoutPaymentError = '';
  }

  executeCheckout(stayId: number, request: StayFinalizationRequest): void {
    this.error = '';
    this.success = '';
    this.stayService.finalizeStay(stayId, request).subscribe({
      next: () => {
        this.success = 'Check-out realizado exitosamente.';
        this.checkoutForm.reset({
          fechaHoraCheckOutReal: this.dateCtrl.getDateTimeStr(),
          estadoDepartamento: 'GOOD'
        });
        this.loadStays();
        this.loadReservations();
      },
      error: (err) => {
        this.errorMessage = this.extractErrorMessage(err);
        this.showErrorModal = true;
        console.error(err);
      }
    });
  }

  // ----------------------------------------------------------------------
  // Modal de justificación de fecha
  // ----------------------------------------------------------------------

  confirmJustification(): void {
    const reason = this.justificationComment.trim();
    if (!reason) {
      this.justificationError = this.justificationContext === 'checkIn'
        ? 'La justificación es obligatoria para continuar con el check-in.'
        : 'La justificación es obligatoria para continuar con el check-out.';
      return;
    }

    if (this.justificationContext === 'checkIn' && this.pendingCheckInRequest) {
      const justificationNote = '[FECHA JUSTIFICADA] Motivo: ' + reason;
      // Agregar la nota a los comentarios de check-in
      const existingComment = this.pendingCheckInRequest.comentariosCheckIn;
      this.pendingCheckInRequest.comentariosCheckIn = existingComment && existingComment.trim()
        ? existingComment + ' ' + justificationNote
        : justificationNote;
      this.executeCheckInFromReservation(this.pendingCheckInRequest);
    } else if (this.justificationContext === 'checkout' && this.pendingCheckoutRequest && this.pendingCheckoutStayId) {
      const justificationNote = '[FECHA JUSTIFICADA] Motivo: ' + reason;
      // Agregar la nota a los comentarios de check-out
      const existingComment = this.pendingCheckoutRequest.comentariosCheckOut;
      this.pendingCheckoutRequest.comentariosCheckOut = existingComment && existingComment.trim()
        ? existingComment + ' ' + justificationNote
        : justificationNote;
      this.executeCheckout(this.pendingCheckoutStayId, this.pendingCheckoutRequest);
    }
    this.closeJustificationModal();
  }

  closeJustificationModal(): void {
    this.showJustificationModal = false;
    this.justificationContext = '';
    this.justificationMessage = '';
    this.justificationComment = '';
    this.justificationError = '';
    this.pendingCheckInRequest = null;
    this.pendingCheckoutStayId = null;
    this.pendingCheckoutRequest = null;
  }

  closeErrorModal(): void {
    this.showErrorModal = false;
    this.errorMessage = '';
  }

  // ----------------------------------------------------------------------
  // Auto-relleno con datos de ejemplo
  // ----------------------------------------------------------------------

  onAutoFillExpress(): void {
    const tenant = this.autoFill.autoFillTenant();
    this.expressForm.patchValue({
      cantidadPersonas: 1,
      cantidadVehiculos: Math.floor(Math.random() * 2),
      comentariosCheckIn: ''
    });
    // Rellenar el primer tenant
    const tenants = this.expressForm.get('tenants') as FormArray;
    if (tenants.at(0)) {
      const tenantControl = tenants.at(0) as FormGroup;
      tenantControl.patchValue(tenant, { emitEvent: false });
      // Marcar controles como dirty y touched, y re-evaluar validators (incluyendo async)
      Object.keys(tenantControl.controls).forEach(key => {
        const control = tenantControl.get(key);
        control?.markAsDirty();
        control?.markAsTouched();
        control?.updateValueAndValidity({ emitEvent: false });
      });
    }
  }

  onAutoFillExisting(): void {
    const tenant = this.autoFill.autoFillTenant();
    this.existingForm.patchValue({
      comentariosCheckIn: ''
    });
    // Rellenar el primer tenant
    const tenants = this.existingForm.get('tenants') as FormArray;
    if (tenants.at(0)) {
      const tenantControl = tenants.at(0) as FormGroup;
      tenantControl.patchValue(tenant, { emitEvent: false });
      // Marcar controles como dirty y touched, y re-evaluar validators (incluyendo async)
      Object.keys(tenantControl.controls).forEach(key => {
        const control = tenantControl.get(key);
        control?.markAsDirty();
        control?.markAsTouched();
        control?.updateValueAndValidity({ emitEvent: false });
      });
    }
  }

  onAutoFillRetroactive(): void {
    const tenant = this.autoFill.autoFillTenant();
    this.retroactiveForm.patchValue({
      cantidadPersonas: 1,
      cantidadVehiculos: Math.floor(Math.random() * 2),
      comentariosCheckIn: ''
    });
    // Rellenar el primer tenant
    const tenants = this.retroactiveForm.get('tenants') as FormArray;
    if (tenants.at(0)) {
      const tenantControl = tenants.at(0) as FormGroup;
      tenantControl.patchValue(tenant, { emitEvent: false });
      // Marcar controles como dirty y touched, y re-evaluar validators (incluyendo async)
      Object.keys(tenantControl.controls).forEach(key => {
        const control = tenantControl.get(key);
        control?.markAsDirty();
        control?.markAsTouched();
        control?.updateValueAndValidity({ emitEvent: false });
      });
    }
  }

  onAutoFillCheckout(): void {
    const data = this.autoFill.autoFillCheckout();
    this.checkoutForm.patchValue(data);
  }

  private extractErrorMessage(err: any): string {
    // Intentar extraer el cuerpo del error de varias formas posibles
    let body = err.error;

    // Si err.error es un objeto Text (sin parsear), intentar parsearlo
    if (body && typeof body === 'object' && !body.validationErrors && !body.businessErrorDescription && !body.error && !body.message) {
      try {
        // A veces Angular no parsea el JSON automáticamente
        if (typeof body === 'string') {
          body = JSON.parse(body);
        }
      } catch (e) {
        // No es JSON, usar el texto como mensaje
        return String(body);
      }
    }

    // 1. validationErrors (Set<String> serializado como array)
    if (body?.validationErrors) {
      const errors = Array.isArray(body.validationErrors) ? body.validationErrors : [body.validationErrors];
      if (errors.length > 0) {
        return errors.join('. ');
      }
    }
    // 2. businessErrorDescription
    if (body?.businessErrorDescription) {
      return body.businessErrorDescription;
    }
    // 3. error
    if (body?.error) {
      return body.error;
    }
    // 4. message
    if (body?.message) {
      return body.message;
    }
    // 5. Fallback con status text
    if (err?.statusText) {
      return `Error ${err.status}: ${err.statusText}`;
    }
    return 'Error de servidor. Verificá los datos e intentá de nuevo.';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // ----------------------------------------------------------------------
  // Búsqueda de inquilino existente por DNI
  // ----------------------------------------------------------------------

  /**
   * Suscribe a valueChanges del campo DNI de un tenant específico.
   * Se llama UNA SOLA VEZ por tenant (en ngOnInit o al agregar un nuevo tenant).
   * Usa debounce para no hacer demasiadas consultas.
   */
  subscribeToDocumentSearch(formArray: FormArray, index: number): void {
    const tenantControl = formArray.at(index) as FormGroup;
    const docControl = tenantControl?.get('documentNumber');

    if (!docControl) return;

    docControl.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap((docNumber: string) => {
        // Solo buscar si tiene al menos 6 caracteres (DNI mínimo)
        if (!docNumber || docNumber.length < 6) {
          delete this.foundTenants[index];
          this.searchingTenants[index] = false;
          return of(null);
        }
        this.searchingTenants[index] = true;
        return this.tenantService.searchTenantByDocumentNumber(docNumber).pipe(
          tap((tenant) => {
            this.foundTenants[index] = tenant;
            this.searchingTenants[index] = false;
          }),
          catchError((err) => {
            // Error: inquilino no encontrado (404) u otro error
            delete this.foundTenants[index];
            this.searchingTenants[index] = false;
            return of(null);
          })
        );
      })
    ).subscribe();
  }

  /**
   * Autocompleta los campos del formulario con los datos del inquilino encontrado.
   */
  fillTenantFromExisting(formArray: FormArray, index: number): void {
    const tenant = this.foundTenants[index];
    if (!tenant) return;

    const tenantControl = formArray.at(index) as FormGroup;
    tenantControl.patchValue({
      firstName: tenant.firstName,
      lastName: tenant.lastName,
      email: tenant.email || '',
      phoneNumber: tenant.phoneNumber || '',
      dateOfBirth: tenant.dateOfBirth || ''
    });

    // Limpiar el resultado después de autocompletar
    delete this.foundTenants[index];
  }

  /**
   * Verifica si los datos del formulario coinciden con el inquilino encontrado.
   * Devuelve true si hay discrepancias (posible suplantación de identidad).
   */
  hasDataMismatch(formArray: FormArray, index: number): boolean {
    const tenant = this.foundTenants[index];
    if (!tenant) return false;

    const tenantControl = formArray.at(index) as FormGroup;
    const formValue = tenantControl.value;

    // Si los campos están vacíos, no hay discrepancia
    if (!formValue.firstName && !formValue.lastName && !formValue.email) {
      return false;
    }

    // Verificar si los datos ingresados difieren de los datos del inquilino encontrado
    if (formValue.firstName && formValue.firstName.toLowerCase().trim() !== tenant.firstName.toLowerCase().trim()) {
      return true;
    }
    if (formValue.lastName && formValue.lastName.toLowerCase().trim() !== tenant.lastName.toLowerCase().trim()) {
      return true;
    }
    if (formValue.email && formValue.email.toLowerCase().trim() !== (tenant.email || '').toLowerCase().trim()) {
      return true;
    }
    return false;
  }

  /**
   * Desestima el inquilino encontrado y permite crear uno nuevo con el mismo DNI.
   */
  dismissFoundTenant(index: number): void {
    delete this.foundTenants[index];
  }

  /**
   * Devuelve la nota promedio formateada con estrellas.
   */
  getScoreStars(score: number | null | undefined): string {
    if (score == null) return 'Sin clasificación';
    return '⭐'.repeat(Math.round(score)) + ` (${score.toFixed(1)}/5)`;
  }
}
