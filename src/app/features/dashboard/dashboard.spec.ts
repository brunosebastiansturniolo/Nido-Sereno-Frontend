import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ComplexService } from '../../services/complex.service';
import { DepartmentService } from '../../services/department.service';
import { DateControllerService } from '../../services/date-controller.service';
import { ReservationService } from '../../services/reservation.service';
import { StayService } from '../../services/stay.service';
import { ComplexResponse } from '../../models/complex.models';
import { DepartmentResponse } from '../../models/department.models';
import { ReservationResponse } from '../../models/reservation.models';
import { StayResponse } from '../../models/stay.models';
import { DashboardComponent } from './dashboard';

describe('DashboardComponent department availability', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<DashboardComponent>>;
  let updateSimulatedDate: (date: Date) => void;

  beforeEach(async () => {
    const simulatedDate = signal(new Date('2025-01-10T12:00:00Z'));
    updateSimulatedDate = date => simulatedDate.set(date);
    const complex = { id: 1, nombre: 'El Mirador', ubicacion: 'Rosario' } as ComplexResponse;
    const departments = [
      { id: 1, nombre: 'D1', complexId: 1 } as DepartmentResponse,
      { id: 2, nombre: 'D2', complexId: 1 } as DepartmentResponse,
      { id: 3, nombre: 'D3', complexId: 1 } as DepartmentResponse,
      { id: 4, nombre: 'D4', complexId: 1 } as DepartmentResponse
    ];
    const reservations = [
      { departmentId: 1, estado: 'CONFIRMED', fechaCheckIn: '2025-01-08', fechaCheckOut: '2025-01-12' },
      { departmentId: 2, estado: 'PENDING', fechaCheckIn: '2025-01-15', fechaCheckOut: '2025-01-17' },
      { departmentId: 3, estado: 'CANCELLED', fechaCheckIn: '2025-01-15', fechaCheckOut: '2025-01-17' }
    ] as ReservationResponse[];
    const stays = [{
      id: 1,
      departmentId: 4,
      status: 'IN_PROGRESS',
      fechaHoraCheckInReal: '2025-01-09T15:00:00',
      fechaCheckOutPlaneada: '2025-01-13'
    }] as StayResponse[];

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: AuthService, useValue: { getUser: () => ({ fullName: 'Bruno' }) } },
        { provide: ComplexService, useValue: { getMyComplexs: () => of([complex]) } },
        { provide: DepartmentService, useValue: { getMyDepartments: () => of(departments) } },
        { provide: ReservationService, useValue: { getMyReservations: () => of(reservations) } },
        { provide: StayService, useValue: { getMyStays: () => of(stays) } },
        {
          provide: DateControllerService,
          useValue: {
            getDateStr: () => simulatedDate().toISOString().slice(0, 10),
            enabled: signal(true),
            simulatedDate
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    fixture.componentInstance.loading = false;
    fixture.detectChanges();
  });

  it('opens the selected complex and shows occupied, upcoming, and indefinite availability', () => {
    const complexCard = fixture.nativeElement.querySelector(
      'button[aria-label="Ver detalle de El Mirador"]'
    ) as HTMLButtonElement | null;

    expect(complexCard).withContext('el resumen del complejo debe ser claramente clickeable').not.toBeNull();
    if (!complexCard) return;

    expect(complexCard.classList.contains('cursor-pointer')).toBeTrue();
    complexCard.click();
    fixture.detectChanges();

    const details = fixture.nativeElement.textContent as string;
    expect(details).toContain('D1');
    expect(details).toContain('Ocupado hasta');
    expect(details).toContain('12 de ene de 2025');
    expect(details).toContain('D2');
    expect(details).toContain('Libre hasta');
    expect(details).toContain('14 de ene de 2025');
    expect(details).toContain('15 de ene de 2025');
    expect(details).toContain('próxima reserva');
    expect(details).toContain('D3');
    expect(details).toContain('Libre indefinidamente');
    expect(details).toContain('D4');
    expect(details).toContain('13 de ene de 2025');

    updateSimulatedDate(new Date('2025-01-12T12:00:00Z'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('D1 Libre indefinidamente');

    updateSimulatedDate(new Date('2025-01-14T12:00:00Z'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('D4 Ocupado · salida sin fecha prevista');
  });
});