import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { ClassificationResponse, TenantRequest, TenantResponse, TenantSearchResponse } from '../models/tenant.models';

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

  /**
   * Busca un inquilino por DNI con contexto del owner.
   * Devuelve datos del inquilino, nota promedio y los complejos del owner
   * donde se ha alojado previamente.
   */
  searchTenantByDocumentNumber(documentNumber: string): Observable<TenantSearchResponse> {
    return this.http.get<TenantSearchResponse>(`${this.baseUrl}/search/document/${documentNumber}`);
  }

  getTenantClassifications(id: number): Observable<ClassificationResponse[]> {
    return this.http.get<ClassificationResponse[]>(`${this.baseUrl}/${id}/classifications`);
  }
}
