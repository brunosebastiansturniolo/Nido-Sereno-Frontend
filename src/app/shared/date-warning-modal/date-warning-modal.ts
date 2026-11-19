import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Modal de advertencia que aparece al activar el simulador de fecha.
 * Informa al usuario que las fechas de check-in/check-out se validarán
 * contra la fecha simulada, no la fecha real.
 * Tiene opción "No volver a mostrar" para no mostrarlo más.
 */
@Component({
  selector: 'app-date-warning-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="visible()" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6 relative">
        <!-- Botón cerrar -->
        <button
          (click)="onClose()"
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
          type="button"
        >
          ✕
        </button>

        <!-- Icono de advertencia -->
        <div class="flex items-center gap-3 mb-4">
          <div class="w-14 h-14 flex items-center justify-center rounded-full bg-amber-100">
            <span class="text-3xl">⚠️</span>
          </div>
          <h2 class="text-xl font-bold text-amber-800">Simulador de Fecha ENCENDIDO</h2>
        </div>

        <!-- Mensaje de advertencia -->
        <div class="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mb-4">
          <p class="text-sm text-amber-900 leading-relaxed mb-2">
            El simulador de fecha está <strong>activado</strong>. Esto significa que:
          </p>
          <ul class="text-sm text-amber-900 leading-relaxed list-disc list-inside space-y-1">
            <li>Las fechas de <strong>check-in</strong> y <strong>check-out</strong> se validarán contra la <strong>fecha simulada</strong>, no la fecha real.</li>
            <li>El backend usará la fecha simulada para crear reservas y estadías.</li>
            <li>Los formularios se pre-llenarán con la fecha simulada.</li>
            <li>El <strong>dashboard</strong> no se ve afectado por la fecha simulada y siempre mostrará el estado actual del complejo.</li>
          </ul>
          <p class="text-sm text-amber-900 leading-relaxed mt-2 font-semibold">
            ¿Deseás continuar con el simulador activado?
          </p>
        </div>

        <!-- Checkbox "No volver a mostrar" -->
        <div class="mb-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              [checked]="dontShowAgain()"
              (change)="onDontShowAgainChange($event)"
              class="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
            />
            <span class="text-sm text-gray-600">No volver a mostrar este mensaje</span>
          </label>
        </div>

        <!-- Botones de acción -->
        <div class="flex justify-end gap-3">
          <button
            (click)="onCancel()"
            type="button"
            class="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            (click)="onConfirm()"
            type="button"
            class="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `
})
export class DateWarningModalComponent {
  visible = input(false);
  dontShowAgain = input(false);
  
  // Se emite cuando el usuario confirma y quiere activar el simulador
  confirmed = output<void>();
  // Se emite cuando el usuario cancela (no quiere activar el simulador)
  cancelled = output<void>();
  // Se emite cuando el checkbox "no volver a mostrar" cambia
  dontShowAgainChanged = output<boolean>();
  // Se emite cuando se cierra el modal (sin acción)
  closed = output<void>();

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onClose(): void {
    this.closed.emit();
  }

  onDontShowAgainChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.dontShowAgainChanged.emit(checked);
  }
}
