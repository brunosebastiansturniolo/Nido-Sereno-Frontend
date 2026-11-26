import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AuthenticationRequest } from '../../models/auth-response.models';
import { APP_VERSION } from '../../app.constants';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  appVersion = APP_VERSION;
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  error = '';
  loading = false;

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.error = '';

    const request: AuthenticationRequest = this.loginForm.value;
    this.auth.login(request).subscribe({
      next: (response) => {
        this.auth.saveAuthResponse(response);
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        const businessErrorCode = err?.error?.businessErrorCode;
        if (businessErrorCode === 303) {
          this.error = 'Tu cuenta aún no está activada. Activala antes de iniciar sesión.';
        } else if (businessErrorCode === 304) {
          this.error = 'El email o la contraseña son incorrectos.';
        } else {
          this.error = 'No se pudo iniciar sesión. Intentá nuevamente más tarde.';
        }
        this.loading = false;
        console.error(err);
      }
    });
  }
}
