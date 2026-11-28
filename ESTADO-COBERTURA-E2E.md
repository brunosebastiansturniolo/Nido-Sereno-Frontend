# Estado de cobertura de pruebas E2E

**Revisión:** 28 de noviembre de 2026  
**Alcance:** pruebas de navegador Playwright del frontend y comparación con los casos de uso conversados.

## Resumen

No están automatizados todos los casos que definimos. En el inventario actual Playwright lista **20 pruebas en 4 archivos**: 3 de autenticación y 17 de complejos, departamentos, reservas y estadías. Hay buena cobertura de varios recorridos normales y de algunas variaciones de check-in/check-out, pero quedan sin probar áreas completas —sobre todo horarios y disponibilidad de reservas, edición, cambios de perfiles de inquilinos y alertas operativas—, además de comportamientos parciales que no cubren todos los criterios acordados.

La lista se obtuvo con `PLAYWRIGHT_LOCAL_STACK=true npx playwright test --list` desde `Nido-Sereno-Frontend`. **Listar no ejecuta las pruebas**: esta revisión no confirma que las 20 pasen. El último resultado registrado en la conversación fue 19/19 para una versión anterior; no debe tomarse como evidencia de que el inventario actual de 20 pasó.

### Cómo leer el estado

- **Cubierto:** hay una prueba E2E que comprueba la acción y el resultado principal indicado.
- **Parcial:** hay una prueba relacionada, pero faltan variantes, aserciones o criterios conversados.
- **Pendiente:** no encontré una prueba E2E del comportamiento en el inventario actual.
- **A confirmar:** las conversaciones posteriores cambiaron o matizaron la regla; conviene decidir el criterio final antes de ampliar la prueba.

## Pruebas que existen actualmente

### Autenticación — 3 pruebas

| Archivo | Qué comprueba |
|---|---|
| `e2e/auth.spec.ts` | Abre el login y navega al formulario de registro. No envía el formulario. |
| `e2e/auth-workflow.local.spec.ts` | Registra una cuenta, recibe y usa el código de activación de MailDev, inicia sesión, rechaza un email duplicado, solicita recuperación, cambia la contraseña y comprueba que la anterior ya no sirve y la nueva sí. |
| `e2e/auth-refresh.local.spec.ts` | Espera el vencimiento del access token, dispara una petición protegida, verifica el refresh exitoso, la rotación de tokens y que la sesión no vuelva al login. |

### Complejos, departamentos, reservas y estadías — 17 pruebas

| Caso E2E | Qué comprueba |
|---|---|
| Crear complejo | El formulario crea un complejo y la lista muestra nombre, ubicación y descripción. |
| Crear y editar departamento | Crea una unidad desde la interfaz, comprueba el cálculo del mínimo de seña y asociación al complejo; modifica cocina y verifica la respuesta/listado. |
| Pausar departamento | Con una reserva futura, muestra una advertencia con la reserva, pausa sin cancelarla, refleja el estado y limita selectores de nuevas reservas/check-in express; permite reactivar. |
| Crear reserva y recalcular fechas | Comprueba valores iniciales (hoy/mañana, una noche), total al elegir unidad, recálculo al cambiar fechas/noches y la fila de una reserva pendiente para dos personas. |
| Cancelar con y sin seña | Confirma y descarta la cancelación, y verifica que el estado pagado se conserva como historial al cancelar. |
| Registrar seña en abonos | Comprueba que cancelar el diálogo no altera el importe, que un abono parcial mantiene el estado pendiente y que al alcanzar el mínimo pasa a confirmada. |
| Check-in desde reserva para dos | Comprueba dos formularios iniciales, identidad de inquilinos distinta de la persona reservante, confirmación/cancelación al agregar o quitar formularios, envío de dos huéspedes y check-in en curso. |
| Check-out con pago completo | Cobra exactamente el saldo restante, verifica el request, finalización, estado completado y persistencia de clasificación. |
| Check-out con deuda: `$40.000`, `$20.000` o `$0` | Tres variaciones sobre `$76.000` pendientes: saldo restante, advertencia, cancelación del modal en una variante, requisito de motivo según el comportamiento actual del test, y cierre como completada. |
| Check-in en otra fecha | Al llegar un día después, permite cancelar el primer intento, exige motivo y verifica la fecha/comentario enviados. |
| Check-in un día antes | Comprueba el aviso, el incremento de una noche de `$240.000` a `$320.000`, motivo obligatorio y total actualizado. |
| Check-in más tarde el mismo día | Registra la hora real sin modal de diferencia de fecha ni justificación automática. |
| Check-out un día tarde | Suma una noche, recalcula el saldo, exige justificación y finaliza el checkout. |
| Check-in express el mismo día | Comprueba salida planeada a las `10:00`, rechazo de una hora de salida igual a la llegada, una noche de precio, envío/persistencia de la hora y dos inquilinos. También prueba la recomendación de clasificación opcional y cancelar/continuar. |
| Check-out anticipado | Exige motivo por la fecha distinta, conserva el precio reservado y finaliza la estadía. |

