import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./auth/register/register').then(m => m.RegisterComponent)
  },
  {
    path: 'activate-account',
    loadComponent: () => import('./auth/activate/activate').then(m => m.ActivateComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./layout/layout').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardComponent)
      },
      {
        path: 'complexes',
        loadComponent: () => import('./features/complexes/complexes').then(m => m.ComplexesComponent)
      },
      {
        path: 'departments',
        loadComponent: () => import('./features/departments/departments').then(m => m.DepartmentsComponent)
      },
      {
        path: 'reservations',
        loadComponent: () => import('./features/reservations/reservations').then(m => m.ReservationsComponent)
      },
      {
        path: 'stays',
        loadComponent: () => import('./features/stays/stays').then(m => m.StaysComponent)
      },
      {
        path: 'tenants',
        loadComponent: () => import('./features/tenants/tenants').then(m => m.TenantsComponent)
      }
    ]
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
