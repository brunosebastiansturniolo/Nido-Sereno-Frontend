export interface TenantRequest {
  documentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth?: string;
}

export interface TenantResponse {
  id: number;
  documentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  averageScore?: number;
}

export interface ClassificationResponse {
  id: number;
  score: number;
  reviewComment?: string;
  date: string;
  stayId?: number;
  tenantName?: string;
}
