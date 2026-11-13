import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StayService } from '../../services/stay.service';
import { StayResponse } from '../../models/stay.models';

@Component({
  selector: 'app-stays',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stays.html',
  styleUrl: './stays.css'
})
export class StaysComponent implements OnInit {
  private stayService = inject(StayService);
  stays: StayResponse[] = [];
  loading = false;

  ngOnInit(): void {
    this.loadStays();
  }

  loadStays(): void {
    this.loading = true;
    this.stayService.getMyStays().subscribe({
      next: (data) => { this.stays = data; this.loading = false; },
      error: (err) => { console.error(err); this.loading = false; }
    });
  }
}
