// Modelos in-memory para el tutorial — espejo de los modelos reales pero con IDs auto-incrementales

export interface TutorialComplex {
  id: number;
  nombre: string;
  ubicacion: string;
  descripcion: string;
}

export interface TutorialDepartment {
  id: number;
  nombre: string;
  numeroHabitaciones: number;
  precioPorNoche: number;
  tamanoM2: number;
  incluyeCochera: boolean;
  incluyeDesayuno: boolean;
  tieneWifi: boolean;
  tienePileta: boolean;
  disponible: boolean;
  complexId: number;
  complejoNombre: string;
}

export interface TutorialReservation {
  id: number;
  firstName: string;
  lastName: string;
  documentNumber: string;
  cantidadPersonas: number;
  fechaCheckIn: string;
  fechaCheckOut: string;
  cantidadVehiculos: number;
  phoneNumber: string;
  estado: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED';
  precioTotal: number;
  montoSenia: number;
  cantidadNoches: number;
  departmentId: number;
  departamentoNombre: string;
}

export interface TutorialTenant {
  id: number;
  documentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  averageScore: number | null;
}

export interface TutorialStay {
  id: number;
  fechaHoraCheckInReal: string;
  fechaHoraCheckOutReal: string | null;
  fechaCheckOutPlaneada: string;
  comentariosCheckIn: string;
  comentariosCheckOut: string;
  estadoDepartamento: string | null;
  status: 'ACTIVE' | 'COMPLETED';
  reservationId: number | null;
  departmentId: number;
  departamentoNombre: string;
  cantidadNoches: number;
  tenants: TutorialTenant[];
  classificationScore: number | null;
  classificationReviewComment: string | null;
}

export interface TutorialClassification {
  id: number;
  score: number;
  reviewComment: string;
  date: string;
  stayId: number;
  tenantName: string;
}
