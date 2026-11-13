import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { StayService } from '../../services/stay.service';
import { StayResponse, StayRequest, StayFinalizationRequest } from '../../models/stay.models';
import { TenantRequest } from '../../models/tenant.models';
import { ReservationService } from '../../services/reservation.service';
import { ReservationResponse } from '../../models/reservation.models';
import { DepartmentService } from '../../services/department.service';
import { DepartmentResponse } from '../../models/department.models';

@Component({
  selector: 'app-stays',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './stays.html',
  styleUrl: './stays.css'
})
export class StaysComponent implements OnInit {
  private stayService = inject(StayService);
  private resService = inject(ReservationService);
  private deptService = inject(DepartmentService);
  private fb = inject(FormBuilder);

  stays: StayResponse[] = [];
  reservations: ReservationResponse[] = [];
  departments: DepartmentResponse[] = [];
  loading = false;
  error = '';
  success = '';

  // Mode: 'express' = check-in express, 'existing' = check-in desde reserva
  checkInMode = 'express';

  expressForm!: FormGroup;
  existingForm!: FormGroup;
  checkoutForm!: FormGroup;

  ngOnInit(): void {
    this.loadStays();
    this.loadReservations();
    this.loadDepartments();

    this.expressForm = this.fb.group({
      departmentId: [null, [Validators.required]],
      fechaHoraCheckInReal: [new Date().toISOString().slice(0, 16)],
      fechaCheckOutPlaneada: ['', [Validators.required]],
      cantidadPersonas: [1, [Validators.required, Validators.min(1)]],
      cantidadVehiculos: [0, [Validators.min(0)]],
      comentariosCheckIn: [''],
      tenants: this.fb.array([this.createTenant()])
    });

    this.existingForm = this.fb.group({
      reservationId: [null, [Validators.required]],
      fechaHoraCheckInReal: [new Date().toISOString().slice(0, 16)],
      comentariosCheckIn: [''],
      tenants: this.fb.array([this.createTenant()])
    });

    this.checkoutForm = this.fb.group({
      fechaHoraCheckOutReal: [new Date().toISOString().slice(0, 16)],
      comentariosCheckOut: ['']
    });
  }

  createTenant(): FormGroup {
    return this.fb.group({
      documentNumber: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(20)]],
      firstName: ['', [Validators.required, Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.maxLength(50)]],
      email: ['', [Validators.email]],
      phoneNumber: ['', [Validators.required]],
      dateOfBirth: ['']
    });
  }

  get expressTenants(): FormArray {
    return this.expressForm.get('tenants') as FormArray;
  }

  get existingTenants(): FormArray {
    return this.existingForm.get('tenants') as FormArray;
  }

  addTenantExpress(): void {
    this.expressTenants.push(this.createTenant());
  }

  removeTenantExpress(index: number): void {
    if (this.expressTenants.length > 1) {
      this.expressTenants.removeAt(index);
    }
  }

  addTenantExisting(): void {
    this.existingTenants.push(this.createTenant());
  }

  removeTenantExisting(index: number): void {
    if (this.existingTenants.length > 1) {
      this.existingTenants.removeAt(index);
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
        this.reservations = data.filter(r => r.estado === 'PENDING' || r.estado === 'CONFIRMED');
      },
      error: (err) => console.error(err)
    });
  }

  loadDepartments(): void {
    this.deptService.getMyDepartments().subscribe({
      next: (data) => { this.departments = data; },
      error: (err) => console.error(err)
    });
  }

  onCheckInExpress(): void {
    if (this.expressForm.invalid) return;
    const formValue = this.expressForm.value;
    const request: StayRequest = {
      departmentId: formValue.departmentId,
      fechaHoraCheckInReal: formValue.fechaHoraCheckInReal,
      fechaCheckOutPlaneada: formValue.fechaCheckOutPlaneada,
      cantidadPersonas: formValue.cantidadPersonas,
      cantidadVehiculos: formValue.cantidadVehiculos,
      comentariosCheckIn: formValue.comentariosCheckIn,
      tenants: formValue.tenants as TenantRequest[]
    };
    this.error = '';
    this.success = '';
    this.stayService.createStay(request).subscribe({
      next: () => {
        this.success = 'Check-in express realizado exitosamente.';
        this.expressForm.reset({
          fechaHoraCheckInReal: new Date().toISOString().slice(0, 16),
          cantidadPersonas: 1,
          cantidadVehiculos: 0
        });
        while (this.expressTenants.length > 1) this.expressTenants.removeAt(1);
        this.loadStays();
      },
      error: (err) => {
        this.error = err.error?.message || 'Error al realizar el check-in.';
        console.error(err);
      }
    });
  }

  onCheckInFromReservation(): void {
    if (this.existingForm.invalid) return;
    const formValue = this.existingForm.value;
    const request: StayRequest = {
      reservationId: formValue.reservationId,
      fechaHoraCheckInReal: formValue.fechaHoraCheckInReal,
      comentariosCheckIn: formValue.comentariosCheckIn,
      tenants: formValue.tenants as TenantRequest[]
    };
    this.error = '';
    this.success = '';
    this.stayService.createStay(request).subscribe({
      next: () => {
        this.success = 'Check-in realizado exitosamente.';
        this.existingForm.reset({
          fechaHoraCheckInReal: new Date().toISOString().slice(0, 16)
        });
        while (this.existingTenants.length > 1) this.existingTenants.removeAt(1);
        this.loadStays();
        this.loadReservations();
      },
      error: (err) => {
        this.error = err.error?.message || 'Error al realizar el check-in.';
        console.error(err);
      }
    });
  }

  onCheckout(stayId: number): void {
    if (this.checkoutForm.invalid) return;
    const formValue = this.checkoutForm.value;
    const request: StayFinalizationRequest = {
      fechaHoraCheckOutReal: formValue.fechaHoraCheckOutReal,
      comentariosCheckOut: formValue.comentariosCheckOut
    };
    this.error = '';
    this.success = '';
    this.stayService.finalizeStay(stayId, request).subscribe({
      next: () => {
        this.success = 'Check-out realizado exitosamente.';
        this.checkoutForm.reset({
          fechaHoraCheckOutReal: new Date().toISOString().slice(0, 16)
        });
        this.loadStays();
      },
      error: (err) => {
        this.error = err.error?.message || 'Error al realizar el check-out.';
        console.error(err);
      }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
