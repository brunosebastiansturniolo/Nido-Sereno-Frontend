import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TutorialService } from '../../services/tutorial/tutorial.service';
import { DateControllerService } from '../../services/tutorial/date-controller.service';
import { ReplaceNewlinesPipe } from '../../shared/replace-newlines-pipe/replace-newlines-pipe';
import {
  TutorialComplex,
  TutorialDepartment,
  TutorialReservation,
  TutorialTenant,
  TutorialStay
} from '../../services/tutorial/tutorial.models';

export type TutorialSection = 'welcome' | 'hierarchy' | 'flow' | 'dashboard' | 'complexes' | 'departments' | 'reservations' | 'stays' | 'tenants';

@Component({
  selector: 'app-tutorial',
  standalone: true,
  imports: [CommonModule, FormsModule, ReplaceNewlinesPipe],
  templateUrl: './tutorial.html',
  styleUrl: './tutorial.css'
})
export class TutorialComponent {
  private router = inject(Router);
  private tutorialService = inject(TutorialService);
  private dateController = inject(DateControllerService);

  // Navigation
  currentSection = signal<TutorialSection>('welcome');
  sidebarOpen = signal(true);

  // Date controller
  simulatedDate = this.dateController.simulatedDate;
  simulatedDateStr = this.dateController.simulatedDateStr;
  simulatedDateTimeStr = this.dateController.simulatedDateTimeStr;
  simulatedDateDisplay = this.dateController.simulatedDateDisplay;

  // Tutorial data (proxied from service)
  complexes = this.tutorialService.complexes;
  departments = this.tutorialService.departments;
  reservations = this.tutorialService.reservations;
  tenants = this.tutorialService.tenants;
  stays = this.tutorialService.stays;
  classifications = this.tutorialService.classifications;
  reservationSummary = this.tutorialService.reservationSummary;
  staySummary = this.tutorialService.staySummary;
  complexSummaries = this.tutorialService.complexSummaries;

  // Tutorial modal system
  showTutorialModal = signal(false);
  tutorialModalTitle = signal('');
  tutorialModalContent = signal('');
  tutorialModalStep = signal(0);
  tutorialModalTotalSteps = signal(0);

  // Date controller highlight - guides user to manually change the date
  highlightDateController = signal(false);
  dateControllerHint = signal('');

  // Form data for interactive flow
  complexForm = signal({ nombre: '', ubicacion: '', descripcion: '' });
  departmentForm = signal({
    nombre: '',
    numeroHabitaciones: 1,
    precioPorNoche: 10000,
    tamanoM2: 50,
    incluyeCochera: true,
    incluyeDesayuno: false,
    tieneWifi: true,
    tienePileta: false,
    complexId: 0
  });
  reservationForm = signal({
    firstName: '',
    lastName: '',
    documentNumber: '',
    phoneNumber: '',
    cantidadPersonas: 1,
    cantidadVehiculos: 0,
    fechaCheckIn: '',
    fechaCheckOut: '',
    departmentId: 0,
    precioTotal: 0,
    montoSenia: 0
  });
  tenantForm = signal({
    documentNumber: '',
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: ''
  });

  // Flow step tracking
  flowStep = signal(0); // 0=none, 1=complex created, 2=dept created, 3=reservation created, 4=checkin, 5=checkout
  selectedComplexId = signal(0);
  selectedDepartmentId = signal(0);
  selectedReservationId = signal(0);
  selectedStayId = signal(0);

  // Checkout form
  checkoutForm = signal({
    comentariosCheckOut: '',
    estadoDepartamento: 'GOOD' as 'GOOD' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE' | 'CLEANING_REQUIRED',
    classificationScore: 0,
    classificationReviewComment: ''
  });

  // Available complexes for department selection
  availableComplexes = computed(() => this.tutorialService.complexes());
  availableDepartments = computed(() => this.tutorialService.departments());

  constructor() {
    // Set default dates for reservation form
    this.reservationForm.set({
      ...this.reservationForm(),
      fechaCheckIn: this.dateController.getDateStrOffset(1),
      fechaCheckOut: this.dateController.getDateStrOffset(4)
    });
  }

