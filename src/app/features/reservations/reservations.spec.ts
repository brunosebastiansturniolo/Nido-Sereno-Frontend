import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DepartmentService } from '../../services/department.service';
import { DateControllerService } from '../../services/date-controller.service';
import { ReservationService } from '../../services/reservation.service';
import { AutoFillService } from '../../services/auto-fill.service';
import { DepartmentResponse } from '../../models/department.models';
import { ReservationResponse } from '../../models/reservation.models';
import { ReservationsComponent } from './reservations';

describe('ReservationsComponent', () => {
  let component: ReservationsComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReservationsComponent],
      providers: [
        provideRouter([]),
        FormBuilder,
        { provide: ReservationService, useValue: { getMyReservations: () => of([]) } },
        { provide: DepartmentService, useValue: { getMyDepartments: () => of([]) } },
        {
          provide: DateControllerService,
          useValue: {
            getDateStr: () => '2025-01-10',
            getDateStrOffset: (days: number) => `2025-01-${String(10 + days).padStart(2, '0')}`
          }
        },
        { provide: AutoFillService, useValue: {} }
      ]
    });
    component = TestBed.runInInjectionContext(() => new ReservationsComponent());
    component.ngOnInit();
    component.departments = [{ id: 5, precioPorNoche: 10000 } as DepartmentResponse];
  });

  it('keeps a manually edited total while updating the calculated breakdown', () => {
    component.createForm.patchValue({
      fechaCheckIn: '2025-01-10',
      fechaCheckOut: '2025-01-11',
      departmentId: '5'
    });
    const priceControl = component.createForm.get('precioTotal')!;
    priceControl.setValue(12345);
    priceControl.markAsDirty();

    component.createForm.get('cantidadNoches')?.setValue(2);

    expect(priceControl.value).toBe(12345);
    expect(component.calculatedTotal).toBe(20000);
  });

  it('shows the associated department in mobile and desktop reservation lists', () => {
    const fixture = TestBed.createComponent(ReservationsComponent);
    fixture.detectChanges();
    fixture.componentInstance.reservations = [{
      id: 1,
      firstName: 'Ana',
      lastName: 'Pérez',
      documentNumber: '12345678',
      cantidadPersonas: 1,
      fechaCheckIn: '2025-01-10',
      fechaCheckOut: '2025-01-11',
      cantidadVehiculos: 0,
      phoneNumber: '11111111',
      estado: 'PENDING',
      precioTotal: 10000,
      montoSenia: 0,
      cantidadNoches: 1,
      departmentId: 5,
      departmentName: 'D2',
      enEstadia: false
    } as ReservationResponse];
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Departamento: D2');
    expect(Array.from(fixture.nativeElement.querySelectorAll('th'))
      .some((header: any) => header.textContent.trim() === 'Departamento')).toBeTrue();
    expect(Array.from(fixture.nativeElement.querySelectorAll('td'))
      .some((cell: any) => cell.textContent.trim() === 'D2')).toBeTrue();
  });

  it('filters arrivals from today by pending or confirmed status', () => {
    component.reservations = [
      { id: 1, estado: 'PENDING', fechaCheckIn: '2025-01-10' } as ReservationResponse,
      { id: 2, estado: 'CONFIRMED', fechaCheckIn: '2025-01-11' } as ReservationResponse,
      { id: 3, estado: 'PENDING', fechaCheckIn: '2025-01-09' } as ReservationResponse,
      { id: 4, estado: 'CANCELED', fechaCheckIn: '2025-01-11' } as ReservationResponse,
      { id: 5, estado: 'COMPLETED', fechaCheckIn: '2025-01-12' } as ReservationResponse
    ];

    component.toggleReservationFilter('ARRIVING');

    expect(component.filteredReservations.map(reservation => reservation.id)).toEqual([1, 2]);
  });

  it('unites the selected reservation tags and clears them with Todas', () => {
    component.reservations = [
      { id: 1, estado: 'PENDING', fechaCheckIn: '2025-01-10' } as ReservationResponse,
      { id: 2, estado: 'CANCELED', fechaCheckIn: '2025-01-11' } as ReservationResponse,
      { id: 3, estado: 'COMPLETED', fechaCheckIn: '2025-01-12' } as ReservationResponse
    ];
    component.toggleReservationFilter('ARRIVING');
    component.toggleReservationFilter('CANCELLED');

    expect(component.filteredReservations.map(reservation => reservation.id)).toEqual([1, 2]);

    component.showAllReservations();

    expect(component.isAllReservationsSelected).toBeTrue();
    expect(component.filteredReservations.map(reservation => reservation.id)).toEqual([1, 2, 3]);
  });

  it('filters active stays independently from payment status', () => {
    component.reservations = [
      { id: 1, estado: 'PENDING', enEstadia: true } as ReservationResponse,
      { id: 2, estado: 'COMPLETED', enEstadia: false } as ReservationResponse
    ];

    component.toggleReservationFilter('IN_STAY');

    expect(component.filteredReservations.map(reservation => reservation.id)).toEqual([1]);
  });

  it('highlights future non-cancelled reservations of paused departments', () => {
    component.departments = [{ id: 5, pausado: true } as DepartmentResponse];
    const futureReservation = {
      id: 1,
      estado: 'COMPLETED',
      fechaCheckIn: '2025-01-11',
      departmentId: 5,
      enEstadia: false
    } as ReservationResponse;
    const cancelledReservation = { ...futureReservation, id: 2, estado: 'CANCELED' };
    const activeStay = { ...futureReservation, id: 3, enEstadia: true };
    const pastReservation = { ...futureReservation, id: 4, fechaCheckIn: '2025-01-09' };

    expect(component.isPausedFutureReservation(futureReservation)).toBeTrue();
    expect(component.isPausedFutureReservation(cancelledReservation)).toBeFalse();
    expect(component.isPausedFutureReservation(activeStay)).toBeFalse();
    expect(component.isPausedFutureReservation(pastReservation)).toBeFalse();
  });
});