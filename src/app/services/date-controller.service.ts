import { Injectable, signal, computed, effect } from '@angular/core';

/**
 * Servicio que controla el simulador de fecha en la app real.
 * - Permite activar/desactivar el simulador con un switch
 * - Cuando está activo, usa una fecha simulada en lugar de la fecha real
 * - La fecha simulada se envía al backend vía header X-Simulated-Date
 * - El estado del switch y la fecha simulada se persisten en localStorage
 * - Al activar, muestra un modal de advertencia (con opción "no volver a mostrar")
 */
@Injectable({
  providedIn: 'root'
})
export class DateControllerService {
  private readonly STORAGE_KEY_ENABLED = 'dateSimulator_enabled';
  private readonly STORAGE_KEY_DATE = 'dateSimulator_date';
  private readonly STORAGE_KEY_WARNING = 'dateSimulator_skipWarning';

  // Si el simulador está activado
  private _enabled = signal<boolean>(this.loadEnabled());

  enabled = this._enabled.asReadonly();

  // La fecha simulada actual (por defecto la fecha real)
  private _simulatedDate = signal<Date>(this.loadDate());

  simulatedDate = this._simulatedDate.asReadonly();

  // Efecto: cuando cambia la fecha simulada, guardarla en localStorage
  private _ = effect(() => {
    localStorage.setItem(this.STORAGE_KEY_DATE, this._simulatedDate().toISOString());
  });

  // Efecto: cuando cambia el estado del switch, guardarlo en localStorage
  private __ = effect(() => {
    localStorage.setItem(this.STORAGE_KEY_ENABLED, this._enabled() ? '1' : '0');
  });

  // --- Formateo útil ---

  simulatedDateStr = computed(() => {
    const d = this._simulatedDate();
    return d.toISOString().slice(0, 10);
  });

  simulatedDateTimeStr = computed(() => {
    const d = this._simulatedDate();
    return d.toISOString().slice(0, 16);
  });

  simulatedDateDisplay = computed(() => {
    const d = this._simulatedDate();
    return d.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  simulatedDateTimeDisplay = computed(() => {
    const d = this._simulatedDate();
    return d.toLocaleString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  });

  /**
   * Devuelve la fecha a usar según el estado del switch.
   * Si el simulador está activo, devuelve la fecha simulada.
   * Si está inactivo, devuelve la fecha real actual.
   */
  getDate(): Date {
    if (this._enabled()) {
      return new Date(this._simulatedDate());
    }
    return new Date();
  }

  /**
   * Devuelve el string datetime a usar según el estado del switch.
   * Formato: "YYYY-MM-DDTHH:mm"
   */
  getDateTimeStr(): string {
    if (this._enabled()) {
      return this._simulatedDate().toISOString().slice(0, 16);
    }
    return new Date().toISOString().slice(0, 16);
  }

  /**
   * Devuelve el string date a usar según el estado del switch.
   * Formato: "YYYY-MM-DD"
   */
  getDateStr(): string {
    if (this._enabled()) {
      return this._simulatedDate().toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  }

  // --- Control del switch ---

  /** Activar el simulador de fecha */
  enable(): void {
    this._enabled.set(true);
  }

  /** Desactivar el simulador de fecha y resetear a la fecha real */
  disable(): void {
    this._enabled.set(false);
    this._simulatedDate.set(new Date());
  }

  /** Alternar el estado del switch */
  toggle(): void {
    this._enabled.update(val => !val);
    if (!this._enabled()) {
      // Al desactivar, resetear a la fecha real
      this._simulatedDate.set(new Date());
    }
  }

  // --- Control de la fecha simulada ---

  /** Establecer una fecha específica */
  setDate(date: Date): void {
    this._simulatedDate.set(new Date(date));
  }

  /** Establecer desde string YYYY-MM-DD */
  setDateFromString(dateStr: string): void {
    this._simulatedDate.set(new Date(dateStr + 'T12:00:00'));
  }

  /** Avanzar N días */
  addDays(days: number): void {
    const current = this._simulatedDate();
    const next = new Date(current);
    next.setDate(next.getDate() + days);
    this._simulatedDate.set(next);
  }

  /** Retroceder N días */
  subtractDays(days: number): void {
    this.addDays(-days);
  }

  /** Avanzar N horas */
  addHours(hours: number): void {
    const current = this._simulatedDate();
    const next = new Date(current);
    next.setHours(next.getHours() + hours);
    this._simulatedDate.set(next);
  }

  /** Resetear a la fecha real actual */
  resetToReal(): void {
    this._simulatedDate.set(new Date());
  }

  /** Obtener una fecha relativa a la simulada */
  getDateOffset(daysOffset: number): Date {
    const d = new Date(this._simulatedDate());
    d.setDate(d.getDate() + daysOffset);
    return d;
  }

  /** Obtener string YYYY-MM-DD con offset */
  getDateStrOffset(daysOffset: number): string {
    return this.getDateOffset(daysOffset).toISOString().slice(0, 10);
  }

  /** Si una fecha está en el pasado relativo a la fecha simulada */
  isPast(date: Date): boolean {
    return date < this._simulatedDate();
  }

  /** Si una fecha está en el futuro relativo a la fecha simulada */
  isFuture(date: Date): boolean {
    return date > this._simulatedDate();
  }

  /** Si una fecha coincide con la fecha simulada (mismo día) */
  isToday(date: Date): boolean {
    const sim = this._simulatedDate();
    return date.getDate() === sim.getDate() &&
           date.getMonth() === sim.getMonth() &&
           date.getFullYear() === sim.getFullYear();
  }

  // --- Modal de advertencia ---

  /**
   * Devuelve true si el usuario ya vio el modal de advertencia
   * y marcó "no volver a mostrar".
   */
  hasDismissedWarning(): boolean {
    return localStorage.getItem(this.STORAGE_KEY_WARNING) === '1';
  }

  /** Marcar que el usuario no quiere ver más el modal de advertencia */
  dismissWarning(): void {
    localStorage.setItem(this.STORAGE_KEY_WARNING, '1');
  }

  // --- Persistencia ---

  private loadEnabled(): boolean {
    return localStorage.getItem(this.STORAGE_KEY_ENABLED) === '1';
  }

  private loadDate(): Date {
    const stored = localStorage.getItem(this.STORAGE_KEY_DATE);
    if (stored) {
      try {
        const d = new Date(stored);
        if (!isNaN(d.getTime())) {
          return d;
        }
      } catch {
        // Ignorar si no se puede parsear
      }
    }
    return new Date();
  }
}
