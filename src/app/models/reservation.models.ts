export interface ReservationRequest {
  firstName: string;
  lastName: string;
  documentNumber: string;
  cantidadPersonas: number;
  fechaCheckIn: string;
  fechaCheckOut: string;
  cantidadVehiculos: number;
  phoneNumber: string;
  departmentId: number;
  precioTotal: number;
  montoSenia: number;
}

export interface ReservationResponse {
  id: number;
  firstName: string;
  lastName: string;
  documentNumber: string;
  cantidadPersonas: number;
  fechaCheckIn: string;
  fechaCheckOut: string;
  cantidadVehiculos: number;
  phoneNumber: string;
  estado: string;
  precioTotal: number;
  montoSenia: number;
  departmentId: number;
  departamentoNombre: string;
}
