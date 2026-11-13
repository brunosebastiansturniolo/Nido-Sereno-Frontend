import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationService } from '../../services/reservation.service';
import { ReservationResponse } from '../../models/reservation.models';

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservations.html',
  styleUrl: './reservations.css'
})
export class ReservationsComponent implements OnInit {
  private resService = inject(ReservationService);
  reservations: ReservationResponse[] = [];
  loading = false;

  ngOnInit(): void {
    this.loadReservations();
  }

  loadReservations(): void {
    this.loading = true;
    this.resService.getMyReservations().subscribe({
      next: (data) => { this.reservations = data; this.loading = false; },
      error: (err) => { console.error(err); this.loading = false; }
    });
  }

  onCancel(id: number): void {
    if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;
    this.resService.cancelReservation(id).subscribe({
      next: () => this.loadReservations(),
      error: (err) => console.error(err)
    });
  }
}
