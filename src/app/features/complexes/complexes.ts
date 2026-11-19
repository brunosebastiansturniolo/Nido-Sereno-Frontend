import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ComplexService } from '../../services/complex.service';
import { AutoFillService } from '../../services/auto-fill.service';
import { ComplexRequest, ComplexResponse } from '../../models/complex.models';
import { ErrorModalComponent } from '../../shared/error-modal/error-modal';

@Component({
  selector: 'app-complexes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ErrorModalComponent],
  templateUrl: './complexes.html',
  styleUrl: './complexes.css'
})
export class ComplexesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private complexService = inject(ComplexService);
  private autoFill = inject(AutoFillService);

  complexes: ComplexResponse[] = [];
  loading = false;
  error = '';
  success = '';
  showErrorModal = false;
  errorMessage = '';

  createForm = this.fb.group({
    nombre: ['', Validators.required],
    ubicacion: ['', Validators.required],
    descripcion: ['']
  });

  ngOnInit(): void {
    this.loadComplexs();
  }

  loadComplexs(): void {
    this.loading = true;
    this.complexService.getMyComplexs().subscribe({
      next: (data) => {
        this.complexes = data;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  onCreate(): void {
    const request: ComplexRequest = this.createForm.value as ComplexRequest;
    this.error = '';
    this.success = '';
    this.complexService.createComplex(request).subscribe({
      next: () => {
        this.success = 'Complejo creado exitosamente.';
        this.loadComplexs();
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

  onAutoFill(): void {
    const data = this.autoFill.autoFillComplex();
    this.createForm.patchValue(data);
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
