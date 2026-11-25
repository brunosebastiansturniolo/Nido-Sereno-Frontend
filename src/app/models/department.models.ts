export interface DepartmentRequest {
  nombre: string;
  numeroHabitaciones: number;
  precioPorNoche: number;
  montoSeniaRequerida: number;
  tamañoM2: number;
  incluyeCochera: boolean;
  incluyeDesayuno: boolean;
  tieneWifi: boolean;
  tienePileta: boolean;
  complexId: number;
}

export interface DepartmentResponse {
  id: number;
  nombre: string;
  numeroHabitaciones: number;
  precioPorNoche: number;
  montoSeniaRequerida: number;
  tamañoM2: number;
  incluyeCochera: boolean;
  incluyeDesayuno: boolean;
  tieneWifi: boolean;
  tienePileta: boolean;
  disponible: boolean;
  complexId: number;
  complejoNombre: string;
}
