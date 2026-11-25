import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html'
})
export class ForgotPasswordComponent {
  private auth = inject(AuthService);

  email = '';
  loading = false;
  submitted = false;
  error = '';

  submit(): void {
    if (!this.email.trim()) return;

    this.loading = true;
    this.error = '';
    this.auth.requestPasswordReset(this.email.trim()).subscribe({
      next: () => {
        this.submitted = true;
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo procesar la solicitud. Intentá nuevamente más tarde.';
        this.loading = false;
      }
    });
  }
}