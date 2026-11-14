import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, Observable, throwError, from } from 'rxjs';

let isRefreshing = false;
let refreshTokenPromise: Promise<void> | null = null;

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = localStorage.getItem('token');

  // No agregar Authorization a /refresh-token para evitar bucle infinito
  if (req.url.includes('/refresh-token')) {
    return next(req);
  }

  let cloned = req;
  if (token) {
    cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
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
          window.location.href = '/#/login';
          reject(err);
        }
      });
    });
  }

  return from(refreshTokenPromise!.then(() => {
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
