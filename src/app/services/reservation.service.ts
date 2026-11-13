import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { ReservationRequest, ReservationResponse } from '../models/reservation.models';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/reservations`;

  getMyReservations(
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
    return this.http.get<ReservationResponse[]>(this.baseUrl, { params });
  }

  getReservationById(id: number): Observable<ReservationResponse> {
    return this.http.get<ReservationResponse>(`${this.baseUrl}/${id}`);
  }

  createReservation(request: ReservationRequest): Observable<ReservationResponse> {
    return this.http.post<ReservationResponse>(this.baseUrl, request);
  }

  updateReservation(id: number, request: ReservationRequest): Observable<ReservationResponse> {
    return this.http.put<ReservationResponse>(`${this.baseUrl}/${id}`, request);
  }

  cancelReservation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
