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

  getMyTenants(
    documentNumber?: string,
    name?: string
  ): Observable<TenantResponse[]> {
    const params: any = {};
    if (documentNumber) params.documentNumber = documentNumber;
    if (name) params.name = name;
    return this.http.get<TenantResponse[]>(this.baseUrl, { params });
  }

  getTenantById(id: number): Observable<TenantResponse> {
    return this.http.get<TenantResponse>(`${this.baseUrl}/${id}`);
  }

  getTenantByDocumentNumber(documentNumber: string): Observable<TenantResponse> {
    return this.http.get<TenantResponse>(`${this.baseUrl}/document/${documentNumber}`);
  }
}
