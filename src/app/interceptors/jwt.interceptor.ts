import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { DateControllerService } from '../services/date-controller.service';
import { catchError, Observable, throwError, from, switchMap } from 'rxjs';

let isRefreshing = false;
let refreshTokenPromise: Promise<void> | null = null;

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const dateCtrl = inject(DateControllerService);
  const token = localStorage.getItem('token');

  // No procesar rutas de autenticación: login, registro, activación, refresh
  if (req.url.includes('/authenticate') || req.url.includes('/register') ||
      req.url.includes('/activate-account') || req.url.includes('/refresh-token')) {
    return next(req);
  }

  let cloned = req;
  const headers: { [key: string]: string } = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Si el simulador de fecha está activo, enviar el header X-Simulated-Date
  if (dateCtrl.enabled()) {
    headers['X-Simulated-Date'] = dateCtrl.simulatedDateTimeStr();
  }

  if (Object.keys(headers).length > 0) {
    cloned = req.clone({
      setHeaders: headers
    });
  }

  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        return handle401Error(req, next, authService);
      }
      return throwError(() => error);
    })
  );
};

function handle401Error(
  request: any,
  next: any,
  authService: AuthService
): Observable<any> {
  if (!isRefreshing) {
    isRefreshing = true;

    refreshTokenPromise = new Promise((resolve, reject) => {
      authService.refreshToken().subscribe({
        next: () => {
          isRefreshing = false;
          resolve();
        },
        error: (err) => {
          isRefreshing = false;
          refreshTokenPromise = null;
          authService.logout();
          const router = inject(Router);
          router.navigate(['/login']);
          reject(err);
        }
      });
    });
  }

  return from(refreshTokenPromise!).pipe(switchMap(() => {
    const newToken = localStorage.getItem('token');
    if (!newToken) {
      throw new Error('Sesión expirada');
    }
    const cloned = request.clone({
      setHeaders: { Authorization: `Bearer ${newToken}` }
    });
    return next(cloned);
  }));
}
