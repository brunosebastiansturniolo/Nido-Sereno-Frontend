import { Injectable, signal, computed } from '@angular/core';
import { DateControllerService } from './date-controller.service';
import {
  TutorialComplex,
  TutorialDepartment,
  TutorialReservation,
  TutorialTenant,
  TutorialStay,
  TutorialClassification
} from './tutorial.models';

// Datos aleatorios para el asistente
const nombres = ['María', 'Juan', 'Carlos', 'Ana', 'Luis', 'Laura', 'Pedro', 'Sofía', 'Diego', 'Valentina'];
const apellidos = ['García', 'Rodríguez', 'López', 'Martínez', 'Fernández', 'González', 'Pérez', 'Sánchez', 'Romero', 'Torres'];
const calles = ['Av. San Martín', 'Calle Belgrano', 'Av. Rivadavia', 'Calle Mitre', 'Av. Libertador', 'Calle 9 de Julio'];
const ciudades = ['Bariloche', 'Mar del Plata', 'Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza'];
const nombresComplejo = ['Los Arrayanes', 'El Mirador', 'Villa Serena', 'Las Garzas', 'Sol y Luna', 'El Bosque'];
const nombresDepto = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDNI(): string {
  return String(Math.floor(10000000 + Math.random() * 80000000));
}

function randomPhone(): string {
  return `+54 9 11 ${Math.floor(10000000 + Math.random() * 90000000)}`;
}

function randomEmail(first: string, last: string): string {
  return `${first.toLowerCase()}.${last.toLowerCase()}@email.com`;
}

@Injectable({
  providedIn: 'root'
})
export class TutorialService {
  private dateController = new DateControllerService(); // Usamos nueva instancia para acceder a métodos no-injectables

  // Auto-increment IDs
  private _complexId = 0;
  private _deptId = 0;
  private _resId = 0;
  private _tenantId = 0;
  private _stayId = 0;
  private _classId = 0;

  // Data stores (signals)
  private _complexes = signal<TutorialComplex[]>([]);
  private _departments = signal<TutorialDepartment[]>([]);
  private _reservations = signal<TutorialReservation[]>([]);
  private _tenants = signal<TutorialTenant[]>([]);
  private _stays = signal<TutorialStay[]>([]);
  private _classifications = signal<TutorialClassification[]>([]);

  // Readonly signals
  complexes = this._complexes.asReadonly();
  departments = this._departments.asReadonly();
  reservations = this._reservations.asReadonly();
  tenants = this._tenants.asReadonly();
  stays = this._stays.asReadonly();
  classifications = this._classifications.asReadonly();

  // Computed summaries
  reservationSummary = computed(() => {
    const res = this._reservations();
    return {
      total: res.length,
      pending: res.filter(r => r.estado === 'PENDING').length,
      confirmed: res.filter(r => r.estado === 'CONFIRMED').length,
      checkedIn: res.filter(r => r.estado === 'CHECKED_IN').length,
      completed: res.filter(r => r.estado === 'COMPLETED').length,
      cancelled: res.filter(r => r.estado === 'CANCELLED').length
    };
  });

  staySummary = computed(() => {
    const stays = this._stays();
    return {
      total: stays.length,
      active: stays.filter(s => s.status === 'ACTIVE').length,
      completed: stays.filter(s => s.status === 'COMPLETED').length
    };
  });

  complexSummaries = computed(() => {
    const complexes = this._complexes();
    const departments = this._departments();
    const activeStays = this._stays().filter(s => s.status === 'ACTIVE');
    const occupiedDeptIds = new Set(activeStays.map(s => s.departmentId));

    return complexes.map(c => {
      const cDepts = departments.filter(d => d.complexId === c.id);
      const occupied = cDepts.filter(d => occupiedDeptIds.has(d.id)).length;
      return {
        complex: c,
        totalDepartments: cDepts.length,
        occupiedDepartments: occupied,
        freeDepartments: cDepts.length - occupied
      };
    });
  });

  // ==========================================
  // COMPLEXES
  // ==========================================

  createComplex(nombre: string, ubicacion: string, descripcion: string = ''): TutorialComplex {
    const complex: TutorialComplex = {
      id: ++this._complexId,
      nombre,
      ubicacion,
      descripcion
    };
    this._complexes.set([...this._complexes(), complex]);
    return complex;
  }

  autoFillComplex(): { nombre: string; ubicacion: string; descripcion: string } {
    return {
      nombre: randomFrom(nombresComplejo),
      ubicacion: `${randomFrom(calles)}, ${randomFrom(ciudades)}`,
      descripcion: 'Complejo turístico con amenities de primera clase'
    };
  }

  // ==========================================
  // DEPARTMENTS
  // ==========================================

  createDepartment(req: {
    nombre: string;
    numeroHabitaciones: number;
    precioPorNoche: number;
    tamanoM2: number;
    incluyeCochera: boolean;
    incluyeDesayuno: boolean;
    tieneWifi: boolean;
    tienePileta: boolean;
    complexId: number;
  }): TutorialDepartment {
    const complex = this._complexes().find(c => c.id === req.complexId);
    const dept: TutorialDepartment = {
      ...req,
      id: ++this._deptId,
      disponible: true,
      complejoNombre: complex?.nombre || ''
    };
    this._departments.set([...this._departments(), dept]);
    return dept;
  }

