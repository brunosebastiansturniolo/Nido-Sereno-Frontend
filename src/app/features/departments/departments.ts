import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DepartmentService } from '../../services/department.service';
import { ComplexService } from '../../services/complex.service';
import { AutoFillService } from '../../services/auto-fill.service';
import { DepartmentRequest, DepartmentResponse, DepositCalculationBase } from '../../models/department.models';
import { ComplexResponse } from '../../models/complex.models';
import { ReservationResponse } from '../../models/reservation.models';
import { ErrorModalComponent } from '../../shared/error-modal/error-modal';
import { ReservationService } from '../../services/reservation.service';
import { StayService } from '../../services/stay.service';
import { DateControllerService } from '../../services/date-controller.service';

type DepartmentFilter = 'AVAILABLE' | 'KITCHEN' | 'PAUSED';

@Component({
  selector: 'app-departments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ErrorModalComponent, RouterLink],
  templateUrl: './departments.html',
  styleUrl: './departments.css'
})
export class DepartmentsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private deptService = inject(DepartmentService);
  private complexService = inject(ComplexService);
  private autoFill = inject(AutoFillService);
  private reservationService = inject(ReservationService);
  private stayService = inject(StayService);
  private dateCtrl = inject(DateControllerService);

  departments: DepartmentResponse[] = [];
  complexes: ComplexResponse[] = [];
  reservations: ReservationResponse[] = [];
  activeDepartmentIds = new Set<number>();
  selectedDepartmentFilter: DepartmentFilter | null = null;
  selectedComplexIds = new Set<number>();
  allDepartmentsSelected = true;
  loading = false;
  error = '';
  success = '';
  showErrorModal = false;
  errorMessage = '';
  editingDepartmentId: number | null = null;
  showPauseConfirmation = false;
  pauseTarget: DepartmentResponse | null = null;
  upcomingReservations: ReservationResponse[] = [];
  departmentActionInProgressId: number | null = null;

  get noComplexes(): boolean {
    return this.complexes.length === 0;
  }

  get filteredDepartments(): DepartmentResponse[] {
    return this.departments.filter(department => {
      const matchesComplex = this.selectedComplexIds.size === 0 || this.selectedComplexIds.has(department.complexId);
      const matchesFilter = this.selectedDepartmentFilter === 'AVAILABLE'
        ? department.disponible && !department.pausado
        : this.selectedDepartmentFilter === 'KITCHEN'
          ? department.tieneCocina
          : this.selectedDepartmentFilter === 'PAUSED'
            ? department.pausado
            : true;
      return matchesComplex && matchesFilter;
    });
  }

  get isAllDepartmentsSelected(): boolean {
    return this.allDepartmentsSelected;
  }

  createForm = this.fb.group({
    nombre: ['', Validators.required],
    numeroHabitaciones: [null, Validators.required],
    precioPorNoche: [null, [Validators.required, Validators.min(0.01)]],
    porcentajeSeniaRequerida: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    montoSeniaRequerida: [0, [Validators.min(0)]],
    baseCalculoSenia: ['RESERVATION_TOTAL', Validators.required],
    tamañoM2: [null, Validators.required],
    incluyeCochera: [false],
    incluyeDesayuno: [false],
    tieneCocina: [false],
    tieneWifi: [false],
    tienePileta: [false],
    complexId: [null, Validators.required]
  }, { validators: this.validateNightDepositAmount });

  ngOnInit(): void {
    this.loadDepartments();
    this.loadComplexes();
    this.loadReservations();
    this.loadActiveStays();
    this.createForm.get('baseCalculoSenia')?.valueChanges.subscribe(base => {
      this.onDepositBaseChange(base as DepositCalculationBase);
    });
    this.createForm.get('montoSeniaRequerida')?.valueChanges.subscribe(() => {
      this.updateNightDepositPercentage();
    });
    this.createForm.get('precioPorNoche')?.valueChanges.subscribe(() => {
      this.updateNightDepositPercentage();
    });
  }

  loadDepartments(): void {
    this.loading = true;
    this.deptService.getMyDepartments().subscribe({
      next: (data) => { this.departments = data; this.loading = false; },
      error: (err) => { console.error(err); this.loading = false; }
    });
  }

  loadComplexes(): void {
    this.complexService.getMyComplexs().subscribe({
      next: (data) => { this.complexes = data; },
      error: (err) => console.error(err)
    });
  }

  loadReservations(): void {
    this.reservationService.getMyReservations().subscribe({
      next: reservations => { this.reservations = reservations; },
      error: err => console.error(err)
    });
  }

  loadActiveStays(): void {
    this.stayService.getMyStays(undefined, undefined, true).subscribe({
      next: stays => {
        this.activeDepartmentIds = new Set(stays
          .filter(stay => stay.fechaHoraCheckInReal && !stay.fechaHoraCheckOutReal)
          .map(stay => stay.departmentId));
      },
      error: err => console.error(err)
    });
  }

  selectDepartmentFilter(filter: DepartmentFilter | 'ALL'): void {
    if (filter === 'ALL') {
      if (this.allDepartmentsSelected) {
        this.allDepartmentsSelected = false;
        return;
      }
      this.selectedDepartmentFilter = null;
      this.selectedComplexIds = new Set<number>();
      this.allDepartmentsSelected = true;
      return;
    }
    this.selectedDepartmentFilter = this.selectedDepartmentFilter === filter ? null : filter;
    this.allDepartmentsSelected = false;
  }

  toggleComplexFilter(complexId: number): void {
    const selected = new Set(this.selectedComplexIds);
    if (selected.has(complexId)) selected.delete(complexId);
    else selected.add(complexId);
    this.selectedComplexIds = selected;
    this.allDepartmentsSelected = false;
  }

  isDepartmentOccupied(department: DepartmentResponse): boolean {
    return this.activeDepartmentIds.has(department.id);
  }

  openPauseConfirmation(department: DepartmentResponse): void {
    if (this.isDepartmentOccupied(department) || department.pausado) return;
    this.pauseTarget = department;
    this.upcomingReservations = this.reservations
      .filter(reservation => reservation.departmentId === department.id
        && reservation.fechaCheckIn >= this.dateCtrl.getDateStr()
        && !this.isCancelled(reservation)
        && !reservation.enEstadia)
      .sort((first, second) => first.fechaCheckIn.localeCompare(second.fechaCheckIn));
    this.showPauseConfirmation = true;
  }

  closePauseConfirmation(): void {
    if (this.departmentActionInProgressId !== null) return;
    this.showPauseConfirmation = false;
    this.pauseTarget = null;
    this.upcomingReservations = [];
  }

  confirmPause(): void {
    if (!this.pauseTarget || this.departmentActionInProgressId !== null) return;
    const department = this.pauseTarget;
    this.departmentActionInProgressId = department.id;
    this.deptService.pauseDepartment(department.id).subscribe({
      next: updatedDepartment => {
        this.departments = this.departments.map(item => item.id === updatedDepartment.id ? updatedDepartment : item);
        this.success = `Departamento "${department.nombre}" pausado.`;
        this.departmentActionInProgressId = null;
        this.closePauseConfirmation();
      },
      error: err => {
        this.errorMessage = this.extractErrorMessage(err);
        this.showErrorModal = true;
        this.departmentActionInProgressId = null;
        this.closePauseConfirmation();
      }
    });
  }

  resumeDepartment(department: DepartmentResponse): void {
    if (this.departmentActionInProgressId !== null) return;
    this.departmentActionInProgressId = department.id;
    this.deptService.resumeDepartment(department.id).subscribe({
      next: updatedDepartment => {
        this.departments = this.departments.map(item => item.id === updatedDepartment.id ? updatedDepartment : item);
        this.success = `Departamento "${department.nombre}" reactivado.`;
        this.departmentActionInProgressId = null;
      },
      error: err => {
        this.errorMessage = this.extractErrorMessage(err);
        this.showErrorModal = true;
        this.departmentActionInProgressId = null;
      }
    });
  }

  private isCancelled(reservation: ReservationResponse): boolean {
    return reservation.estado === 'CANCELED' || reservation.estado === 'CANCELLED';
  }

  onSubmit(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const formVal = this.createForm.value;
    const request: DepartmentRequest = {
      nombre: formVal.nombre || '',
      numeroHabitaciones: formVal.numeroHabitaciones || 0,
      precioPorNoche: formVal.precioPorNoche || 0,
      porcentajeSeniaRequerida: formVal.porcentajeSeniaRequerida ?? 0,
      baseCalculoSenia: (formVal.baseCalculoSenia || 'RESERVATION_TOTAL') as DepositCalculationBase,
      tamañoM2: formVal.tamañoM2 || 0,
      incluyeCochera: formVal.incluyeCochera || false,
      incluyeDesayuno: formVal.incluyeDesayuno || false,
      tieneCocina: formVal.tieneCocina || false,
      tieneWifi: formVal.tieneWifi || false,
      tienePileta: formVal.tienePileta || false,
      complexId: formVal.complexId || 0
    };
    this.error = '';
    this.success = '';
    const saveRequest = this.editingDepartmentId === null
      ? this.deptService.createDepartment(request)
      : this.deptService.updateDepartment(this.editingDepartmentId, request);

    saveRequest.subscribe({
      next: () => {
        this.success = this.editingDepartmentId === null
          ? 'Departamento creado exitosamente.'
          : 'Departamento actualizado exitosamente.';
        this.loadDepartments();
        this.cancelEdit();
      },
      error: (err) => {
        this.errorMessage = this.extractErrorMessage(err);
        this.showErrorModal = true;
        console.error(err);
      }
    });
  }

  onEdit(department: DepartmentResponse): void {
    this.editingDepartmentId = department.id;
    this.success = '';
    this.errorMessage = '';
    this.createForm.patchValue({
      nombre: department.nombre,
      numeroHabitaciones: department.numeroHabitaciones,
      precioPorNoche: department.precioPorNoche,
      porcentajeSeniaRequerida: department.porcentajeSeniaRequerida,
      baseCalculoSenia: department.baseCalculoSenia,
      montoSeniaRequerida: department.baseCalculoSenia === 'NIGHT_PRICE'
        ? department.precioPorNoche * department.porcentajeSeniaRequerida / 100
        : 0,
      tamañoM2: department.tamañoM2,
      incluyeCochera: department.incluyeCochera,
      incluyeDesayuno: department.incluyeDesayuno,
      tieneCocina: department.tieneCocina,
      tieneWifi: department.tieneWifi,
      tienePileta: department.tienePileta,
      complexId: department.complexId
    } as any);
    this.onDepositBaseChange(department.baseCalculoSenia);
  }

  cancelEdit(): void {
    this.editingDepartmentId = null;
    this.createForm.reset({
      nombre: '',
      numeroHabitaciones: null,
      precioPorNoche: null,
      porcentajeSeniaRequerida: 0,
      montoSeniaRequerida: 0,
      baseCalculoSenia: 'RESERVATION_TOTAL',
      tamañoM2: null,
      incluyeCochera: false,
      incluyeDesayuno: false,
      tieneCocina: false,
      tieneWifi: false,
      tienePileta: false,
      complexId: null
    });
  }

  onDelete(department: DepartmentResponse): void {
    const confirmed = window.confirm(
      `¿Querés eliminar el departamento "${department.nombre}"? Esta acción es permanente y solo se permite si no tiene reservas ni estadías asociadas.`
    );
    if (!confirmed) return;

    this.errorMessage = '';
    this.success = '';
    this.deptService.deleteDepartment(department.id).subscribe({
      next: () => {
        this.success = 'Departamento eliminado exitosamente.';
        if (this.editingDepartmentId === department.id) this.cancelEdit();
        this.loadDepartments();
      },
      error: (err) => {
        this.errorMessage = this.extractErrorMessage(err);
        this.showErrorModal = true;
      }
    });
  }

  closeErrorModal(): void {
    this.showErrorModal = false;
    this.errorMessage = '';
  }

  onAutoFill(): void {
    const data = this.autoFill.autoFillDepartment();
    this.createForm.patchValue({
      nombre: data.nombre,
      numeroHabitaciones: data.numeroHabitaciones,
      precioPorNoche: data.precioPorNoche,
      tamañoM2: data.tamañoM2,
      incluyeCochera: data.incluyeCochera,
      incluyeDesayuno: data.incluyeDesayuno,
      tieneCocina: data.tieneCocina,
      tieneWifi: data.tieneWifi,
      tienePileta: data.tienePileta
    } as any);
  }

  private onDepositBaseChange(base: DepositCalculationBase): void {
    const amountControl = this.createForm.get('montoSeniaRequerida');
    if (!amountControl) return;

    if (base === 'NIGHT_PRICE') {
      amountControl.setValidators([Validators.required, Validators.min(0)]);
      const priceValue = this.createForm.get('precioPorNoche')?.value;
      const percentageValue = this.createForm.get('porcentajeSeniaRequerida')?.value;
      const price = Number(priceValue);
      const percentage = Number(percentageValue);
      amountControl.setValue(
        priceValue !== null && percentageValue !== null && Number.isFinite(price) && price > 0 && Number.isFinite(percentage)
          ? price * percentage / 100
          : null,
        { emitEvent: false }
      );
    } else {
      amountControl.setValidators([Validators.min(0)]);
      amountControl.setValue(0, { emitEvent: false });
    }

    amountControl.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    this.createForm.updateValueAndValidity({ emitEvent: false });
  }

  private updateNightDepositPercentage(): void {
    if (this.createForm.get('baseCalculoSenia')?.value !== 'NIGHT_PRICE') return;

    const amountValue = this.createForm.get('montoSeniaRequerida')?.value;
    const priceValue = this.createForm.get('precioPorNoche')?.value;
    const amount = Number(amountValue);
    const price = Number(priceValue);
    const percentage = amountValue !== null && priceValue !== null && Number.isFinite(amount) && Number.isFinite(price) && price > 0
      ? amount / price * 100
      : null;

    this.createForm.get('porcentajeSeniaRequerida')?.setValue(percentage, { emitEvent: false });
  }

  private validateNightDepositAmount(group: AbstractControl): ValidationErrors | null {
    if (group.get('baseCalculoSenia')?.value !== 'NIGHT_PRICE') return null;

    const amountValue = group.get('montoSeniaRequerida')?.value;
    const nightPriceValue = group.get('precioPorNoche')?.value;
    if (amountValue === null || nightPriceValue === null) return null;

    const amount = Number(amountValue);
    const nightPrice = Number(nightPriceValue);
    if (!Number.isFinite(amount) || !Number.isFinite(nightPrice)) return null;

    return amount > nightPrice ? { nightDepositExceedsPrice: true } : null;
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
}
