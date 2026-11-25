import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ComplexService } from '../../services/complex.service';
import { ReservationService } from '../../services/reservation.service';
import { StayService } from '../../services/stay.service';
import { DepartmentService } from '../../services/department.service';
import { DateControllerService } from '../../services/date-controller.service';
import { ComplexResponse } from '../../models/complex.models';
import { DepartmentResponse } from '../../models/department.models';
import { ReservationResponse } from '../../models/reservation.models';
import { StayResponse } from '../../models/stay.models';

interface AvailabilityPeriod {
  start: string;
  end: string | null;
}

export interface DepartmentAvailability {
  department: DepartmentResponse;
  status: 'OCCUPIED' | 'FREE';
  untilDate: string | null;
  nextReservationDate: string | null;
}

export interface ComplexSummary {
  complex: ComplexResponse;
  totalDepartments: number;
  occupiedDepartments: number;
  freeDepartments: number;
  departments: DepartmentAvailability[];
}

export interface ReservationSummary {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

export interface StaySummary {
  total: number;
  inProgress: number;
  completed: number;
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
  private dateController = inject(DateControllerService);

  user = this.auth.getUser();

  complexes: ComplexResponse[] = [];
  complexSummaries: ComplexSummary[] = [];
  selectedComplexId: number | null = null;
  reservationSummary: ReservationSummary = { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
  staySummary: StaySummary = { total: 0, inProgress: 0, completed: 0, pending: 0 };
  loading = true;

  private departments: DepartmentResponse[] = [];
  private reservations: ReservationResponse[] = [];
  private stays: StayResponse[] = [];

  private dateChangeEffect = effect(() => {
    this.dateController.enabled();
    this.dateController.simulatedDate();
    this.updateComplexSummaries();
  });

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
        this.reservations = reservations;
        this.reservationSummary = {
          total: reservations.length,
          pending: reservations.filter(r => r.estado === 'PENDING').length,
          confirmed: reservations.filter(r => r.estado === 'CONFIRMED').length,
          completed: reservations.filter(r => r.estado === 'COMPLETED').length,
          cancelled: reservations.filter(r => r.estado === 'CANCELED' || r.estado === 'CANCELLED').length
        };
        this.updateComplexSummaries();
        this.checkLoadingComplete();
      },
      error: (err) => {
        console.error('Error loading reservations:', err);
        this.reservations = [];
        this.updateComplexSummaries();
        this.checkLoadingComplete();
      }
    });

    // Load stays
    this.stayService.getMyStays().subscribe({
      next: (stays) => {
        this.stays = stays;
        this.staySummary = {
          total: stays.length,
          inProgress: stays.filter(s => s.status === 'IN_PROGRESS' || s.status === 'ACTIVE').length,
          completed: stays.filter(s => s.status === 'COMPLETED').length,
          pending: stays.filter(s => s.status === 'PENDING').length
        };
        this.updateComplexSummaries();
        this.checkLoadingComplete();
      },
      error: (err) => {
        console.error('Error loading stays:', err);
        this.stays = [];
        this.updateComplexSummaries();
        this.checkLoadingComplete();
      }
    });
  }

  loadDepartmentsForComplexes(complexes: ComplexResponse[]): void {
    if (complexes.length === 0) {
      this.departments = [];
      this.complexSummaries = [];
      this.checkLoadingComplete();
      return;
    }

    this.departmentService.getMyDepartments().subscribe({
      next: (departments) => {
        this.departments = departments;
        this.updateComplexSummaries();
        this.checkLoadingComplete();
      },
      error: (err) => {
        console.error('Error loading departments:', err);
        this.departments = [];
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

  toggleComplexDetails(complexId: number): void {
    this.selectedComplexId = this.selectedComplexId === complexId ? null : complexId;
  }

  get selectedComplexSummary(): ComplexSummary | undefined {
    return this.complexSummaries.find(summary => summary.complex.id === this.selectedComplexId);
  }

  formatAvailabilityDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    });
  }

  private updateComplexSummaries(): void {
    if (this.complexes.length === 0) return;

    const today = this.dateController.getDateStr();
    this.complexSummaries = this.complexes.map(complex => {
      const departments = this.departments
        .filter(department => department.complexId === complex.id)
        .map(department => this.getDepartmentAvailability(department, today))
        .sort((a, b) => a.department.nombre.localeCompare(b.department.nombre));
      const occupied = departments.filter(department => department.status === 'OCCUPIED').length;

      return {
        complex,
        totalDepartments: departments.length,
        occupiedDepartments: occupied,
        freeDepartments: departments.length - occupied,
        departments
      };
    });
  }

  private getDepartmentAvailability(department: DepartmentResponse, today: string): DepartmentAvailability {
    const periods: AvailabilityPeriod[] = [];

    this.reservations
      .filter(reservation => Number(reservation.departmentId) === Number(department.id))
      .filter(reservation => ['PENDING', 'CONFIRMED'].includes(reservation.estado?.toUpperCase()))
      .forEach(reservation => this.addAvailabilityPeriod(periods, reservation.fechaCheckIn, reservation.fechaCheckOut));

    this.stays
      .filter(stay => Number(stay.departmentId) === Number(department.id))
      .filter(stay => ['PENDING', 'IN_PROGRESS', 'ACTIVE'].includes(stay.status?.toUpperCase()))
      .filter(stay => !stay.fechaHoraCheckOutReal)
      .forEach(stay => {
        const start = stay.status === 'PENDING'
          ? stay.fechaCheckInPlaneada ?? stay.fechaHoraCheckInReal
          : stay.fechaHoraCheckInReal ?? stay.fechaCheckInPlaneada;
        this.addAvailabilityPeriod(periods, start, stay.fechaCheckOutPlaneada);
      });

    const mergedPeriods = this.mergeAvailabilityPeriods(periods);
    const currentPeriod = mergedPeriods.find(period => period.start <= today && (!period.end || today < period.end));
    const activeStay = this.stays.find(stay => {
      const start = stay.fechaHoraCheckInReal ?? stay.fechaCheckInPlaneada;
      return Number(stay.departmentId) === Number(department.id)
        && ['IN_PROGRESS', 'ACTIVE'].includes(stay.status?.toUpperCase())
        && !stay.fechaHoraCheckOutReal
        && !!start
        && start.slice(0, 10) <= today;
    });

    if (activeStay) {
      const plannedCheckout = activeStay.fechaCheckOutPlaneada?.slice(0, 10);
      const occupiedUntil = plannedCheckout && plannedCheckout >= today
        ? plannedCheckout
        : currentPeriod?.end && currentPeriod.end >= today
          ? currentPeriod.end
          : null;
      return {
        department,
        status: 'OCCUPIED',
        untilDate: occupiedUntil,
        nextReservationDate: null
      };
    }

    if (currentPeriod) {
      return {
        department,
        status: 'OCCUPIED',
        untilDate: currentPeriod.end,
        nextReservationDate: null
      };
    }

    const nextPeriod = mergedPeriods.find(period => period.start > today);
    return {
      department,
      status: 'FREE',
      untilDate: nextPeriod ? this.addDays(nextPeriod.start, -1) : null,
      nextReservationDate: nextPeriod?.start ?? null
    };
  }

  private addAvailabilityPeriod(periods: AvailabilityPeriod[], start: string | null | undefined, end: string | undefined): void {
    const startDate = start?.slice(0, 10);
    const endDate = end?.slice(0, 10) ?? null;
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || (endDate && endDate <= startDate)) return;
    periods.push({ start: startDate, end: endDate });
  }

  private mergeAvailabilityPeriods(periods: AvailabilityPeriod[]): AvailabilityPeriod[] {
    const sortedPeriods = [...periods].sort((a, b) => a.start.localeCompare(b.start));
    const merged: AvailabilityPeriod[] = [];

    for (const period of sortedPeriods) {
      const previous = merged[merged.length - 1];
      if (!previous || (previous.end && period.start > previous.end)) {
        merged.push({ ...period });
      } else if (!previous.end || !period.end) {
        previous.end = null;
      } else if (period.end > previous.end) {
        previous.end = period.end;
      }
    }

    return merged;
  }

  private addDays(date: string, days: number): string {
    const [year, month, day] = date.split('-').map(Number);
    const result = new Date(Date.UTC(year, month - 1, day + days));
    return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`;
  }
}
