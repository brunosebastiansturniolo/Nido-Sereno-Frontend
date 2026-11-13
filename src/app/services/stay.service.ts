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

  getMyStays(): Observable<StayResponse[]> {
    return this.http.get<StayResponse[]>(`${this.baseUrl}/myStays`);
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

  checkIn(id: number, request: CheckInRequest): Observable<StayResponse> {
    return this.http.patch<StayResponse>(`${this.baseUrl}/${id}/check-in`, request);
  }

  finalizeStay(id: number, request: StayFinalizationRequest): Observable<StayResponse> {
    return this.http.patch<StayResponse>(`${this.baseUrl}/${id}/finalize`, request);
  }
}
