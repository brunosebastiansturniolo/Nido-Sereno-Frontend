export interface ComplexRequest {
  nombre: string;
  ubicacion: string;
  descripcion?: string;
}

export interface ComplexResponse {
  id: number;
  nombre: string;
  ubicacion: string;
  descripcion: string;
}
