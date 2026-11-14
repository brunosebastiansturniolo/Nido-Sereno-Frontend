import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { AdminStatistics, ComplexStatistics } from '../../models/admin.models';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private adminService = inject(AdminService);

  user = this.auth.getUser();
  loading = true;

  statistics: AdminStatistics = {
    totalComplexes: 0,
    totalDepartments: 0,
    totalReservations: 0,
    totalStays: 0,
    totalTenants: 0,
    reservationsPending: 0,
    reservationsConfirmed: 0,
    reservationsCheckedIn: 0,
    reservationsCompleted: 0,
    reservationsCancelled: 0,
    staysActive: 0,
    staysCompleted: 0,
    averageClassificationScore: 0,
    totalClassifications: 0,
    occupiedDepartments: 0,
    freeDepartments: 0,
    occupancyRate: 0
  };

  complexStatistics: ComplexStatistics[] = [];

  // Promote to super admin
  promoteEmail = '';
  promoting = false;
  promoteSuccess = '';
  promoteError = '';

  ngOnInit(): void {
    this.loadStatistics();
  }

  loadStatistics(): void {
    this.loading = true;

    this.adminService.getStatistics().subscribe({
      next: (stats) => {
        this.statistics = stats;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading statistics:', err);
        this.loading = false;
      }
    });

    this.adminService.getComplexStatistics().subscribe({
      next: (complexStats) => {
        this.complexStatistics = complexStats;
      },
      error: (err) => {
        console.error('Error loading complex statistics:', err);
      }
    });
  }

  promoteToSuperAdmin(): void {
    if (!this.promoteEmail.trim()) {
      this.promoteError = 'Ingresá un email válido';
      return;
    }
    this.promoting = true;
    this.promoteSuccess = '';
    this.promoteError = '';

    this.adminService.promoteToSuperAdmin(this.promoteEmail.trim()).subscribe({
      next: (response) => {
        this.promoteSuccess = response.message;
        this.promoteEmail = '';
        this.promoting = false;
      },
      error: (err) => {
        if (err.status === 404) {
          this.promoteError = 'Usuario no encontrado. Verificá que el email esté registrado.';
        } else if (err.status === 403) {
          this.promoteError = 'No tenés permiso para realizar esta acción.';
        } else {
          this.promoteError = err.error?.message || 'Error al promover el usuario.';
        }
        this.promoting = false;
      }
    });
  }
}
