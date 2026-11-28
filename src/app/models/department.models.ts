export type DepositCalculationBase = 'RESERVATION_TOTAL' | 'NIGHT_PRICE';

export interface DepartmentRequest {
  nombre: string;
  numeroHabitaciones: number;
  precioPorNoche: number;
  porcentajeSeniaRequerida: number;
  baseCalculoSenia: DepositCalculationBase;
  tamañoM2: number;
  incluyeCochera: boolean;
  incluyeDesayuno: boolean;
  tieneCocina: boolean;
  tieneWifi: boolean;
  tienePileta: boolean;
  complexId: number;
}

export interface DepartmentResponse {
  id: number;
  nombre: string;
  numeroHabitaciones: number;
  precioPorNoche: number;
  porcentajeSeniaRequerida: number;
  baseCalculoSenia: DepositCalculationBase;
  tamañoM2: number;
  incluyeCochera: boolean;
  incluyeDesayuno: boolean;
  tieneCocina: boolean;
  tieneWifi: boolean;
  tienePileta: boolean;
  disponible: boolean;
  pausado: boolean;
  complexId: number;
  complexNombre: string;
}
