import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { AdminStatistics, ComplexStatistics } from '../models/admin.models';
import { ComplexResponse } from '../models/complex.models';
import { ReservationResponse } from '../models/reservation.models';
import { StayResponse } from '../models/stay.models';
import { TenantResponse } from '../models/tenant.models';
import { DepartmentResponse } from '../models/department.models';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/admin`;

  getAllComplexes(): Observable<ComplexResponse[]> {
    return this.http.get<ComplexResponse[]>(`${this.baseUrl}/complexes`);
  }

  getAllReservations(
    startDate?: string,
    endDate?: string,
    documentNumber?: string,
    name?: string
  ): Observable<ReservationResponse[]> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (documentNumber) params.documentNumber = documentNumber;
    if (name) params.name = name;
    return this.http.get<ReservationResponse[]>(`${this.baseUrl}/reservations`, { params });
  }

  getAllStays(
    documentNumber?: string,
    name?: string,
    active?: boolean
  ): Observable<StayResponse[]> {
    const params: any = {};
    if (documentNumber) params.documentNumber = documentNumber;
    if (name) params.name = name;
    if (active !== undefined) params.active = active;
    return this.http.get<StayResponse[]>(`${this.baseUrl}/stays`, { params });
  }

  getAllTenants(
    documentNumber?: string,
    name?: string
  ): Observable<TenantResponse[]> {
    const params: any = {};
    if (documentNumber) params.documentNumber = documentNumber;
    if (name) params.name = name;
    return this.http.get<TenantResponse[]>(`${this.baseUrl}/tenants`, { params });
  }

  getAllDepartments(): Observable<DepartmentResponse[]> {
    return this.http.get<DepartmentResponse[]>(`${this.baseUrl}/departments`);
  }

  getStatistics(): Observable<AdminStatistics> {
    return this.http.get<AdminStatistics>(`${this.baseUrl}/statistics`);
  }

  getComplexStatistics(): Observable<ComplexStatistics[]> {
    return this.http.get<ComplexStatistics[]>(`${this.baseUrl}/statistics/complexes`);
  }

  promoteToSuperAdmin(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/promote-super-admin`, { email });
  }
}
