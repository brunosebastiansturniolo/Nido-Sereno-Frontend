import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ComplexService } from '../../services/complex.service';
import { ReservationService } from '../../services/reservation.service';
import { StayService } from '../../services/stay.service';
import { DepartmentService } from '../../services/department.service';
import { ComplexResponse } from '../../models/complex.models';
import { DepartmentResponse } from '../../models/department.models';

export interface ComplexSummary {
  complex: ComplexResponse;
  totalDepartments: number;
  occupiedDepartments: number;
  freeDepartments: number;
}

export interface ReservationSummary {
  total: number;
  pending: number;
  confirmed: number;
  checkedIn: number;
  completed: number;
  cancelled: number;
}

export interface StaySummary {
  total: number;
  checkedIn: number;
  checkedOut: number;
  pending: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private complexService = inject(ComplexService);
  private reservationService = inject(ReservationService);
  private stayService = inject(StayService);
  private departmentService = inject(DepartmentService);

  user = this.auth.getUser();

  complexes: ComplexResponse[] = [];
  complexSummaries: ComplexSummary[] = [];
  reservationSummary: ReservationSummary = { total: 0, pending: 0, confirmed: 0, checkedIn: 0, completed: 0, cancelled: 0 };
  staySummary: StaySummary = { total: 0, checkedIn: 0, checkedOut: 0, pending: 0 };
  loading = true;

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;

    // Load complexes
    this.complexService.getMyComplexs().subscribe({
      next: (complexes) => {
        this.complexes = complexes;
        this.loadDepartmentsForComplexes(complexes);
      },
      error: (err) => {
        console.error('Error loading complexes:', err);
        this.loading = false;
      }
    });

    // Load reservations
    this.reservationService.getMyReservations().subscribe({
      next: (reservations) => {
        this.reservationSummary = {
          total: reservations.length,
          pending: reservations.filter(r => r.estado === 'PENDING').length,
          confirmed: reservations.filter(r => r.estado === 'CONFIRMED').length,
          checkedIn: reservations.filter(r => r.estado === 'CHECKED_IN').length,
          completed: reservations.filter(r => r.estado === 'COMPLETED').length,
          cancelled: reservations.filter(r => r.estado === 'CANCELLED').length
        };
        this.checkLoadingComplete();
      },
      error: (err) => {
        console.error('Error loading reservations:', err);
        this.checkLoadingComplete();
      }
    });

    // Load stays
    this.stayService.getMyStays().subscribe({
      next: (stays) => {
        this.staySummary = {
          total: stays.length,
          checkedIn: stays.filter(s => s.estado === 'CHECKED_IN').length,
          checkedOut: stays.filter(s => s.estado === 'CHECKED_OUT').length,
          pending: stays.filter(s => s.estado === 'PENDING').length
        };
        this.checkLoadingComplete();
      },
      error: (err) => {
        console.error('Error loading stays:', err);
        this.checkLoadingComplete();
      }
    });
  }

  loadDepartmentsForComplexes(complexes: ComplexResponse[]): void {
    if (complexes.length === 0) {
      this.complexSummaries = [];
      this.checkLoadingComplete();
      return;
    }

    this.departmentService.getMyDepartments().subscribe({
      next: (departments) => {
        // Get occupied department IDs from active stays
        const occupiedDeptIds = new Set<number>();
        this.stayService.getMyStays(undefined, undefined, true).subscribe({
          next: (activeStays) => {
            activeStays.forEach(s => occupiedDeptIds.add(s.departmentId));

            this.complexSummaries = complexes.map(complex => {
              const complexDepts = departments.filter(d => d.complexId === complex.id);
              const occupied = complexDepts.filter(d => occupiedDeptIds.has(d.id)).length;
              return {
                complex,
                totalDepartments: complexDepts.length,
                occupiedDepartments: occupied,
                freeDepartments: complexDepts.length - occupied
              };
            });
            this.checkLoadingComplete();
          },
          error: (err) => {
            console.error('Error loading active stays:', err);
            this.complexSummaries = complexes.map(complex => {
              const complexDepts = departments.filter(d => d.complexId === complex.id);
              return {
                complex,
                totalDepartments: complexDepts.length,
                occupiedDepartments: 0,
                freeDepartments: complexDepts.length
              };
            });
            this.checkLoadingComplete();
          }
        });
      },
      error: (err) => {
        console.error('Error loading departments:', err);
        this.complexSummaries = [];
        this.checkLoadingComplete();
      }
    });
  }

  checkLoadingComplete(): void {
    // Simple approach: set loading to false after a short delay to allow all data to load
    setTimeout(() => {
      this.loading = false;
    }, 500);
  }

  getTotalDepartments(): number {
    return this.complexSummaries.reduce((sum, cs) => sum + cs.totalDepartments, 0);
  }
}
