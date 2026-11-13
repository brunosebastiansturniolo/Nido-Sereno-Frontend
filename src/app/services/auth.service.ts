import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
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
    return this.http.get(`${this.baseUrl}/activate-account?token=${token}`, { responseType: 'text' });
  }

  refreshToken(refreshToken: string): Observable<AuthenticationResponse> {
    return this.http.post<AuthenticationResponse>(
      `${this.baseUrl}/refresh-token`,
      {},
      { headers: { Authorization: refreshToken } }
    );
  }

  saveAuthResponse(response: AuthenticationResponse): void {
    localStorage.setItem('token', response.token);
    localStorage.setItem('refreshToken', response.token);
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

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  hasRole(role: string): boolean {
    const user = this.getUser();
    return user?.roles?.includes('ROLE_' + role) ?? false;
  }
}
