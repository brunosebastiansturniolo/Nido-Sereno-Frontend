import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RegistrationRequest } from '../../models/auth.models';

function passwordsMatch(group: FormGroup): { [key: string]: boolean } | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  if (password && confirmPassword && password !== confirmPassword) {
    return { passwordsMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  registerForm: FormGroup = this.fb.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: passwordsMatch });

  error = '';
  success = '';

  onSubmit(): void {
    if (this.registerForm.invalid) return;

    const password = this.registerForm.get('password')?.value;
    const confirmPassword = this.registerForm.get('confirmPassword')?.value;

    if (password !== confirmPassword) {
      this.error = 'Las contraseñas no coinciden';
      return;
    }

    const request: RegistrationRequest = {
      firstName: this.registerForm.get('firstName')?.value!,
      lastName: this.registerForm.get('lastName')?.value!,
      email: this.registerForm.get('email')?.value!,
      password: password
    };

    this.auth.register(request).subscribe({
      next: () => {
        this.success = '¡Registro exitoso! Revisá tu email para activar tu cuenta.';
        this.registerForm.reset();
        setTimeout(() => this.router.navigate(['/activate-account']), 3000);
      },
      error: (err) => {
        this.error = 'Error al registrar. Intentá de nuevo.';
        console.error(err);
      }
    });
  }
}
