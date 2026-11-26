import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReservationService } from '../../services/reservation.service';
import { ReservationRequest, ReservationResponse } from '../../models/reservation.models';
import { DepartmentService } from '../../services/department.service';
import { DepartmentResponse, DepositCalculationBase } from '../../models/department.models';
import { DateControllerService } from '../../services/date-controller.service';
import { AutoFillService } from '../../services/auto-fill.service';
import { ErrorModalComponent } from '../../shared/error-modal/error-modal';
import { addNightsToDate, calculateNightCount } from '../../shared/pricing.utils';

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ErrorModalComponent, RouterLink],
  templateUrl: './reservations.html',
  styleUrl: './reservations.css'
})
export class ReservationsComponent implements OnInit {
  private resService = inject(ReservationService);
  private deptService = inject(DepartmentService);
  private dateCtrl = inject(DateControllerService);
  private autoFill = inject(AutoFillService);
  private fb = inject(FormBuilder);

  reservations: ReservationResponse[] = [];
  departments: DepartmentResponse[] = [];
  loading = false;
  error = '';
  success = '';
  showErrorModal = false;
  errorMessage = '';
  showDepositModal = false;
  depositReservation: ReservationResponse | null = null;
  depositAmount: number | null = null;
  depositError = '';
  savingDeposit = false;

  get noDepartments(): boolean {
    return this.departments.length === 0;
  }

  createForm!: FormGroup;
  selectedDepartmentPrice: number | null = null;
  selectedDepartmentDepositPercentage: number | null = null;
  selectedDepartmentDepositBase: DepositCalculationBase | null = null;
  calculatedDepositMinimum: number | null = null;
  calculatedNights: number | null = null;
  calculatedTotal: number | null = null;

