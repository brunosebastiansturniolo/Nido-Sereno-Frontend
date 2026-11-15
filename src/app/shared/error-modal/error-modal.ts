import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-error-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="visible()" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6 relative">
        <!-- Botón cerrar -->
        <button
          (click)="onClose()"
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
          type="button"
        >
          ✕
        </button>

        <!-- Icono de error -->
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 flex items-center justify-center rounded-full bg-red-100">
            <span class="text-2xl">⚠️</span>
          </div>
          <h2 class="text-xl font-bold text-gray-800">Error</h2>
        </div>

        <!-- Mensaje del error -->
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p class="text-sm text-red-800 whitespace-pre-line leading-relaxed">{{ message() }}</p>
        </div>

        <!-- Botón de acción -->
        <div class="flex justify-end">
          <button
            (click)="onClose()"
            type="button"
            class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition"
          >
            Entendido
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
export class ErrorModalComponent {
  visible = input(false);
  message = input('');
  closed = output<void>();

  onClose(): void {
    this.closed.emit();
  }
}
