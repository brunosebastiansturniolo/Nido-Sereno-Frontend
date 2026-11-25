import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  imports: [CommonModule, ReactiveFormsModule, ErrorModalComponent, RouterLink],
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

  onDeposit(reservation: ReservationResponse): void {
    const department = this.departments.find(d => d.id === reservation.departmentId);
    const paid = reservation.montoSenia || 0;
    const depositBase = department?.baseCalculoSenia ?? 'RESERVATION_TOTAL';
    const depositBaseAmount = depositBase === 'NIGHT_PRICE'
      ? department?.precioPorNoche || 0
      : reservation.precioTotal;
    const requiredDeposit = depositBaseAmount * (department?.porcentajeSeniaRequerida || 0) / 100;
    const minimumRemaining = Math.max(requiredDeposit - paid, 0);
    const depositBaseLabel = depositBase === 'NIGHT_PRICE' ? 'del precio de una noche' : 'del total de la reserva';
    const enteredAmount = window.prompt(
      `Monto de seña a registrar. Falta $${minimumRemaining} para alcanzar la seña mínima (${department?.porcentajeSeniaRequerida || 0}% ${depositBaseLabel}):`,
      minimumRemaining > 0 ? String(minimumRemaining) : ''
    );
    if (enteredAmount === null) return;

    const amount = Number(enteredAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      this.showActionError('Ingresá un monto mayor a cero.');
      return;
    }

    this.resService.registerDeposit(reservation.id, amount).subscribe({
      next: () => {
        this.success = 'Seña registrada exitosamente.';
        this.loadReservations();
      },
      error: (err) => this.showActionError(this.extractErrorMessage(err))
    });
  }

  onCompletePayment(reservation: ReservationResponse): void {
    const balance = Math.max(reservation.precioTotal - (reservation.montoSenia || 0), 0);
    if (!window.confirm(`¿Registrar el pago del saldo de $${balance} y completar esta reserva?`)) return;

    this.resService.completePayment(reservation.id).subscribe({
      next: () => {
        this.success = 'Pago completado; la reserva quedó completada.';
        this.loadReservations();
      },
      error: (err) => this.showActionError(this.extractErrorMessage(err))
    });
  }

  private showActionError(message: string): void {
    this.errorMessage = message;
    this.showErrorModal = true;
  }
}
