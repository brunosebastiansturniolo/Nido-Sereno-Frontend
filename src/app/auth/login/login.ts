import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AuthenticationRequest } from '../../models/auth-response.models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
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
        this.error = 'Credenciales inválidas. Verificá tu email y contraseña.';
        this.loading = false;
        console.error(err);
      }
    });
  }
}