  // ==========================================
  // NAVIGATION
  // ==========================================

  navigate(section: TutorialSection): void {
    this.currentSection.set(section);
  }

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  // ==========================================
  // DATE CONTROLLER
  // ==========================================

  setDateFromString(dateStr: string): void {
    this.dateController.setDateFromString(dateStr);
    // Update reservation form dates
    this.reservationForm.update(f => ({
      ...f,
      fechaCheckIn: this.dateController.getDateStrOffset(1),
      fechaCheckOut: this.dateController.getDateStrOffset(4)
    }));
  }

  addDays(days: number): void {
    this.dateController.addDays(days);
    this.reservationForm.update(f => ({
      ...f,
      fechaCheckIn: this.dateController.getDateStrOffset(1),
      fechaCheckOut: this.dateController.getDateStrOffset(4)
    }));
  }

  resetDate(): void {
    this.dateController.resetToReal();
    this.reservationForm.update(f => ({
      ...f,
      fechaCheckIn: this.dateController.getDateStrOffset(1),
      fechaCheckOut: this.dateController.getDateStrOffset(4)
    }));
  }

  // ==========================================
  // TUTORIAL MODALS
  // ==========================================

  showInfoModal(title: string, content: string): void {
    this.tutorialModalTitle.set(title);
    this.tutorialModalContent.set(content);
    this.tutorialModalStep.set(0);
    this.tutorialModalTotalSteps.set(0);
    this.showTutorialModal.set(true);
  }

  closeTutorialModal(): void {
    this.showTutorialModal.set(false);
  }

  // ==========================================
  // WELCOME SECTION
  // ==========================================

  startInteractiveFlow(): void {
    this.tutorialService.resetAll();
    this.flowStep.set(0);
    this.navigate('flow');
    this.showInfoModal(
      '🚀 ¡Comencemos!',
      'Vamos a recorrer todo el flujo de Nido Sereno paso a paso.\n\n' +
      '1️⃣ Primero crearemos un COMPLEJO (tu propiedad)\n' +
      '2️⃣ Luego agregaremos DEPARTAMENTOS para alquilar\n' +
      '3️⃣ Crearemos una RESERVA con datos de un reservante\n' +
      '4️⃣ Haremos CHECK-IN cuando lleguen\n' +
      '5️⃣ Finalmente haremos CHECK-OUT y calificaremos al reservante\n\n' +
      'En cada paso, los campos se prellenarán con datos de ejemplo, pero podés editarlos.\n\n' +
      '¡Empecemos!'
    );
  }

  // ==========================================
  // FLOW: CREATE COMPLEX
  // ==========================================

  autoFillComplexForm(): void {
    const filled = this.tutorialService.autoFillComplex();
    this.complexForm.set(filled);
  }

  createComplex(): void {
    const form = this.complexForm();
    if (!form.nombre || !form.ubicacion) {
      this.showInfoModal('⚠️ Campos requeridos', 'Completá al menos el nombre y la ubicación del complejo.');
      return;
    }
    const complex = this.tutorialService.createComplex(form.nombre, form.ubicacion, form.descripcion);
    this.selectedComplexId.set(complex.id);
    this.flowStep.set(1);

    this.showInfoModal(
      '🏢 ¡Complejo creado!',
      `Se creó el complejo "${complex.nombre}" en ${complex.ubicacion}.\n\n` +
      'Un COMPLEJO es tu propiedad: puede ser un hotel, un conjunto de departamentos, o cualquier lugar que alquilás.\n\n' +
      'Ahora vamos a agregar DEPARTAMENTOS dentro de este complejo.\n\n' +
      '👉 Hacé clic en "Siguiente: Crear Departamento"'
    );
  }

  // ==========================================
  // FLOW: CREATE DEPARTMENT
  // ==========================================

  autoFillDepartmentForm(): void {
    const filled = this.tutorialService.autoFillDepartment(this.selectedComplexId());
    this.departmentForm.set({
      ...filled,
      complexId: this.selectedComplexId()
    });
  }

