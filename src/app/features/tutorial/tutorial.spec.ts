import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TutorialService } from '../../services/tutorial/tutorial.service';
import { DateControllerService } from '../../services/tutorial/date-controller.service';
import { TutorialComponent } from './tutorial';

describe('TutorialComponent reservation pricing', () => {
  let component: TutorialComponent;

  beforeEach(() => {
    const department = { id: 4, precioPorNoche: 15000 };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
        {
          provide: TutorialService,
          useValue: {
            complexes: () => [],
            departments: () => [department],
            reservations: () => [],
            tenants: () => [],
            stays: () => [],
            classifications: () => [],
            reservationSummary: () => ({}),
            staySummary: () => ({}),
            complexSummaries: () => [],
            autoFillReservation: () => ({})
          }
        },
        {
          provide: DateControllerService,
          useValue: {
            simulatedDate: () => new Date('2025-01-10'),
            simulatedDateStr: () => '2025-01-10',
            simulatedDateTimeStr: () => '2025-01-10T12:00',
            simulatedDateDisplay: () => '10 de enero de 2025',
            getDateStrOffset: (days: number) => `2025-01-${String(10 + days).padStart(2, '0')}`
          }
        }
      ]
    });
    component = TestBed.runInInjectionContext(() => new TutorialComponent());
  });

  it('recalculates the total and deposit when dates or department change', () => {
    component.setResDeptId(4);
    component.setResCheckIn('2025-01-10');
    component.setResCheckOut('2025-01-13');

    expect(component.reservationForm().precioTotal).toBe(45000);
    expect(component.reservationForm().montoSenia).toBe(13500);

    component.setResCheckOut('2025-01-14');

    expect(component.reservationForm().precioTotal).toBe(60000);
    expect(component.reservationForm().montoSenia).toBe(18000);
  });

  it('does not replace a manually edited total on a later recalculation', () => {
    component.setResDeptId(4);
    component.setResCheckIn('2025-01-10');
    component.setResCheckOut('2025-01-13');
    component.setResPrecio(12345);
    component.setResCheckOut('2025-01-14');

    expect(component.reservationForm().precioTotal).toBe(12345);
    expect(component.reservationForm().montoSenia).toBe(18000);
  });
});