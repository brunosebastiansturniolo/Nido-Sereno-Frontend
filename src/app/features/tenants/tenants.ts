import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TenantService } from '../../services/tenant.service';
import { TenantResponse } from '../../models/tenant.models';

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tenants.html',
  styleUrl: './tenants.css'
})
export class TenantsComponent implements OnInit {
  private tenantService = inject(TenantService);
  tenants: TenantResponse[] = [];
  loading = false;

  searchDocument = '';
  searchName = '';

  ngOnInit(): void {
    this.loadTenants();
  }

  loadTenants(): void {
    this.loading = true;
    this.tenantService.getMyTenants(this.searchDocument || undefined, this.searchName || undefined).subscribe({
      next: (data) => { this.tenants = data; this.loading = false; },
      error: (err) => { console.error(err); this.loading = false; }
    });
  }

  onSearch(): void {
    this.loadTenants();
  }

  onClear(): void {
    this.searchDocument = '';
    this.searchName = '';
    this.loadTenants();
  }
}