  createDepartment(): void {
    const form = this.departmentForm();
    if (!form.nombre || form.complexId === 0) {
      this.showInfoModal('⚠️ Campos requeridos', 'Completá el nombre del departamento y seleccioná un complejo.');
      return;
    }
    const dept = this.tutorialService.createDepartment(form);
    this.selectedDepartmentId.set(dept.id);
    this.flowStep.set(2);

    this.showInfoModal(
      '🚪 ¡Departamento creado!',
      `Se creó el departamento "${dept.nombre}" en el complejo "${dept.complejoNombre}".\n\n` +
      `Precio por noche: $${dept.precioPorNoche.toLocaleString('es-AR')}\n` +
      `Habitaciones: ${dept.numeroHabitaciones} | Tamaño: ${dept.tamanoM2}m²\n\n` +
      'Un DEPARTAMENTO es una unidad alquilable dentro de tu complejo.\n\n' +
      'Ahora vamos a crear una RESERVA para este departamento.\n\n' +
      '👉 Hacé clic en "Siguiente: Crear Reserva"'
    );
  }

  // ==========================================
  // FLOW: CREATE RESERVATION
  // ==========================================

  autoFillReservationForm(): void {
    const filled = this.tutorialService.autoFillReservation();
    const dept = this.tutorialService.departments().find(d => d.id === this.selectedDepartmentId());
    const checkIn = this.dateController.getDateStrOffset(1);
    const checkOut = this.dateController.getDateStrOffset(4);
    const nights = 3;
    const precioTotal = dept ? dept.precioPorNoche * nights : 30000;

    this.reservationForm.set({
      ...filled,
      fechaCheckIn: checkIn,
      fechaCheckOut: checkOut,
      departmentId: this.selectedDepartmentId(),
      precioTotal,
      montoSenia: Math.floor(precioTotal * 0.3)
    });
  }

  createReservation(): void {
    const form = this.reservationForm();
    if (!form.firstName || !form.fechaCheckIn || !form.fechaCheckOut || form.departmentId === 0) {
      this.showInfoModal('⚠️ Campos requeridos', 'Completá los datos del reservante, las fechas y seleccioná un departamento.');
      return;
    }
    const reservation = this.tutorialService.createReservation(form);
    this.selectedReservationId.set(reservation.id);
    this.flowStep.set(3);

    this.showInfoModal(
      '📋 ¡Reserva creada!',
      `Se creó la reserva para ${form.firstName} ${form.lastName}.\n\n` +
      `Check-in: ${form.fechaCheckIn}\n` +
      `Check-out: ${form.fechaCheckOut}\n` +
      `Precio total: $${form.precioTotal.toLocaleString('es-AR')}\n` +
      `Señal: $${form.montoSenia.toLocaleString('es-AR')}\n\n` +
      'Una RESERVA es la solicitud de alquiler. Tiene estado PENDING hasta que se hace check-in.\n\n' +
      'Ahora simularemos el CHECK-IN cuando el reservante llega.\n\n' +
      '👉 Hacé clic en "Siguiente: Check-In"'
    );

    // Prepare the date controller highlight for the next step
    this.prepareCheckIn();
  }

  // ==========================================
  // FLOW: CHECK-IN
  // ==========================================

  autoFillTenantForm(): void {
    const filled = this.tutorialService.autoFillTenant();
    this.tenantForm.set(filled);
  }

  // Prepare for check-in step - guide user to set the date manually
  prepareCheckIn(): void {
    const res = this.tutorialService.reservations().find(r => r.id === this.selectedReservationId());
    if (res) {
      this.dateControllerHint.set(
        `📅 La reserva tiene fecha de check-in: ${res.fechaCheckIn}. \n\n` +
        `⚠️ El check-in SOLO se puede hacer el día exacto de la reserva.\n\n` +
        `👇 Mové la fecha simulada a ${res.fechaCheckIn} usando el calendario, los botones +/- o escribiendo la fecha.\n\n` +
        `Si intentás hacer check-in con otra fecha, el sistema te lo impedirá.`
      );
      this.highlightDateController.set(true);
    }
  }

