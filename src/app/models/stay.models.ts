import { TenantRequest } from '../models/tenant.models';

export interface CheckInRequest {
  reservationId: number;
  fechaHoraCheckInReal: string;
  comentariosCheckIn?: string;
  montoPagadoEnCheckIn?: number;
  tenants: TenantRequest[];
}

export interface StayRequest {
  reservationId?: number;
  departmentId?: number;
  fechaHoraCheckInReal: string;
  fechaCheckOutPlaneada?: string;
  fechaHoraCheckOutPlaneada?: string;
  cantidadPersonas?: number;
  cantidadVehiculos?: number;
  precioTotal?: number;
  montoSenia?: number;
  comentariosCheckIn?: string;
  tenants: TenantRequest[];
  reservanteFirstName?: string;
  reservanteLastName?: string;
}

export interface StayResponse {
  id: number;
  fechaHoraCheckInReal?: string | null;
  fechaHoraCheckOutReal?: string;
  fechaCheckInPlaneada?: string;
  fechaCheckOutPlaneada?: string;
  fechaHoraCheckOutPlaneada?: string;
  comentariosCheckIn?: string;
  comentariosCheckOut?: string;
  estadoDepartamento?: string;
  status: string; // 'PENDING', 'IN_PROGRESS' o 'COMPLETED'
  reservationId?: number;
  reservanteFirstName?: string;
  reservanteLastName?: string;
  departmentId: number;
  departamentoNombre?: string;
  precioTotalReserva?: number | null;
  montoPagadoReserva?: number | null;
  cantidadNoches?: number;
  tenants?: any[];
  classificationScore?: number;
  classificationReviewComment?: string;
}

export interface StayFinalizationRequest {
  fechaHoraCheckOutReal: string;
  comentariosCheckOut?: string;
  estadoDepartamento: 'GOOD' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE' | 'CLEANING_REQUIRED';
  montoPagadoEnCheckOut?: number;
  classificationScore?: number;
  classificationReviewComment?: string;
}

export interface RetroactiveStayRequest {
  departmentId: number;
  fechaCheckIn: string;
  fechaCheckOut: string;
  cantidadPersonas: number;
  cantidadVehiculos?: number;
  precioTotal?: number;
  montoSenia?: number;
  comentariosCheckIn?: string;
  tenants: TenantRequest[];
  reservanteFirstName?: string;
  reservanteLastName?: string;
  classificationScore?: number;
  classificationReviewComment?: string;
}
