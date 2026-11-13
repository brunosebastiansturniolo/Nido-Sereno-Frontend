import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { TenantRequest, TenantResponse } from '../models/tenant.models';

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/tenants`;

  getMyTenants(): Observable<TenantResponse[]> {
    return this.http.get<TenantResponse[]>(this.baseUrl);
  }

  getTenantById(id: number): Observable<TenantResponse> {
    return this.http.get<TenantResponse>(`${this.baseUrl}/${id}`);
  }

  createTenant(request: TenantRequest): Observable<TenantResponse> {
    return this.http.post<TenantResponse>(this.baseUrl, request);
  }
}