  doCheckIn(): void {
    const tenantForm = this.tenantForm();
    if (!tenantForm.firstName || !tenantForm.documentNumber) {
      this.showInfoModal('⚠️ Campos requeridos', 'Completá al menos el nombre y DNI del inquilino.');
      return;
    }

    // Validate: simulated date must match the reservation's check-in date
    const res = this.tutorialService.reservations().find(r => r.id === this.selectedReservationId());
    if (res) {
      const simDate = this.dateController.simulatedDateStr();
      if (simDate !== res.fechaCheckIn) {
        this.showInfoModal(
          '📅 Fecha incorrecta',
          `No podés hacer check-in hoy. La reserva tiene fecha de check-in: <strong>${res.fechaCheckIn}</strong>.\n\n` +
          `La fecha simulada actual es: <strong>${simDate}</strong>.\n\n` +
          `👇 Mové la fecha simulada en el sidebar a <strong>${res.fechaCheckIn}</strong> para poder hacer check-in.`
        );
        return;
      }
    }

    // Create or find tenant
    const tenant = this.tutorialService.createOrUpdateTenant(tenantForm);

    const stay = this.tutorialService.checkIn({
      reservationId: this.selectedReservationId(),
      departmentId: this.selectedDepartmentId(),
      fechaHoraCheckInReal: this.dateController.simulatedDateTimeStr(),
      fechaCheckOutPlaneada: res?.fechaCheckOut || this.dateController.getDateStrOffset(3),
      comentariosCheckIn: 'Check-in desde tutorial',
      tenants: [tenant]
    });

    this.selectedStayId.set(stay.id);
    this.flowStep.set(4);
    this.highlightDateController.set(false);

    this.showInfoModal(
      '🛏️ ¡Check-In realizado!',
      `El reservante ${tenant.firstName} ${tenant.lastName} se registró en el sistema.\n\n` +
      `Estadía ID: ${stay.id}\n` +
      `Departamento: ${stay.departamentoNombre}\n` +
      `Noches: ${stay.cantidadNoches}\n` +
      `Estado: ACTIVA\n\n` +
      'Al hacer CHECK-IN:\n' +
      '• La reserva cambia a estado CHECKED_IN\n' +
      '• El departamento se marca como OCUPADO\n' +
      '• Se crea una ESTADÍA activa\n\n' +
      'Ahora mové la fecha simulada al día de check-out y hacé CHECK-OUT.\n\n' +
      '👉 Hacé clic en "Siguiente: Check-Out"'
    );

    // Prepare the date controller highlight for the next step
    this.prepareCheckOut();
  }

  // ==========================================
  // FLOW: CHECK-OUT
  // ==========================================

  autoFillCheckoutForm(): void {
    const filled = this.tutorialService.autoFillCheckout();
    this.checkoutForm.set(filled);
  }

  // Prepare for check-out step - guide user to set the date manually
  prepareCheckOut(): void {
    const stay = this.tutorialService.stays().find(s => s.id === this.selectedStayId());
    if (stay) {
      const checkOutDate = stay.fechaCheckOutPlaneada;
      this.dateControllerHint.set(
        `📅 La estadía tiene fecha de check-out planeada: ${checkOutDate}. \n\n` +
        `⚠️ El check-out SOLO se puede hacer en el día de salida o después.\n\n` +
        `👇 Mové la fecha simulada a ${checkOutDate} o posterior usando el calendario, los botones +/- o escribiendo la fecha.\n\n` +
        `Si intentás hacer check-out antes de esa fecha, el sistema te lo impedirá.`
      );
      this.highlightDateController.set(true);
    }
  }