  ngOnInit(): void {
    this.loadReservations();
    this.loadDepartments();
    this.createForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.maxLength(50)]],
      documentNumber: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(20)]],
      phoneNumber: ['', [Validators.required]],
      cantidadPersonas: [1, [Validators.required, Validators.min(1)]],
      cantidadVehiculos: [null, [Validators.min(0)]],
      fechaCheckIn: [this.dateCtrl.getDateStr(), [Validators.required]],
      fechaCheckOut: [this.dateCtrl.getDateStrOffset(1), [Validators.required]],
      cantidadNoches: [null, [Validators.min(1)]],
      departmentId: [null, [Validators.required]],
      precioTotal: [null, [Validators.min(0)]],
      montoSenia: [null, [Validators.min(0)]]
    });

    // Recalcular cuando cambian las fechas o el departamento
    const controlsToWatch = [
      this.createForm.get('departmentId')!,
      this.createForm.get('fechaCheckIn')!,
      this.createForm.get('fechaCheckOut')!
    ];

    controlsToWatch.forEach(control => {
      control?.valueChanges.subscribe(() => {
        this.calculateSmartPricing();
      });
    });

    this.createForm.get('precioTotal')!.valueChanges.subscribe(() => {
      this.calculateDepositMinimum();
    });

    // Cuando el usuario cambia las noches, ajustar el check-out y recalcular
    this.createForm.get('cantidadNoches')!.valueChanges.subscribe((nights: number | null) => {
      this.onNightsChange(nights);
    });

    this.calculateSmartPricing();
  }

  /**
   * Cuando el usuario cambia la cantidad de noches, ajustar la fecha de check-out.
   * Se suma la cantidad de noches a la fecha de check-in.
   */
  onNightsChange(nights: number | null): void {
    const checkIn = this.createForm.get('fechaCheckIn')?.value;
    if (!checkIn || nights === null || !Number.isFinite(nights) || nights < 1) return;

    const checkOut = addNightsToDate(checkIn, nights);
    if (!checkOut) return;
    this.createForm.get('fechaCheckOut')?.setValue(checkOut, { emitEvent: false });
    this.calculateSmartPricing();
  }

  /**
   * Devuelve la fecha mínima para el check-out (día después del check-in).
   */
  getCheckOutMinDate(): string {
    const checkIn = this.createForm.get('fechaCheckIn')?.value;
    if (!checkIn) return '';
    return addNightsToDate(checkIn, 1);
  }

  loadDepartments(): void {
    this.deptService.getMyDepartments().subscribe({
      next: (data) => {
        this.departments = data;
        if (this.createForm) this.calculateSmartPricing();
      },
      error: (err) => console.error(err)
    });
  }

  loadReservations(): void {
    this.loading = true;
    this.resService.getMyReservations().subscribe({
      next: (data) => { this.reservations = data; this.loading = false; },
      error: (err) => { console.error(err); this.loading = false; }
    });
  }

  onCreate(): void {
    if (this.createForm.invalid) return;
    const formValue = this.createForm.value;
    const request: ReservationRequest = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      documentNumber: formValue.documentNumber,
      phoneNumber: formValue.phoneNumber,
      cantidadPersonas: formValue.cantidadPersonas,
      cantidadVehiculos: formValue.cantidadVehiculos ?? 0,
      fechaCheckIn: formValue.fechaCheckIn,
      fechaCheckOut: formValue.fechaCheckOut,
      departmentId: formValue.departmentId,
      precioTotal: formValue.precioTotal ?? 0,
      montoSenia: formValue.montoSenia ?? 0
    };
    this.error = '';
    this.success = '';
    this.resService.createReservation(request).subscribe({
      next: () => {
        this.success = 'Reserva creada exitosamente.';
        this.createForm.reset({
          cantidadPersonas: 1,
          cantidadVehiculos: null,
          cantidadNoches: null,
          precioTotal: null,
          montoSenia: null
        });
        this.selectedDepartmentPrice = null;
        this.selectedDepartmentDepositPercentage = null;
        this.selectedDepartmentDepositBase = null;
        this.calculatedDepositMinimum = null;
        this.calculatedNights = null;
        this.calculatedTotal = null;
        this.loadReservations();
      },
      error: (err) => {
        this.errorMessage = this.extractErrorMessage(err);
        this.showErrorModal = true;
        console.error(err);
      }
    });
  }

  /**
   * Calcula automáticamente la cantidad de noches y el precio total
   * basado en el departamento seleccionado y las fechas.
   */
  calculateSmartPricing(): void {
    const deptId = this.createForm.get('departmentId')?.value;
    const checkIn = this.createForm.get('fechaCheckIn')?.value;
    const checkOut = this.createForm.get('fechaCheckOut')?.value;

    // Buscar el precio por noche del departamento seleccionado
    if (deptId) {
      const dept = this.departments.find(d => d.id === Number(deptId));
      this.selectedDepartmentPrice = dept?.precioPorNoche ?? null;
      this.selectedDepartmentDepositPercentage = dept?.porcentajeSeniaRequerida ?? null;
      this.selectedDepartmentDepositBase = dept?.baseCalculoSenia ?? null;
    } else {
      this.selectedDepartmentPrice = null;
      this.selectedDepartmentDepositPercentage = null;
      this.selectedDepartmentDepositBase = null;
    }

    // Calcular cantidad de noches
    this.calculatedNights = calculateNightCount(checkIn, checkOut);
    this.createForm.get('cantidadNoches')?.setValue(this.calculatedNights, { emitEvent: false });

    // Calcular precio total = precio por noche × cantidad de noches
    if (this.selectedDepartmentPrice !== null && this.calculatedNights !== null) {
      this.calculatedTotal = this.selectedDepartmentPrice * this.calculatedNights;
      if (this.createForm.get('precioTotal')?.pristine) {
        this.createForm.get('precioTotal')?.setValue(this.calculatedTotal, { emitEvent: false });
      }
    } else {
      this.calculatedTotal = null;
      if (this.createForm.get('precioTotal')?.pristine) {
        this.createForm.get('precioTotal')?.setValue(null, { emitEvent: false });
      }
    }
    this.calculateDepositMinimum();
  }

  private calculateDepositMinimum(): void {
    const total = Number(this.createForm.get('precioTotal')?.value);
    const baseAmount = this.selectedDepartmentDepositBase === 'NIGHT_PRICE'
      ? this.selectedDepartmentPrice
      : total;
    if (this.selectedDepartmentDepositPercentage === null || baseAmount === null || !Number.isFinite(baseAmount) || baseAmount <= 0) {
      this.calculatedDepositMinimum = null;
      return;
    }
    this.calculatedDepositMinimum = baseAmount * this.selectedDepartmentDepositPercentage / 100;
  }

  getReservationDepositMinimum(reservation: ReservationResponse): number {
    const department = this.departments.find(item => item.id === reservation.departmentId);
    if (!department) return 0;
    const baseAmount = department.baseCalculoSenia === 'NIGHT_PRICE'
      ? department.precioPorNoche
      : reservation.precioTotal;
    return baseAmount * department.porcentajeSeniaRequerida / 100;
  }

  getDepositRemainingToConfirm(reservation: ReservationResponse): number {
    return Math.max(0, this.getReservationDepositMinimum(reservation) - (reservation.montoSenia || 0));
  }

  getDepositRemainingAfterInput(): number {
    if (!this.depositReservation) return 0;
    return Math.max(0, this.getDepositRemainingToConfirm(this.depositReservation) - Number(this.depositAmount || 0));
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(amount);
  }

  getReservationStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'Pendiente',
      CONFIRMED: 'Confirmada',
      CANCELED: 'Cancelada',
      CANCELLED: 'Cancelada',
      CHECKED_IN: 'Con check-in',
      COMPLETED: 'Completada'
    };
    return labels[status] || status;
  }

  openDepositModal(reservation: ReservationResponse): void {
    this.depositReservation = reservation;
    this.depositAmount = null;
    this.depositError = '';
    this.showDepositModal = true;
  }

  closeDepositModal(): void {
    if (this.savingDeposit) return;
    this.showDepositModal = false;
    this.depositReservation = null;
    this.depositAmount = null;
    this.depositError = '';
  }

  confirmDeposit(): void {
    if (!this.depositReservation) return;
    const amount = Number(this.depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.depositError = 'Ingresá un importe mayor a cero.';
      return;
    }

    const outstanding = Math.max(0, this.depositReservation.precioTotal - (this.depositReservation.montoSenia || 0));
    if (amount > outstanding) {
      this.depositError = 'El pago no puede superar el saldo pendiente de la reserva.';
      return;
    }

    this.savingDeposit = true;
    this.resService.registerDeposit(this.depositReservation.id, amount).subscribe({
      next: () => {
        this.savingDeposit = false;
        this.closeDepositModal();
        this.loadReservations();
      },
      error: (err) => {
        this.savingDeposit = false;
        this.depositError = this.extractErrorMessage(err);
      }
    });
  }

  closeErrorModal(): void {
    this.showErrorModal = false;
    this.errorMessage = '';
  }

  onAutoFill(): void {
    const data = this.autoFill.autoFillReservation();
    this.createForm.get('precioTotal')?.reset(null, { emitEvent: false });
    this.createForm.get('montoSenia')?.reset(null, { emitEvent: false });
    this.createForm.patchValue(data);

    // Seleccionar un departamento aleatorio si hay departamentos disponibles
    if (this.departments.length > 0) {
      const randomDept = this.departments[Math.floor(Math.random() * this.departments.length)];
      this.createForm.get('departmentId')?.setValue(randomDept.id, { emitEvent: true });
      // emitEvent: true dispara calculateSmartPricing() para calcular noches y precio total
    }
  }

  private extractErrorMessage(err: any): string {
    const body = err.error;
    if (body?.validationErrors && Array.isArray(body.validationErrors) && body.validationErrors.length > 0) {
      return body.validationErrors.join('. ');
    }
    if (body?.businessErrorDescription) {
      return body.businessErrorDescription;
    }
    if (body?.error) {
      return body.error;
    }
    if (body?.message) {
      return body.message;
    }
    return 'Error de servidor. Verificá los datos e intentá de nuevo.';
  }

  onCancel(id: number): void {
    if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;
    this.resService.cancelReservation(id).subscribe({
      next: () => this.loadReservations(),
      error: (err) => console.error(err)
    });
  }

}