  autoFillDepartment(complexId: number): {
    nombre: string;
    numeroHabitaciones: number;
    precioPorNoche: number;
    tamanoM2: number;
    incluyeCochera: boolean;
    incluyeDesayuno: boolean;
    tieneWifi: boolean;
    tienePileta: boolean;
  } {
    return {
      nombre: randomFrom(nombresDepto),
      numeroHabitaciones: Math.floor(1 + Math.random() * 3),
      precioPorNoche: Math.floor(5000 + Math.random() * 15000),
      tamanoM2: Math.floor(30 + Math.random() * 70),
      incluyeCochera: Math.random() > 0.3,
      incluyeDesayuno: Math.random() > 0.4,
      tieneWifi: true,
      tienePileta: Math.random() > 0.5
    };
  }

  // ==========================================
  // RESERVATIONS
  // ==========================================

  createReservation(req: {
    firstName: string;
    lastName: string;
    documentNumber: string;
    cantidadPersonas: number;
    fechaCheckIn: string;
    fechaCheckOut: string;
    cantidadVehiculos: number;
    phoneNumber: string;
    departmentId: number;
    precioTotal: number;
    montoSenia: number;
  }): TutorialReservation {
    const dept = this._departments().find(d => d.id === req.departmentId);
    const checkInDate = new Date(req.fechaCheckIn);
    const checkOutDate = new Date(req.fechaCheckOut);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    const reservation: TutorialReservation = {
      ...req,
      id: ++this._resId,
      estado: 'PENDING',
      cantidadNoches: nights,
      departamentoNombre: dept?.nombre || ''
    };
    this._reservations.set([...this._reservations(), reservation]);
    return reservation;
  }

  cancelReservation(id: number): boolean {
    const reservations = this._reservations();
    const idx = reservations.findIndex(r => r.id === id);
    if (idx === -1) return false;
    const updated = [...reservations];
    updated[idx] = { ...updated[idx], estado: 'CANCELLED' };
    this._reservations.set(updated);
    return true;
  }

  autoFillReservation(): {
    firstName: string;
    lastName: string;
    documentNumber: string;
    phoneNumber: string;
    cantidadPersonas: number;
    cantidadVehiculos: number;
  } {
    const firstName = randomFrom(nombres);
    const lastName = randomFrom(apellidos);
    return {
      firstName,
      lastName,
      documentNumber: randomDNI(),
      phoneNumber: randomPhone(),
      cantidadPersonas: Math.floor(1 + Math.random() * 4),
      cantidadVehiculos: Math.floor(Math.random() * 2)
    };
  }

  // ==========================================
  // TENANTS
  // ==========================================

  createOrUpdateTenant(req: {
    documentNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    dateOfBirth: string;
  }): TutorialTenant {
    const existing = this._tenants().find(t => t.documentNumber === req.documentNumber);
    if (existing) {
      return existing;
    }
    const tenant: TutorialTenant = {
      ...req,
      id: ++this._tenantId,
      averageScore: null
    };
    this._tenants.set([...this._tenants(), tenant]);
    return tenant;
  }

  searchTenantByDocument(documentNumber: string): TutorialTenant | null {
    return this._tenants().find(t => t.documentNumber === documentNumber) || null;
  }

  autoFillTenant(): {
    documentNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    dateOfBirth: string;
  } {
    const firstName = randomFrom(nombres);
    const lastName = randomFrom(apellidos);
    return {
      documentNumber: randomDNI(),
      firstName,
      lastName,
      email: randomEmail(firstName, lastName),
      phoneNumber: randomPhone(),
      dateOfBirth: '19' + (80 + Math.floor(Math.random() * 30)) + '-' +
                   String(1 + Math.floor(Math.random() * 12)).padStart(2, '0') + '-' +
                   String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')
    };
  }

  autoFillCheckout(): {
    comentariosCheckOut: string;
    estadoDepartamento: 'GOOD' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE' | 'CLEANING_REQUIRED';
    classificationScore: number;
    classificationReviewComment: string;
  } {
    const comentarios = [
      'Se fueron de repente en la mañana, no se despidieron',
      'Se despidieron amablemente y dejaron las llaves en la mesa',
      'Pagó una extensión de estadía de último momento',
      'Le surgió una emergencia y se fue antes de lo planeado'
    ];
    const estados: Array<'GOOD' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE' | 'CLEANING_REQUIRED'> = ['GOOD', 'MINOR_DAMAGE', 'CLEANING_REQUIRED'];
    const clasificaciones = [
      'Excelente huésped, muy respetuoso y limpio',
      'Dejó el departamento impecable',
      'Buen huésped en general, dejó las luces encendidas',
      'Rompió una silla pero ofreció reponerla'
    ];
    return {
      comentariosCheckOut: randomFrom(comentarios),
      estadoDepartamento: randomFrom(estados),
      classificationScore: 3 + Math.floor(Math.random() * 3),
      classificationReviewComment: randomFrom(clasificaciones)
    };
  }

