import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DepartmentService } from '../../services/department.service';
import { ComplexService } from '../../services/complex.service';
import { DepartmentRequest, DepartmentResponse } from '../../models/department.models';
import { ComplexResponse } from '../../models/complex.models';
import { ErrorModalComponent } from '../../shared/error-modal/error-modal';

@Component({
  selector: 'app-departments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ErrorModalComponent],
  templateUrl: './departments.html',
  styleUrl: './departments.css'
})
export class DepartmentsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private deptService = inject(DepartmentService);
  private complexService = inject(ComplexService);

  departments: DepartmentResponse[] = [];
  complexes: ComplexResponse[] = [];
  loading = false;
  error = '';
  success = '';
  showErrorModal = false;
  errorMessage = '';

  createForm = this.fb.group({
    nombre: ['', Validators.required],
    numeroHabitaciones: [null, Validators.required],
    precioPorNoche: [null, Validators.required],
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

  onCreate(): void {
    const formVal = this.createForm.value;
    const request: DepartmentRequest = {
      nombre: formVal.nombre || '',
      numeroHabitaciones: formVal.numeroHabitaciones || 0,
      precioPorNoche: formVal.precioPorNoche || 0,
      tamañoM2: formVal.tamañoM2 || 0,
      incluyeCochera: formVal.incluyeCochera || false,
      incluyeDesayuno: formVal.incluyeDesayuno || false,
      tieneWifi: formVal.tieneWifi || false,
      tienePileta: formVal.tienePileta || false,
      complexId: formVal.complexId || 0
    };
    this.error = '';
    this.success = '';
    this.deptService.createDepartment(request).subscribe({
      next: () => {
        this.success = 'Departamento creado exitosamente.';
        this.loadDepartments();
        this.createForm.reset();
      },
      error: (err) => {
        this.errorMessage = this.extractErrorMessage(err);
        this.showErrorModal = true;
        console.error(err);
      }
    });
  }

  closeErrorModal(): void {
    this.showErrorModal = false;
    this.errorMessage = '';
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
