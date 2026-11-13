import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { ComplexService } from '../../services/complex.service';
import { ComplexRequest, ComplexResponse } from '../../models/complex.models';

@Component({
  selector: 'app-complexes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './complexes.html',
  styleUrl: './complexes.css'
})
export class ComplexesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private complexService = inject(ComplexService);

  complexes: ComplexResponse[] = [];
  loading = false;

  createForm = this.fb.group({
    nombre: [''],
    ubicacion: [''],
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
    this.complexService.createComplex(request).subscribe({
      next: () => {
        this.loadComplexs();
        this.createForm.reset();
      },
      error: (err) => console.error(err)
    });
  }
}
