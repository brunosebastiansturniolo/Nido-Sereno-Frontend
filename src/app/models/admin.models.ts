export interface AdminStatistics {
  totalComplexes: number;
  totalDepartments: number;
  totalReservations: number;
  totalStays: number;
  totalTenants: number;
  reservationsPending: number;
  reservationsConfirmed: number;
  reservationsCheckedIn: number;
  reservationsCompleted: number;
  reservationsCancelled: number;
  staysActive: number;
  staysCompleted: number;
  averageClassificationScore: number;
  totalClassifications: number;
  occupiedDepartments: number;
  freeDepartments: number;
  occupancyRate: number;
}

export interface ComplexStatistics {
  complexId: number;
  complexName: string;
  complexLocation: string;
  totalDepartments: number;
  occupiedDepartments: number;
  freeDepartments: number;
  occupancyRate: number;
  totalReservations: number;
  totalStays: number;
  averageClassificationScore: number;
  totalClassifications: number;
}
