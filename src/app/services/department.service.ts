import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { DepartmentRequest, DepartmentResponse } from '../models/department.models';

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/departments`;

  getMyDepartments(): Observable<DepartmentResponse[]> {
    return this.http.get<DepartmentResponse[]>(this.baseUrl);
  }

  createDepartment(request: DepartmentRequest): Observable<DepartmentResponse> {
    return this.http.post<DepartmentResponse>(this.baseUrl, request);
  }

  updateDepartment(id: number, request: DepartmentRequest): Observable<DepartmentResponse> {
    return this.http.put<DepartmentResponse>(`${this.baseUrl}/${id}`, request);
  }

  pauseDepartment(id: number): Observable<DepartmentResponse> {
    return this.http.post<DepartmentResponse>(`${this.baseUrl}/${id}/pause`, null);
  }

  resumeDepartment(id: number): Observable<DepartmentResponse> {
    return this.http.delete<DepartmentResponse>(`${this.baseUrl}/${id}/pause`);
  }

  deleteDepartment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
