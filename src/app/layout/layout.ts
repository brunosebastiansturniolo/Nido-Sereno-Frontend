import { Component, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { DateControllerService } from '../services/date-controller.service';
import { DateWarningModalComponent } from '../shared/date-warning-modal/date-warning-modal';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, FormsModule, DateWarningModalComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class LayoutComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  dateCtrl = inject(DateControllerService);

  user = this.auth.getUser();
  sidebarExpanded = true;
  mobileSidebarOpen = false;
  isMobile = false;

  // Modal de advertencia del simulador de fecha
  showWarningModal = false;
  warningDontShowAgain = false;

  ngOnInit(): void {
    this.isMobile = window.innerWidth < 1024;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile = window.innerWidth < 1024;
  }

  toggleSidebar(): void {
    this.sidebarExpanded = !this.sidebarExpanded;
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  hasRole(role: string): boolean {
    return this.auth.hasRole(role);
  }

  // --- Simulador de fecha ---

  onToggleSimulator(): void {
    // Si se está activando y no se ha descartado la advertencia, mostrar el modal
    if (!this.dateCtrl.enabled() && !this.dateCtrl.hasDismissedWarning()) {
      this.warningDontShowAgain = false;
      this.showWarningModal = true;
      return;
    }
    // Si ya descartó la advertencia o se está desactivando, toggle directo
    this.dateCtrl.toggle();
  }

  onWarningConfirmed(): void {
    if (this.warningDontShowAgain) {
      this.dateCtrl.dismissWarning();
    }
    this.showWarningModal = false;
    this.dateCtrl.enable();
  }

  onWarningCancelled(): void {
    this.showWarningModal = false;
  }

  onWarningClosed(): void {
    this.showWarningModal = false;
  }

  onWarningDontShowAgainChange(checked: boolean): void {
    this.warningDontShowAgain = checked;
  }
}
