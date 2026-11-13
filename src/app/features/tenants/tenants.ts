import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TenantService } from '../../services/tenant.service';
import { TenantResponse } from '../../models/tenant.models';

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tenants.html',
  styleUrl: './tenants.css'
})
export class TenantsComponent implements OnInit {
  private tenantService = inject(TenantService);
  tenants: TenantResponse[] = [];
  loading = false;

  ngOnInit(): void {
    this.loadTenants();
  }

  loadTenants(): void {
    this.loading = true;
    this.tenantService.getMyTenants().subscribe({
      next: (data) => { this.tenants = data; this.loading = false; },
      error: (err) => { console.error(err); this.loading = false; }
    });
  }
}
