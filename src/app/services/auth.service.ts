import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { RegistrationRequest } from '../models/auth.models';
import { AuthenticationRequest, AuthenticationResponse } from '../models/auth-response.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/auth`;

  register(request: RegistrationRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/register`, request, { responseType: 'text' });
  }

  login(request: AuthenticationRequest): Observable<AuthenticationResponse> {
    return this.http.post<AuthenticationResponse>(`${this.baseUrl}/authenticate`, request);
  }

  activateAccount(token: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/activate-account`, { token });
  }

  refreshToken(): Observable<AuthenticationResponse> {
    const refreshToken = localStorage.getItem('refreshToken');
    return this.http.post<AuthenticationResponse>(
      `${this.baseUrl}/refresh-token`,
      {},
      { headers: { Authorization: `Bearer ${refreshToken}` } }
    ).pipe(
      tap(response => this.saveAuthResponse(response)),
      catchError(() => {
        this.logout();
        return throwError(() => new Error('Sesión expirada'));
      })
    );
  }

  saveAuthResponse(response: AuthenticationResponse): void {
    localStorage.setItem('token', response.token);
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('user', JSON.stringify(response.user));
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getUser(): any {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken() && !this.isTokenExpired();
  }

  hasRole(role: string): boolean {
    const user = this.getUser();
    return user?.roles?.includes(role) ?? false;
  }
}
