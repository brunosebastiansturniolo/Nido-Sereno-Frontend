import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReservationService } from '../../services/reservation.service';
import { ReservationRequest, ReservationResponse } from '../../models/reservation.models';
import { DepartmentService } from '../../services/department.service';
import { DepartmentResponse } from '../../models/department.models';
import { DateControllerService } from '../../services/date-controller.service';
import { AutoFillService } from '../../services/auto-fill.service';
import { ErrorModalComponent } from '../../shared/error-modal/error-modal';

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
  calculatedNights: number | null = null;
  calculatedTotal: number | null = null;
  private userModifiedCheckOut = false; // Bandera para saber si el usuario modificó manualmente el check-out
  private userModifiedNights = false; // Bandera para saber si el usuario modificó manualmente las noches

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

    // Calcular precio total automáticamente cuando cambian las fechas o el departamento
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

    // Cuando el usuario cambia la cantidad de noches, ajustar la fecha de check-out
    this.createForm.get('cantidadNoches')!.valueChanges.subscribe((nights: number | null) => {
      this.onNightsChange(nights);
    });

    // Detectar si el usuario modificó manualmente el check-out
    this.createForm.get('fechaCheckOut')!.valueChanges.subscribe(() => {
      this.userModifiedCheckOut = true;
    });

    // Detectar si el usuario modificó manualmente las noches
    this.createForm.get('cantidadNoches')!.valueChanges.subscribe(() => {
      this.userModifiedNights = true;
    });
  }

  /**
   * Cuando el usuario cambia la cantidad de noches, ajustar la fecha de check-out.
   * Se suma la cantidad de noches a la fecha de check-in.
   */
  onNightsChange(nights: number | null): void {
    if (!this.userModifiedNights) return; // Solo si fue el usuario quien cambió las noches manualmente
    const checkIn = this.createForm.get('fechaCheckIn')?.value;
    if (!checkIn || !nights || nights < 1) return;

    const dateIn = new Date(checkIn);
    const dateOut = new Date(dateIn);
    dateOut.setDate(dateOut.getDate() + nights);

    this.createForm.get('fechaCheckOut')?.setValue(dateOut.toISOString().slice(0, 10), { emitEvent: false });
    this.userModifiedCheckOut = false;
    this.userModifiedNights = false;
  }

  /**
   * Devuelve la fecha mínima para el check-out (día después del check-in).
   */
  getCheckOutMinDate(): string {
    const checkIn = this.createForm.get('fechaCheckIn')?.value;
    if (!checkIn) return '';
    const dateIn = new Date(checkIn);
    dateIn.setDate(dateIn.getDate() + 1);
    return dateIn.toISOString().slice(0, 10);
  }

  loadDepartments(): void {
    this.deptService.getMyDepartments().subscribe({
      next: (data) => { this.departments = data; },
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
        this.calculatedNights = null;
        this.calculatedTotal = null;
        this.userModifiedCheckOut = false;
        this.userModifiedNights = false;
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
   * Calcula automáticamente la cantidad de noches, precio total y señal
   * basado en el departamento seleccionado y las fechas.
   */
  calculateSmartPricing(): void {
    const deptId = this.createForm.get('departmentId')?.value;
    const checkIn = this.createForm.get('fechaCheckIn')?.value;
    const checkOut = this.createForm.get('fechaCheckOut')?.value;

    // Buscar el precio por noche del departamento seleccionado
    if (deptId) {
      const dept = this.departments.find(d => d.id === deptId);
      this.selectedDepartmentPrice = dept?.precioPorNoche ?? null;
    } else {
      this.selectedDepartmentPrice = null;
    }

    // Calcular cantidad de noches
    if (checkIn && checkOut) {
      const dateIn = new Date(checkIn);
      const dateOut = new Date(checkOut);
      const diffTime = dateOut.getTime() - dateIn.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      this.calculatedNights = diffDays > 0 ? diffDays : null;
      // Actualizar el campo cantidadNoches si no fue modificado manualmente por el usuario
      if (this.calculatedNights && !this.userModifiedCheckOut && !this.userModifiedNights) {
        this.createForm.get('cantidadNoches')?.setValue(this.calculatedNights, { emitEvent: false });
      }
    } else {
      this.calculatedNights = null;
    }

    // Calcular precio total = precio por noche × cantidad de noches
    if (this.selectedDepartmentPrice && this.calculatedNights) {
      this.calculatedTotal = this.selectedDepartmentPrice * this.calculatedNights;
      // Si el usuario no ha modificado manualmente el precio total, lo prellenamos
      if (this.createForm.get('precioTotal')?.value == null) {
        this.createForm.get('precioTotal')?.setValue(this.calculatedTotal, { emitEvent: false });
      }
      // La señal por defecto es el precio por noche
      if (this.createForm.get('montoSenia')?.value == null) {
        this.createForm.get('montoSenia')?.setValue(this.selectedDepartmentPrice, { emitEvent: false });
      }
    } else {
      this.calculatedTotal = null;
    }
  }

  closeErrorModal(): void {
    this.showErrorModal = false;
    this.errorMessage = '';
  }

  onAutoFill(): void {
    const data = this.autoFill.autoFillReservation();
    this.createForm.patchValue(data);

    // Seleccionar un departamento aleatorio si hay departamentos disponibles
    if (this.departments.length > 0) {
      const randomDept = this.departments[Math.floor(Math.random() * this.departments.length)];
      this.createForm.get('departmentId')?.setValue(randomDept.id, { emitEvent: true });
      // emitEvent: true dispara calculateSmartPricing() que calcula noches, precio total y seña
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