  doCheckOut(): void {
    const checkout = this.checkoutForm();
    const stayId = this.selectedStayId();

    // Validate: simulated date must be >= planned check-out date
    const stay = this.tutorialService.stays().find(s => s.id === stayId);
    if (stay && stay.fechaCheckOutPlaneada) {
      const simDate = this.dateController.simulatedDateStr();
      if (simDate < stay.fechaCheckOutPlaneada) {
        this.showInfoModal(
          '📅 Fecha incorrecta',
          `No podés hacer check-out hoy. La estadía tiene fecha de check-out planeada: <strong>${stay.fechaCheckOutPlaneada}</strong>.\n\n` +
          `La fecha simulada actual es: <strong>${simDate}</strong>.\n\n` +
          `👇 Mové la fecha simulada en el sidebar a <strong>${stay.fechaCheckOutPlaneada}</strong> o posterior para poder hacer check-out.`
        );
        return;
      }
    }

    // Use the current simulated date (user should have set it manually)
    const updatedStay = this.tutorialService.checkOut(stayId, {
      fechaHoraCheckOutReal: this.dateController.simulatedDateTimeStr(),
      comentariosCheckOut: checkout.comentariosCheckOut || 'Check-out desde tutorial',
      estadoDepartamento: checkout.estadoDepartamento,
      classificationScore: checkout.classificationScore || undefined,
      classificationReviewComment: checkout.classificationReviewComment || undefined
    });

    this.flowStep.set(5);
    this.highlightDateController.set(false);

    const scoreText = checkout.classificationScore
      ? `\n\n⭐ Clasificación: ${'★'.repeat(checkout.classificationScore)}${'☆'.repeat(5 - checkout.classificationScore)}\nComentario: ${checkout.classificationReviewComment || 'Sin comentario'}`
      : '';

    this.showInfoModal(
      '✅ ¡Check-Out completado!',
      `La estadía finalizó correctamente.${scoreText}\n\n` +
      `Estado del departamento: ${checkout.estadoDepartamento}\n\n` +
      'Al hacer CHECK-OUT:\n' +
      '• La estadía cambia a COMPLETED\n' +
      '• La reserva cambia a COMPLETED\n' +
      '• El departamento queda DISPONIBLE nuevamente\n' +
      '• Si se dio una clasificación, queda registrada en el historial del inquilino\n\n' +
      '🎉 ¡Felicitaciones! Recorriste todo el flujo básico.\n\n' +
      '👉 Ahora explorá el DASHBOARD y los otros paneles para ver cómo se reflejan los datos.'
    );
  }

  // ==========================================
  // RESET
  // ==========================================

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  resetTutorial(): void {
    this.tutorialService.resetAll();
    this.flowStep.set(0);
    this.selectedComplexId.set(0);
    this.selectedDepartmentId.set(0);
    this.selectedReservationId.set(0);
    this.selectedStayId.set(0);
    this.dateController.resetToReal();
    this.navigate('welcome');
  }

  // ==========================================
  // HELPERS
  // ==========================================

