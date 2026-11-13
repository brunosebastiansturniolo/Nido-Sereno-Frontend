import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { ComplexRequest, ComplexResponse } from '../models/complex.models';

@Injectable({
  providedIn: 'root'
})
export class ComplexService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/complexs`;

  getMyComplexs(): Observable<ComplexResponse[]> {
    return this.http.get<ComplexResponse[]>(`${this.baseUrl}/myComplexs`);
  }

  getAllComplexs(): Observable<ComplexResponse[]> {
    return this.http.get<ComplexResponse[]>(`${this.baseUrl}/listAll`);
  }

  createComplex(request: ComplexRequest): Observable<ComplexResponse> {
    return this.http.post<ComplexResponse>(this.baseUrl, request);
  }
}