**Nota sobre fixtures:** el `beforeAll` prepara la cuenta e inserta el complejo/departamento base mediante API. Hay pruebas separadas de creación por interfaz, pero no todos los escenarios recrean esas entidades por la pantalla.

## Casos conversados que todavía faltan o tienen cobertura parcial

### Reservas: horarios y disponibilidad — Pendiente

- Checkbox para elegir solo fechas o fecha y hora; horarios propuestos de llegada `13:00` y salida `10:00`.
- Reserva de entrada y salida el mismo día con horarios obligatorios, salida posterior a la entrada y cobro de una noche completa.
- Invalidar check-out a la misma hora o antes del check-in cuando ambas fechas son el mismo día.
- Validar conflictos con otras reservas y estadías en curso; bloquear horarios realmente superpuestos.
- Modal al coincidir en el día de salida/entrada, incluso con margen suficiente; confirmar o cancelar explícitamente.
- Cálculo y colores del margen de preparación: verde desde 4 horas, amarillo desde 2 y menos de 4, rojo por debajo de 2; permitir continuar si solo el margen es corto.
- Si faltan horas, completar rápidamente las dos reservas, guardar las horas de la reserva anterior, recalcular el mismo modal y bloquear si no se completa o si los horarios se pisan.
- Reserva pendiente bloqueando disponibilidad hasta cancelación, con estado/nombre/teléfono del reservante en el aviso y recomendación de contactarlo.
- Mostrar horas en “Mis reservas” cuando existan.

La prueba actual solo cubre fechas, noches y precio por fecha. **No** prueba todavía solapamientos, horas de limpieza, modal de disponibilidad ni persistencia de horarios.

### Crear/cancelar reservas — Parcial

- La creación y lista de una reserva pendiente, cantidad de personas y seña `$0` están cubiertas; la tabla de opciones de horarios todavía no.
- La cancelación verifica el comportamiento actual de `confirm()` del navegador. No comprueba el modal acordado que muestre cuánto se había señado, ni diferencia la confirmación simple de `$0` de la confirmación con importe.
- No se verifica desde la interfaz que una reserva cancelada deje de bloquear una fecha/hora conflictiva.

### Edición de reservas — Pendiente

No hay E2E para editar antes del check-in. Falta cubrir:

- Editar todo salvo nombre y teléfono del reservante.
- Recalcular precio al cambiar fechas y permitir ajuste manual cuando corresponda.
- Cambiar de departamento y comparar total anterior, nuevo cálculo y opción manual; elegir el valor por defecto y el mínimo de seña aplicable.
- Caso concreto Cabaña 1 → Suite Familiar: aceptar `$300.000` y requerir `$16.000` adicionales para el mínimo de `$80.000`, o conservar `$240.000` y la política anterior.
- Editar el importe pagado, tratar excedentes sin devolución y recomendar/elegir estado entre los permitidos.

### Inquilinos y datos personales — Pendiente

- Búsqueda/autocompletado por DNI y uso de los datos existentes.
- Edición del perfil encontrado, modal inmediato, verificación del DNI físico y cambio de persona cuando el DNI no coincide.
- Actualización del perfil global sin alterar datos históricos de estadías anteriores.
- Historial de modificaciones con propietario y fecha.

### Check-in y express — Parcial