  getTotalDepartments(): number {
    return this.tutorialService.complexSummaries().reduce((sum, cs) => sum + cs.totalDepartments, 0);
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED': return 'bg-green-100 text-green-800';
      case 'CHECKED_IN': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-gray-100 text-gray-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getEstadoBadgeClassStay(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'COMPLETED': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getEstadoDepartamentoLabel(estado: string | null): string {
    switch (estado) {
      case 'GOOD': return 'Buen estado';
      case 'MINOR_DAMAGE': return 'Daño menor';
      case 'MAJOR_DAMAGE': return 'Daño mayor';
      case 'CLEANING_REQUIRED': return 'Necesita limpieza';
      default: return 'Sin registrar';
    }
  }

  getStars(score: number): string {
    return '★'.repeat(score) + '☆'.repeat(5 - score);
  }

  formatCurrency(value: number): string {
    return `$${value.toLocaleString('es-AR')}`;
  }

  getStarsSafe(score: any): string {
    const num = typeof score === 'number' ? score : parseFloat(score);
    if (isNaN(num)) return '☆☆☆☆☆';
    const rounded = Math.round(num);
    return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
  }

  // ==========================================
  // FORM SETTER METHODS (for template bindings)
  // ==========================================

  // Complex form
  setComplexNombre(v: string): void { this.complexForm.update(f => ({...f, nombre: v})); }
  setComplexUbicacion(v: string): void { this.complexForm.update(f => ({...f, ubicacion: v})); }
  setComplexDescripcion(v: string): void { this.complexForm.update(f => ({...f, descripcion: v})); }

  // Department form
  setDeptNombre(v: string): void { this.departmentForm.update(f => ({...f, nombre: v})); }
  setDeptComplexId(v: number): void { this.departmentForm.update(f => ({...f, complexId: v})); }
  setDeptHabitaciones(v: number): void { this.departmentForm.update(f => ({...f, numeroHabitaciones: v})); }
  setDeptPrecio(v: number): void { this.departmentForm.update(f => ({...f, precioPorNoche: v})); }
  setDeptTamano(v: number): void { this.departmentForm.update(f => ({...f, tamanoM2: v})); }
  setDeptWifi(v: boolean): void { this.departmentForm.update(f => ({...f, tieneWifi: v})); }
  setDeptCochera(v: boolean): void { this.departmentForm.update(f => ({...f, incluyeCochera: v})); }
  setDeptDesayuno(v: boolean): void { this.departmentForm.update(f => ({...f, incluyeDesayuno: v})); }
  setDeptPileta(v: boolean): void { this.departmentForm.update(f => ({...f, tienePileta: v})); }

  // Reservation form
  setResFirstName(v: string): void { this.reservationForm.update(f => ({...f, firstName: v})); }
  setResLastName(v: string): void { this.reservationForm.update(f => ({...f, lastName: v})); }
  setResDNI(v: string): void { this.reservationForm.update(f => ({...f, documentNumber: v})); }
  setResPhone(v: string): void { this.reservationForm.update(f => ({...f, phoneNumber: v})); }
  setResCheckIn(v: string): void { this.reservationForm.update(f => ({...f, fechaCheckIn: v})); }
  setResCheckOut(v: string): void { this.reservationForm.update(f => ({...f, fechaCheckOut: v})); }
  setResDeptId(v: number): void { this.reservationForm.update(f => ({...f, departmentId: v})); }
  setResPersonas(v: number): void { this.reservationForm.update(f => ({...f, cantidadPersonas: v})); }
  setResPrecio(v: number): void { this.reservationForm.update(f => ({...f, precioTotal: v})); }
  setResSenia(v: number): void { this.reservationForm.update(f => ({...f, montoSenia: v})); }

  // Tenant form
  setTenantDNI(v: string): void { this.tenantForm.update(f => ({...f, documentNumber: v})); }
  setTenantFirstName(v: string): void { this.tenantForm.update(f => ({...f, firstName: v})); }
  setTenantLastName(v: string): void { this.tenantForm.update(f => ({...f, lastName: v})); }
  setTenantEmail(v: string): void { this.tenantForm.update(f => ({...f, email: v})); }
  setTenantPhone(v: string): void { this.tenantForm.update(f => ({...f, phoneNumber: v})); }
  setTenantDOB(v: string): void { this.tenantForm.update(f => ({...f, dateOfBirth: v})); }

  // Checkout form
  setCheckoutComentarios(v: string): void { this.checkoutForm.update(f => ({...f, comentariosCheckOut: v})); }
  setCheckoutEstado(v: string): void { this.checkoutForm.update(f => ({...f, estadoDepartamento: v as any})); }
  setCheckoutScore(v: number): void { this.checkoutForm.update(f => ({...f, classificationScore: v})); }
  setCheckoutComment(v: string): void { this.checkoutForm.update(f => ({...f, classificationReviewComment: v})); }

  // ==========================================
  // TEMPLATE HELPER METHODS (no arrow functions in templates)
  // ==========================================

  getDeptCountForComplex(complexId: number): number {
    return this.tutorialService.departments().filter(d => d.complexId === complexId).length;
  }

  getReservationCheckInDate(reservationId: number): string | undefined {
    const res = this.tutorialService.reservations().find(r => r.id === reservationId);
    return res?.fechaCheckIn;
  }
}
