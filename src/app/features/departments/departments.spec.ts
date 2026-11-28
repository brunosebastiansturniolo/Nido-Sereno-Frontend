import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ComplexService } from '../../services/complex.service';
import { DepartmentService } from '../../services/department.service';
import { ReservationService } from '../../services/reservation.service';
import { StayService } from '../../services/stay.service';
import { DateControllerService } from '../../services/date-controller.service';
import { AutoFillService } from '../../services/auto-fill.service';
import { DepartmentResponse } from '../../models/department.models';
import { ReservationResponse } from '../../models/reservation.models';
import { DepartmentsComponent } from './departments';

describe('DepartmentsComponent filters and pause confirmation', () => {
  let component: DepartmentsComponent;

  const department = (id: number, complexId: number, tieneCocina: boolean, pausado = false) => ({
    id,
    nombre: `Departamento ${id}`,
    complexId,
    tieneCocina,
    pausado,
    disponible: true
  } as DepartmentResponse);

  const reservation = (id: number, fechaCheckIn: string, estado = 'PENDING', enEstadia = false) => ({
    id,
    firstName: `Huésped ${id}`,
    lastName: 'Prueba',
    fechaCheckIn,
    departmentId: 1,
    estado,
    enEstadia
  } as ReservationResponse);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DepartmentsComponent],
      providers: [
        provideRouter([]),
        FormBuilder,
        { provide: DepartmentService, useValue: {
          getMyDepartments: () => of([]),
          createDepartment: () => of({}),
          updateDepartment: () => of({}),
          deleteDepartment: () => of({}),
          pauseDepartment: (id: number) => of(department(id, 1, false, true)),
          resumeDepartment: (id: number) => of(department(id, 1, false, false))
        } },
        { provide: ComplexService, useValue: { getMyComplexs: () => of([]) } },
        { provide: ReservationService, useValue: { getMyReservations: () => of([]) } },
        { provide: StayService, useValue: { getMyStays: () => of([]) } },
        { provide: DateControllerService, useValue: { getDateStr: () => '2025-01-10' } },
        { provide: AutoFillService, useValue: {} }
      ]
    });
    component = TestBed.runInInjectionContext(() => new DepartmentsComponent());
    component.ngOnInit();
  });

  it('unites selected complexes while intersecting them with the active department filter', () => {
    component.departments = [
      department(1, 1, true),
      department(2, 1, false),
      department(3, 2, true),
      department(4, 1, true, true)
    ];
    component.selectDepartmentFilter('KITCHEN');
    component.toggleComplexFilter(1);
    component.toggleComplexFilter(2);

    expect(component.filteredDepartments.map(item => item.id)).toEqual([1, 3, 4]);

    component.selectDepartmentFilter('PAUSED');

    expect(component.selectedDepartmentFilter).toBe('PAUSED');
    expect(component.filteredDepartments.map(item => item.id)).toEqual([4]);
  });

  it('makes Todos exclusive and clears complex and status selections', () => {
    component.departments = [department(1, 1, true), department(2, 2, false)];
    component.selectDepartmentFilter('KITCHEN');
    component.toggleComplexFilter(1);

    component.selectDepartmentFilter('ALL');

    expect(component.isAllDepartmentsSelected).toBeTrue();
    expect(component.selectedComplexIds.size).toBe(0);
    expect(component.filteredDepartments.map(item => item.id)).toEqual([1, 2]);
  });

  it('warns about the nearest future booking and excludes cancelled or ongoing stays', () => {
    const target = department(1, 1, false);
    component.reservations = [
      reservation(1, '2025-01-15'),
      reservation(2, '2025-01-11', 'CANCELED'),
      reservation(3, '2025-01-12', 'PENDING', true),
      reservation(4, '2025-01-13', 'COMPLETED')
    ];

    component.openPauseConfirmation(target);

    expect(component.showPauseConfirmation).toBeTrue();
    expect(component.upcomingReservations.map(item => item.id)).toEqual([4, 1]);
  });

  it('does not open pause confirmation while an occupant is staying', () => {
    component.activeDepartmentIds = new Set([1]);

    component.openPauseConfirmation(department(1, 1, false));

    expect(component.showPauseConfirmation).toBeFalse();
  });
});