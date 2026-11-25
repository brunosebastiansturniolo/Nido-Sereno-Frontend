import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DepartmentService } from '../../services/department.service';
import { ComplexService } from '../../services/complex.service';
import { AutoFillService } from '../../services/auto-fill.service';
import { DepartmentRequest, DepartmentResponse, DepositCalculationBase } from '../../models/department.models';
import { ComplexResponse } from '../../models/complex.models';
import { ErrorModalComponent } from '../../shared/error-modal/error-modal';

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

  departments: DepartmentResponse[] = [];
  complexes: ComplexResponse[] = [];
  loading = false;
  error = '';
  success = '';
  showErrorModal = false;
  errorMessage = '';
  editingDepartmentId: number | null = null;

  get noComplexes(): boolean {
    return this.complexes.length === 0;
  }

  createForm = this.fb.group({
    nombre: ['', Validators.required],
    numeroHabitaciones: [null, Validators.required],
    precioPorNoche: [null, Validators.required],
    porcentajeSeniaRequerida: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    baseCalculoSenia: ['RESERVATION_TOTAL', Validators.required],
    tamañoM2: [null, Validators.required],
    incluyeCochera: [false],
    incluyeDesayuno: [false],
    tieneWifi: [false],
    tienePileta: [false],
    complexId: [null, Validators.required]
  });

  ngOnInit(): void {
    this.loadDepartments();
    this.loadComplexes();
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

  onSubmit(): void {
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
      tamañoM2: department.tamañoM2,
      incluyeCochera: department.incluyeCochera,
      incluyeDesayuno: department.incluyeDesayuno,
      tieneWifi: department.tieneWifi,
      tienePileta: department.tienePileta,
      complexId: department.complexId
    } as any);
  }

  cancelEdit(): void {
    this.editingDepartmentId = null;
    this.createForm.reset({
      nombre: '',
      numeroHabitaciones: null,
      precioPorNoche: null,
      porcentajeSeniaRequerida: 0,
      baseCalculoSenia: 'RESERVATION_TOTAL',
      tamañoM2: null,
      incluyeCochera: false,
      incluyeDesayuno: false,
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
      tieneWifi: data.tieneWifi,
      tienePileta: data.tienePileta
    } as any);
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
