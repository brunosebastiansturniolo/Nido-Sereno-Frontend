import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { DepartmentService } from '../../services/department.service';
import { DateControllerService } from '../../services/date-controller.service';
import { ReservationService } from '../../services/reservation.service';
import { AutoFillService } from '../../services/auto-fill.service';
import { DepartmentResponse } from '../../models/department.models';
import { ReservationsComponent } from './reservations';

describe('ReservationsComponent pricing', () => {
  let component: ReservationsComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
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

  it('updates checkout, nights, total and deposit when nights change', () => {
    component.createForm.patchValue({
      fechaCheckIn: '2025-01-10',
      fechaCheckOut: '2025-01-11',
      departmentId: '5'
    });

    component.createForm.get('cantidadNoches')?.setValue(3);

    expect(component.createForm.get('fechaCheckOut')?.value).toBe('2025-01-13');
    expect(component.createForm.get('cantidadNoches')?.value).toBe(3);
    expect(component.createForm.get('precioTotal')?.value).toBe(30000);
    expect(component.createForm.get('montoSenia')?.value).toBe(10000);
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
});