- Las diferencias de fecha, justificación, llegada anticipada un día y llegada tardía el mismo día están cubiertas.
- No se prueba una llegada antes de la hora planeada pero en la misma fecha, la comprobación de que el departamento está libre, el aviso y su nota automática.
- En express, se prueba valor inicial de cantidad `1` y salida `10:00`, pero al cambiar cantidad a `2` el test pulsa además “Agregar inquilino”. Por eso **no demuestra** el requisito de que cambiar cantidad genere/reduzca formularios automáticamente conservando los datos.
- Falta comprobar la confirmación al quitar un formulario express que ya contiene datos.
- No se cubre aún el bloqueo por conflicto de horario con una reserva existente.

### Pagos durante la estadía — Pendiente

No hay prueba de editar el total acumulado pagado durante una estadía en curso, precargar el importe existente, mostrar el resumen anterior/nuevo/saldo, cancelar y volver al formulario, guardar el cambio ni actualizar el estado de pago manteniendo el huésped “Alojado”. Tampoco se prueba el caso acordado de que el pago se conserve si luego se cancela la recomendación de clasificación en el flujo de check-out.

### Check-out y clasificación — Parcial / A confirmar

- Se prueban el pago total al salir, tres importes parciales/cero, clasificación guardada y la recomendación si falta puntuación o comentario por separado.
- La regla de deuda cambió durante la conversación: el test actual exige un motivo de deuda dentro del modal; después aclaraste que no querés gestionar esa deuda y que queda el estado del departamento y la nota que el usuario decida dejar en comentarios del check-out. **Hay que confirmar si el motivo obligatorio sigue vigente** o si el criterio final lo reemplaza por comentarios opcionales antes de ampliar esa prueba.
- No se comprueba la secuencia combinada acordada de deuda/pago primero y recomendación de clasificación después, conservando el pago si se cancela la segunda confirmación.
- La clasificación se prueba sin comentario y sin puntuación en casos distintos; no hay una aserción específica para omitir ambos a la vez.

### Estado operativo del departamento — Parcial / Pendiente

- La pausa manual y reactivación tienen cobertura; también se comprueba que la unidad pausada no aparezca habilitada para nuevas reservas ni para check-in express.
- La prueba de pausa muestra la reserva existente en el aviso, pero no confirma un acceso directo para abrirla ni que su check-in siga permitido mientras está pausada.
- No se prueban los estados al checkout (`Bueno`, `Daño menor`, `Daño mayor`, `Limpieza requerida`), el recordatorio al crear una reserva ni que daño menor permita continuar con aviso.
- No se prueba la alerta roja persistente cuatro horas antes para departamentos no listos, ni cuándo se elimina.
- No se prueba “Marcar listo”: poner estado actual en `Bueno`, reactivar nuevas reservas y preservar el historial de la estadía anterior.

### Funciones conversadas que aún no son un E2E de una capacidad disponible — Pendiente

- Extender una estadía alojada, recalcular el precio y conservar los pagos existentes.
- Actualizar la salida prevista de una estadía en curso y verificar conflictos con reservas siguientes.

Estas funciones se conversaron, pero en el último alcance acordamos priorizar probar lo que ya está disponible en la interfaz. Deben considerarse pruebas futuras junto con la funcionalidad, no casos ya cubiertos.

## Orden sugerido para completar la cobertura

1. **Disponibilidad por fechas/horas:** conflictos reales, reservas pendientes, check-in en curso, márgenes y modal para completar horas. Es el grupo con más reglas de negocio aún sin automatizar.
2. **Edición de reservas:** precio, seña, departamento y estado, incluyendo los ejemplos Cabaña 1/Suite Familiar.
3. **Estado operativo del departamento:** limpieza/daños, recordatorio, alerta de cuatro horas y “Marcar listo”.
4. **Inquilinos:** autocompletado, verificación del DNI y auditoría de cambios.
5. **Express y check-in:** formularios automáticos según cantidad, eliminación con datos y llegada anticipada por horas.
6. **Ajustes de cobertura existentes:** modal de cancelación con importe y revisar el criterio final de comentario/deuda de checkout.
7. **Pagos durante la estadía y extensión:** cuando la interfaz permita completar esos flujos.

## Comando para ejecutar

Desde la carpeta del frontend, la suite E2E local completa se ejecuta con:

```bash
npm run test:e2e:local
```

Este documento describe cobertura encontrada; no implica que la suite se haya ejecutado durante la revisión ni que esté toda pasando.