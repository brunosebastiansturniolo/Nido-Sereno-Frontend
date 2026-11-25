import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.html'
})
export class ResetPasswordComponent implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  token = '';
  password = '';
  confirmPassword = '';
  loading = false;
  completed = false;
  error = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.error = 'El enlace es inválido o expiró. Solicitá uno nuevo.';
      return;
    }

    this.router.navigate([], { relativeTo: this.route, queryParams: { token: null }, replaceUrl: true });
  }

  submit(): void {
    if (!this.token) {
      this.error = 'El enlace es inválido o expiró. Solicitá uno nuevo.';
      return;
    }
    if (this.password.length < 8) {
      this.error = 'La contraseña debe tener al menos 8 caracteres.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }

    this.loading = true;
    this.error = '';
    this.auth.resetPassword(this.token, this.password).subscribe({
      next: () => {
        this.completed = true;
        this.loading = false;
        setTimeout(() => this.router.navigate(['/login']), 2500);
      },
      error: () => {
        this.error = 'El enlace es inválido o expiró. Solicitá uno nuevo.';
        this.loading = false;
      }
    });
  }
}