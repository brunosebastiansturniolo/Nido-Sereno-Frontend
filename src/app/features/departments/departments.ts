import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { DepartmentService } from '../../services/department.service';
import { ComplexService } from '../../services/complex.service';
import { DepartmentRequest, DepartmentResponse } from '../../models/department.models';
import { ComplexResponse } from '../../models/complex.models';

@Component({
  selector: 'app-departments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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

  createForm = this.fb.group({
    nombre: [''],
    numeroPiezas: [0],
    precioPorNoche: [0],
    tamañoM2: [0],
    incluyeCochera: [false],
    incluyeDesayuno: [false],
    tieneWifi: [false],
    tienePileta: [false],
    complexId: [0]
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
    const request: DepartmentRequest = this.createForm.value as DepartmentRequest;
    this.deptService.createDepartment(request).subscribe({
      next: () => { this.loadDepartments(); this.createForm.reset(); },
      error: (err) => console.error(err)
    });
  }
}
