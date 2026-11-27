import { Injectable } from '@angular/core';

// Datos aleatorios para auto-relleno
const nombres = ['María', 'Juan', 'Carlos', 'Ana', 'Luis', 'Laura', 'Pedro', 'Sofía', 'Diego', 'Valentina'];
const apellidos = ['García', 'Rodríguez', 'López', 'Martínez', 'Fernández', 'González', 'Pérez', 'Sánchez', 'Romero', 'Torres'];
const calles = ['Av. San Martín', 'Calle Belgrano', 'Av. Rivadavia', 'Calle Mitre', 'Av. Libertador', 'Calle 9 de Julio'];
const ciudades = ['Bariloche', 'Mar del Plata', 'Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza'];
const nombresComplejo = ['Los Arrayanes', 'El Mirador', 'Villa Serena', 'Las Garzas', 'Sol y Luna', 'El Bosque'];
const nombresDepto = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'];
const dominiosEmail = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'mail.com', 'protonmail.com'];

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
  const domain = randomFrom(dominiosEmail);
  return `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`;
}

@Injectable({
  providedIn: 'root'
})
export class AutoFillService {

  // ==========================================
  // COMPLEXES
  // ==========================================

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

  autoFillDepartment(): {
    nombre: string;
    numeroHabitaciones: number;
    precioPorNoche: number;
    tamañoM2: number;
    incluyeCochera: boolean;
    incluyeDesayuno: boolean;
    tieneCocina: boolean;
    tieneWifi: boolean;
    tienePileta: boolean;
  } {
    return {
      nombre: randomFrom(nombresDepto),
      numeroHabitaciones: Math.floor(1 + Math.random() * 3),
      precioPorNoche: Math.floor(5000 + Math.random() * 15000),
      tamañoM2: Math.floor(30 + Math.random() * 70),
      incluyeCochera: Math.random() > 0.3,
      incluyeDesayuno: Math.random() > 0.4,
      tieneCocina: Math.random() > 0.5,
      tieneWifi: true,
      tienePileta: Math.random() > 0.5
    };
  }

  // ==========================================
  // RESERVATIONS
  // ==========================================

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
  // TENANTS (para check-in)
  // ==========================================

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
    // Generar una fecha de nacimiento donde la persona tenga entre 18 y 80 años
    // respecto a la fecha actual (no usar años fijos como 1980-1999)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate();
    const age = 18 + Math.floor(Math.random() * 63); // 18-80 años
    let birthYear = currentYear - age;
    let birthMonth = 1 + Math.floor(Math.random() * 12); // 1-12
    let birthDay = 1 + Math.floor(Math.random() * 28); // 1-28 (seguro para todos los meses)
    return {
      documentNumber: randomDNI(),
      firstName,
      lastName,
      email: randomEmail(firstName, lastName),
      phoneNumber: randomPhone(),
      dateOfBirth: String(birthYear) + '-' +
                   String(birthMonth).padStart(2, '0') + '-' +
                   String(birthDay).padStart(2, '0')
    };
  }

  // ==========================================
  // CHECKOUT
  // ==========================================

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
}
