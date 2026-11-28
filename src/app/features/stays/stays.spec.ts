import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { DepartmentService } from '../../services/department.service';
import { DateControllerService } from '../../services/date-controller.service';
import { ReservationService } from '../../services/reservation.service';
import { StayService } from '../../services/stay.service';
import { TenantService } from '../../services/tenant.service';
import { AutoFillService } from '../../services/auto-fill.service';
import { DepartmentResponse } from '../../models/department.models';
import { StayResponse } from '../../models/stay.models';
import { StaysComponent } from './stays';

describe('StaysComponent pricing', () => {
  let component: StaysComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        { provide: ActivatedRoute, useValue: { snapshot: { data: { view: 'check-in' } } } },
        { provide: StayService, useValue: { getMyStays: () => of([]) } },
        { provide: ReservationService, useValue: { getMyReservations: () => of([]) } },
        { provide: DepartmentService, useValue: { getMyDepartments: () => of([]) } },
        { provide: TenantService, useValue: { searchTenantByDocumentNumber: () => of(null) } },
        {
          provide: DateControllerService,
          useValue: {
            getDateTimeStr: () => '2025-01-10T15:00',
            getDateStr: () => '2025-01-10'
          }
        },
        { provide: AutoFillService, useValue: {} }
      ]
    });
    component = TestBed.runInInjectionContext(() => new StaysComponent());
    component.ngOnInit();
    component.departments = [{ id: 9, precioPorNoche: 12000 } as DepartmentResponse];
  });

  it('calculates express pricing for a select value represented as a string', () => {
    component.expressForm.patchValue({
      fechaHoraCheckInReal: '2025-01-10T15:00',
      fechaCheckOutPlaneada: '2025-01-12',
      departmentId: '9'
    });

    expect(component.calculatedNights).toBe(2);
    expect(component.calculatedTotal).toBe(24000);
    expect(component.expressForm.get('precioTotal')?.value).toBe(24000);
  });

  it('uses the route view to identify the check-in screen', () => {
    expect(component.isCheckInView).toBeTrue();
  });

  it('filters stays by their lifecycle status, combines tags, and deselects them on a second click', () => {
    component.stays = [
      { id: 1, status: 'PENDING' } as StayResponse,
      { id: 2, status: 'IN_PROGRESS' } as StayResponse,
      { id: 3, status: 'COMPLETED' } as StayResponse
    ];

    expect(component.filteredStays.map(stay => stay.id)).toEqual([1, 2, 3]);

    component.toggleStayFilter('PROGRAMMED');
    expect(component.filteredStays.map(stay => stay.id)).toEqual([1]);
    component.toggleStayFilter('COMPLETED');
    expect(component.filteredStays.map(stay => stay.id)).toEqual([1, 3]);

    component.toggleStayFilter('PROGRAMMED');
    expect(component.filteredStays.map(stay => stay.id)).toEqual([3]);
    component.toggleStayFilter('COMPLETED');
    expect(component.selectedStayFilters.size).toBe(0);
    expect(component.filteredStays.map(stay => stay.id)).toEqual([1, 2, 3]);
  });

  it('maps legacy active stays to the in-progress category', () => {
    const activeStay = { id: 4, status: 'ACTIVE' } as StayResponse;

    expect(component.getStayFilter(activeStay)).toBe('IN_PROGRESS');
    expect(component.getStayStatusLabel(activeStay)).toBe('En curso');
  });

  it('recalculates retroactive pricing when nights change and preserves a manual total', () => {
    component.retroactiveForm.patchValue({
      fechaCheckIn: '2025-01-10',
      fechaCheckOut: '2025-01-11',
      departmentId: '9'
    });
    component.calculateRetroactivePricing();
    const priceControl = component.retroactiveForm.get('precioTotal')!;
    priceControl.setValue(12345);
    priceControl.markAsDirty();

    component.retroactiveForm.get('cantidadNoches')?.setValue(3);

    expect(component.retroactiveForm.get('fechaCheckOut')?.value).toBe('2025-01-13');
    expect(component.retroactiveCalculatedTotal).toBe(36000);
    expect(priceControl.value).toBe(12345);
  });
});