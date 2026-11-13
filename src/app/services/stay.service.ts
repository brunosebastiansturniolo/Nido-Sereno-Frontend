import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { StayRequest, StayResponse, CheckInRequest, StayFinalizationRequest } from '../models/stay.models';

@Injectable({
  providedIn: 'root'
})
export class StayService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/stays`;

  getMyStays(
    documentNumber?: string,
    name?: string,
    active?: boolean
  ): Observable<StayResponse[]> {
    const params: any = {};
    if (documentNumber) params.documentNumber = documentNumber;
    if (name) params.name = name;
    if (active !== undefined) params.active = active;
    return this.http.get<StayResponse[]>(this.baseUrl, { params });
  }

  getStayById(id: number): Observable<StayResponse> {
    return this.http.get<StayResponse>(`${this.baseUrl}/${id}`);
  }

  createStay(request: StayRequest): Observable<StayResponse> {
    return this.http.post<StayResponse>(this.baseUrl, request);
  }

  updateStay(id: number, request: StayRequest): Observable<StayResponse> {
    return this.http.put<StayResponse>(`${this.baseUrl}/${id}`, request);
  }

  checkInFromReservation(request: CheckInRequest): Observable<StayResponse> {
    return this.http.post<StayResponse>(`${this.baseUrl}/checkin`, request);
  }

  finalizeStay(id: number, request: StayFinalizationRequest): Observable<StayResponse> {
    return this.http.patch<StayResponse>(`${this.baseUrl}/${id}/checkout`, request);
  }

  deleteStay(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
