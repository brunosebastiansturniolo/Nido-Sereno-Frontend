import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-activate',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './activate.html',
  styleUrl: './activate.css'
})
export class ActivateComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  token = '';
  error = '';
  success = '';
  loading = false;

  submitCode(): void {
    if (!this.token.trim()) {
      this.error = 'Ingresá el código de activación de 6 dígitos.';
      return;
    }
    this.loading = true;
    this.error = '';
    this.auth.activateAccount(this.token.trim()).subscribe({
      next: () => {
        this.success = '¡Cuenta activada exitosamente! Podés iniciar sesión.';
        this.loading = false;
        setTimeout(() => this.router.navigate(['/login']), 3000);
      },
      error: (err) => {
        this.error = 'Error al activar la cuenta. Verificá el código o intentá de nuevo.';
        this.loading = false;
        console.error(err);
      }
    });
  }
}
