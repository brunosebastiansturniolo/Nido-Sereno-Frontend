import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { StayService } from '../../services/stay.service';
import { StayResponse, StayRequest, StayFinalizationRequest, CheckInRequest } from '../../models/stay.models';
import { TenantRequest, TenantSearchResponse } from '../../models/tenant.models';
import { ReservationService } from '../../services/reservation.service';
import { ReservationResponse } from '../../models/reservation.models';
import { DepartmentService } from '../../services/department.service';
import { DepartmentResponse } from '../../models/department.models';
import { TenantService } from '../../services/tenant.service';
import { debounceTime, distinctUntilChanged, switchMap, tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

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
  private tenantService = inject(TenantService);
  private fb = inject(FormBuilder);

  stays: StayResponse[] = [];
  reservations: ReservationResponse[] = [];
  departments: DepartmentResponse[] = [];
  loading = false;
  error = '';
  success = '';
  checkoutStayId: number | null = null;

  // Mapa de inquilinos encontrados por DNI, claveado por índice de tenant
  // Ej: { 0: TenantSearchResponse, 2: TenantSearchResponse }
  foundTenants: { [key: number]: TenantSearchResponse } = {};
  searchingTenants: { [key: number]: boolean } = {};

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
      comentariosCheckOut: [''],
      estadoDepartamento: ['GOOD', [Validators.required]],
      classificationScore: [null],
      classificationReviewComment: ['']
    });

    // Inicializar búsqueda por DNI para los tenants iniciales
    this.onDocumentNumberChange(this.expressTenants, 0);
    this.onDocumentNumberChange(this.existingTenants, 0);
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
    const newIndex = this.expressTenants.length;
    this.expressTenants.push(this.createTenant());
    this.onDocumentNumberChange(this.expressTenants, newIndex);
  }

  removeTenantExpress(index: number): void {
    if (this.expressTenants.length > 1) {
      delete this.foundTenants[index];
      delete this.searchingTenants[index];
      this.expressTenants.removeAt(index);
    }
  }

  addTenantExisting(): void {
    const newIndex = this.existingTenants.length;
    this.existingTenants.push(this.createTenant());
    this.onDocumentNumberChange(this.existingTenants, newIndex);
  }

  removeTenantExisting(index: number): void {
    if (this.existingTenants.length > 1) {
      delete this.foundTenants[index];
      delete this.searchingTenants[index];
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
        this.error = this.extractErrorMessage(err);
        console.error(err);
      }
    });
  }

  onCheckInFromReservation(): void {
    if (this.existingForm.invalid) return;
    const formValue = this.existingForm.value;
    const request: CheckInRequest = {
      reservationId: formValue.reservationId,
      fechaHoraCheckInReal: formValue.fechaHoraCheckInReal,
      comentariosCheckIn: formValue.comentariosCheckIn,
      tenants: formValue.tenants as TenantRequest[]
    };
    this.error = '';
    this.success = '';
    this.stayService.checkInFromReservation(request).subscribe({
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
        this.error = this.extractErrorMessage(err);
        console.error(err);
      }
    });
  }

  onCheckout(stayId: number): void {
    if (this.checkoutForm.invalid) return;
    const formValue = this.checkoutForm.value;

    // La clasificación es opcional: solo se envía si hay puntuación
    const request: StayFinalizationRequest = {
      fechaHoraCheckOutReal: formValue.fechaHoraCheckOutReal,
      comentariosCheckOut: formValue.comentariosCheckOut,
      estadoDepartamento: formValue.estadoDepartamento,
      classificationScore: formValue.classificationScore,
      classificationReviewComment: formValue.classificationScore ? formValue.classificationReviewComment : undefined
    };
    this.error = '';
    this.success = '';
    this.stayService.finalizeStay(stayId, request).subscribe({
      next: () => {
        this.success = 'Check-out realizado exitosamente.';
        this.checkoutForm.reset({
          fechaHoraCheckOutReal: new Date().toISOString().slice(0, 16),
          estadoDepartamento: 'GOOD'
        });
        this.loadStays();
      },
      error: (err) => {
        this.error = this.extractErrorMessage(err);
        console.error(err);
      }
    });
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

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // ----------------------------------------------------------------------
  // Búsqueda de inquilino existente por DNI
  // ----------------------------------------------------------------------

  /**
   * Se llama cuando el usuario escribe en el campo DNI de un inquilino.
   * Usa debounce para no hacer demasiadas consultas.
   */
  onDocumentNumberChange(formArray: FormArray, index: number): void {
    const tenantControl = formArray.at(index) as FormGroup;
    const docControl = tenantControl.get('documentNumber');

    // Limpiar resultado anterior
    delete this.foundTenants[index];

    docControl?.valueChanges.pipe(
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
            // Error: inquilino no encontrado (404)
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