  // ==========================================
  // STAYS
  // ==========================================

  checkIn(req: {
    reservationId: number | null;
    departmentId: number;
    fechaHoraCheckInReal: string;
    fechaCheckOutPlaneada: string;
    comentariosCheckIn: string;
    tenants: TutorialTenant[];
  }): TutorialStay {
    const dept = this._departments().find(d => d.id === req.departmentId);
    const checkInDate = new Date(req.fechaHoraCheckInReal);
    const checkOutDate = new Date(req.fechaCheckOutPlaneada);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    const stay: TutorialStay = {
      id: ++this._stayId,
      fechaHoraCheckInReal: req.fechaHoraCheckInReal,
      fechaHoraCheckOutReal: null,
      fechaCheckOutPlaneada: req.fechaCheckOutPlaneada,
      comentariosCheckIn: req.comentariosCheckIn,
      comentariosCheckOut: '',
      estadoDepartamento: null,
      status: 'ACTIVE',
      reservationId: req.reservationId,
      departmentId: req.departmentId,
      departamentoNombre: dept?.nombre || '',
      cantidadNoches: nights,
      tenants: req.tenants,
      classificationScore: null,
      classificationReviewComment: null
    };

    // Update reservation status if exists
    if (req.reservationId) {
      const reservations = this._reservations();
      const updated = reservations.map(r =>
        r.id === req.reservationId ? { ...r, estado: 'CHECKED_IN' as const } : r
      );
      this._reservations.set(updated);
    }

    // Mark department as not available
    const departments = this._departments();
    const updatedDepts = departments.map(d =>
      d.id === req.departmentId ? { ...d, disponible: false } : d
    );
    this._departments.set(updatedDepts);

    this._stays.set([...this._stays(), stay]);
    return stay;
  }

  checkOut(stayId: number, req: {
    fechaHoraCheckOutReal: string;
    comentariosCheckOut: string;
    estadoDepartamento: 'GOOD' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE' | 'CLEANING_REQUIRED';
    classificationScore?: number;
    classificationReviewComment?: string;
  }): TutorialStay {
    const stays = this._stays();
    const idx = stays.findIndex(s => s.id === stayId);
    if (idx === -1) throw new Error('Estadía no encontrada');

    const updatedStay = {
      ...stays[idx],
      fechaHoraCheckOutReal: req.fechaHoraCheckOutReal,
      comentariosCheckOut: req.comentariosCheckOut,
      estadoDepartamento: req.estadoDepartamento,
      status: 'COMPLETED' as const,
      classificationScore: req.classificationScore || null,
      classificationReviewComment: req.classificationReviewComment || null
    };

    const updatedStays = [...stays];
    updatedStays[idx] = updatedStay;
    this._stays.set(updatedStays);

    // Update reservation status
    if (updatedStay.reservationId) {
      const reservations = this._reservations();
      const updated = reservations.map(r =>
        r.id === updatedStay.reservationId ? { ...r, estado: 'COMPLETED' as const } : r
      );
      this._reservations.set(updated);
    }

    // Mark department as available again
    const departments = this._departments();
    const updatedDepts = departments.map(d =>
      d.id === updatedStay.departmentId ? { ...d, disponible: true } : d
    );
    this._departments.set(updatedDepts);

    // Create classification if score provided
    if (req.classificationScore && updatedStay.tenants.length > 0) {
      const tenant = updatedStay.tenants[0];
      const classification: TutorialClassification = {
        id: ++this._classId,
        score: req.classificationScore,
        reviewComment: req.classificationReviewComment || '',
        date: req.fechaHoraCheckOutReal,
        stayId: stayId,
        tenantName: `${tenant.firstName} ${tenant.lastName}`
      };
      this._classifications.set([...this._classifications(), classification]);

      // Update tenant average score
      const tenantClassifications = this._classifications().filter(c =>
        c.tenantName === `${tenant.firstName} ${tenant.lastName}`
      );
      const avgScore = tenantClassifications.reduce((sum, c) => sum + c.score, 0) / tenantClassifications.length;

      const tenants = this._tenants();
      const updatedTenants = tenants.map(t =>
        t.id === tenant.id ? { ...t, averageScore: avgScore } : t
      );
      this._tenants.set(updatedTenants);
    }

    return updatedStay;
  }

  // ==========================================
  // DASHBOARD DATA
  // ==========================================

  getDashboardData() {
    return {
      complexes: this._complexes(),
      complexSummaries: this.complexSummaries(),
      reservationSummary: this.reservationSummary(),
      staySummary: this.staySummary(),
      totalDepartments: this.complexSummaries().reduce((sum, cs) => sum + cs.totalDepartments, 0)
    };
  }

  // ==========================================
  // RESET
  // ==========================================

  resetAll(): void {
    this._complexId = 0;
    this._deptId = 0;
    this._resId = 0;
    this._tenantId = 0;
    this._stayId = 0;
    this._classId = 0;
    this._complexes.set([]);
    this._departments.set([]);
    this._reservations.set([]);
    this._tenants.set([]);
    this._stays.set([]);
    this._classifications.set([]);
  }
}
