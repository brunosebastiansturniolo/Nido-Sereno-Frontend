import { Injectable, signal, computed } from '@angular/core';

/**
 * Servicio que controla la fecha simulada en el tutorial.
 * Permite avanzar/retroceder el tiempo para ver cómo impacta en cada panel.
 */
@Injectable({
  providedIn: 'root'
})
export class DateControllerService {
  // La fecha simulada actual (por defecto la fecha real)
  private _simulatedDate = signal<Date>(new Date());

  simulatedDate = this._simulatedDate.asReadonly();

  // Formateo útil
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

  /** Avanzar 1 hora */
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

  /** Si una fecha real está en el pasado relativo a la fecha simulada */
  isPast(date: Date): boolean {
    return date < this._simulatedDate();
  }

  /** Si una fecha real está en el futuro relativo a la fecha simulada */
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
}
