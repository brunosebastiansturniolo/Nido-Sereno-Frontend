import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-activate',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './activate.html',
  styleUrl: './activate.css'
})
export class ActivateComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  token = '';
  error = '';
  success = '';
  loading = true;

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';

      if (!this.token) {
        this.error = 'Token de activación no encontrado.';
        this.loading = false;
        return;
      }

      this.auth.activateAccount(this.token).subscribe({
        next: () => {
          this.success = '¡Cuenta activada exitosamente! Podés iniciar sesión.';
          this.loading = false;
          setTimeout(() => this.router.navigate(['/login']), 3000);
        },
        error: (err) => {
          this.error = 'Error al activar la cuenta. El token puede haber expirado.';
          this.loading = false;
          console.error(err);
        }
      });
    });
  }
}
