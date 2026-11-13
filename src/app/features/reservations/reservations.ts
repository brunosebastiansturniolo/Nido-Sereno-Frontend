import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ReservationService } from '../../services/reservation.service';
import { ReservationRequest, ReservationResponse } from '../../models/reservation.models';
import { DepartmentService } from '../../services/department.service';
import { DepartmentResponse } from '../../models/department.models';

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reservations.html',
  styleUrl: './reservations.css'
})
export class ReservationsComponent implements OnInit {
  private resService = inject(ReservationService);
  private deptService = inject(DepartmentService);
  private fb = inject(FormBuilder);

  reservations: ReservationResponse[] = [];
  departments: DepartmentResponse[] = [];
  loading = false;
  error = '';
  success = '';

  createForm!: FormGroup;

  ngOnInit(): void {
    this.loadReservations();
    this.loadDepartments();
    this.createForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.maxLength(50)]],
      documentNumber: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(20)]],
      phoneNumber: ['', [Validators.required]],
      cantidadPersonas: [1, [Validators.required, Validators.min(1)]],
      cantidadVehiculos: [0, [Validators.required, Validators.min(0)]],
      fechaCheckIn: ['', [Validators.required]],
      fechaCheckOut: ['', [Validators.required]],
      departmentId: [null, [Validators.required]],
      precioTotal: [0, [Validators.required, Validators.min(0)]],
      montoSenia: [0, [Validators.required, Validators.min(0)]]
    });
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
      cantidadVehiculos: formValue.cantidadVehiculos,
      fechaCheckIn: formValue.fechaCheckIn,
      fechaCheckOut: formValue.fechaCheckOut,
      departmentId: formValue.departmentId,
      precioTotal: formValue.precioTotal,
      montoSenia: formValue.montoSenia
    };
    this.error = '';
    this.success = '';
    this.resService.createReservation(request).subscribe({
      next: () => {
        this.success = 'Reserva creada exitosamente.';
        this.createForm.reset({
          cantidadPersonas: 1,
          cantidadVehiculos: 0,
          precioTotal: 0,
          montoSenia: 0
        });
        this.loadReservations();
      },
      error: (err) => {
        this.error = err.error?.message || 'Error al crear la reserva.';
        console.error(err);
      }
    });
  }

  onCancel(id: number): void {
    if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;
    this.resService.cancelReservation(id).subscribe({
      next: () => this.loadReservations(),
      error: (err) => console.error(err)
    });
  }
}
