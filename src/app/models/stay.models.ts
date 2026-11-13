import { TenantRequest } from '../models/tenant.models';

export interface CheckInRequest {
  reservationId: number;
  fechaHoraCheckInReal: string;
  comentariosCheckIn?: string;
  tenants: TenantRequest[];
}

export interface StayRequest {
  reservationId?: number;
  departmentId?: number;
  fechaHoraCheckInReal: string;
  fechaCheckOutPlaneada?: string;
  cantidadPersonas?: number;
  cantidadVehiculos?: number;
  comentariosCheckIn?: string;
  tenants: TenantRequest[];
  reservanteFirstName?: string;
  reservanteLastName?: string;
}

export interface StayResponse {
  id: number;
  fechaHoraCheckInReal: string;
  fechaHoraCheckOutReal?: string;
  comentariosCheckIn?: string;
  comentariosCheckOut?: string;
  estado: string;
  reservationId?: number;
  departmentId: number;
  departamentoNombre?: string;
  tenants?: any[];
}

export interface StayFinalizationRequest {
  fechaHoraCheckOutReal: string;
  comentariosCheckOut?: string;
}
