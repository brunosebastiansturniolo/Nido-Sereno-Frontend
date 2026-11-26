import { expect, test, type APIRequestContext } from '@playwright/test';

const mailDevApi = 'http://127.0.0.1:1081/api/email';

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

async function getActivationCode(request: APIRequestContext, email: string): Promise<string> {
  let activationEmail: any;
  await expect.poll(async () => {
    const response = await request.get(mailDevApi);
    if (!response.ok()) return false;
    const emails = await response.json();
    activationEmail = emails.find((message: unknown) =>
      JSON.stringify(message)?.toLowerCase().includes(email.toLowerCase()) ?? false
    );
    return Boolean(activationEmail);
  }, { timeout: 30_000, message: 'El correo de activación debe llegar a MailDev local' }).toBe(true);

  const messageId = activationEmail.id ?? activationEmail._id;
  if (messageId) {
    const detail = await request.get(`${mailDevApi}/${encodeURIComponent(messageId)}`);
    if (detail.ok()) activationEmail = await detail.json();
  }

  const body = [activationEmail.text, activationEmail.html]
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
  const code = body.match(/<div class="activation-code">[\s\S]*?<span>(\d{6})<\/span>/i)?.[1];
  expect(code, 'El correo local debe contener el código de seis dígitos').toBeDefined();
  return code!;
}

test('recorre registro, activación, reserva, estadía y clasificación en el stack local', async ({ page, request }) => {
  test.setTimeout(120_000);

  const unique = Date.now();
  const email = `e2e-${unique}@nido-sereno.local`;
  const password = 'E2e-local-Password-123!';
  const reservationFirstName = 'Carla';
  const reservationLastName = 'Méndez';
  const firstTenantFirstName = 'Lucía';
  const firstTenantLastName = 'Fernández';
  const secondTenantFirstName = 'Pablo';
  const secondTenantLastName = 'Suárez';
  const complexName = 'Los Arrayanes';
  const complexLocation = 'Bariloche, Río Negro';
  const complexDescription = 'Alojamiento familiar para pruebas E2E';
  const departmentName = 'Cabaña 1';
  const departmentPricePerNight = 80_000;
  const departmentDepositAmount = departmentPricePerNight * 0.8;
  const classificationComment = 'Flujo E2E completado correctamente';

  await page.goto('/#/register');
  await page.getByPlaceholder('Juan').fill('Propietario');
  await page.getByPlaceholder('Pérez').fill(`E2E${unique}`);
  await page.getByPlaceholder('tu@email.com').fill(email);
  await page.getByPlaceholder('Mínimo 8 caracteres').fill(password);
  await page.getByPlaceholder('Repetí la contraseña').fill(password);
  await page.getByRole('button', { name: 'Registrarse' }).click();
  await expect(page.getByText('¡Registro exitoso! Revisá tu email para activar tu cuenta.')).toBeVisible();

  const activationCode = await getActivationCode(request, email);
  await page.goto('/#/activate-account');
  await page.getByPlaceholder('123456').fill(activationCode);
  await page.getByRole('button', { name: 'Activar cuenta' }).click();
  await expect(page.getByText('¡Cuenta activada exitosamente! Podés iniciar sesión.')).toBeVisible();
  await expect(page).toHaveURL(/#\/login$/, { timeout: 5_000 });

  await page.getByPlaceholder('tu@email.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/#\/dashboard/);

  await page.locator('aside label').click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  const simulatedDate = page.locator('aside input[type="date"]');
  const checkInDate = addDays(await simulatedDate.inputValue(), 1);
  const checkOutDate = addDays(checkInDate, 3);
  await simulatedDate.fill(checkInDate);

  await page.getByRole('link', { name: 'Complejos' }).click();
  await page.getByPlaceholder('Nombre').fill(complexName);
  await page.getByPlaceholder('Ubicación').fill(complexLocation);
  await page.getByPlaceholder('Descripción (opcional)').fill(complexDescription);
  await page.getByRole('button', { name: 'Crear complejo' }).click();
  await expect(page.getByText('Complejo creado exitosamente.')).toBeVisible();
  const createdComplex = page.getByRole('row').filter({ hasText: complexName });
  await expect(createdComplex).toContainText(complexLocation);
  await expect(createdComplex).toContainText(complexDescription);

  await page.getByRole('link', { name: 'Departamentos' }).click({ timeout: 10_000 });
  await expect(page).toHaveURL(/#\/dashboard\/departments$/, { timeout: 5_000 });
  await page.getByPlaceholder('Ej: Planta baja').fill(departmentName);
  await page.locator('input[formcontrolname="numeroHabitaciones"]').fill('2');
  await page.locator('input[formcontrolname="precioPorNoche"]').fill(String(departmentPricePerNight));
  await page.locator('select[formcontrolname="baseCalculoSenia"]').selectOption('NIGHT_PRICE');
  await page.locator('input[formcontrolname="montoSeniaRequerida"]').fill(String(departmentDepositAmount));
  await page.getByPlaceholder('Ej: 65').fill('65');
  await page.locator('input[formcontrolname="incluyeDesayuno"]').check();
  await page.locator('input[formcontrolname="tieneWifi"]').check();
  await page.locator('select[formcontrolname="complexId"]').selectOption({ label: complexName });
  await page.getByRole('button', { name: 'Crear departamento' }).click();
  await expect(page.getByText('Departamento creado exitosamente.')).toBeVisible();
  const createdDepartment = page.getByRole('row').filter({ hasText: departmentName });
  await expect(createdDepartment).toContainText(complexName);
  await expect(createdDepartment).toContainText('2');
  await expect(createdDepartment).toContainText(`$ ${departmentPricePerNight}`);
  await expect(createdDepartment).toContainText('80% de una noche');

  await page.getByRole('link', { name: 'Reservas' }).click();
  await page.locator('input[formcontrolname="firstName"]').fill(reservationFirstName);
  await page.locator('input[formcontrolname="lastName"]').fill(reservationLastName);
  await page.locator('input[formcontrolname="documentNumber"]').fill(`${unique}`);
  await page.locator('input[formcontrolname="phoneNumber"]').fill('1123456789');
  await page.locator('input[formcontrolname="cantidadPersonas"]').fill('2');
  await page.locator('input[formcontrolname="fechaCheckIn"]').fill(checkInDate);
  await page.locator('input[formcontrolname="cantidadNoches"]').fill('3');
  await page.locator('select[formcontrolname="departmentId"]').selectOption({
    label: `${departmentName} (${departmentPricePerNight}$/noche)`
  });
  const totalPrice = await page.locator('input[formcontrolname="precioTotal"]').inputValue();
  expect(Number(totalPrice)).toBeGreaterThan(0);
  const reservationDeposit = departmentDepositAmount;
  await page.locator('input[formcontrolname="montoSenia"]').fill('0');
  await page.getByRole('button', { name: 'Crear reserva' }).click();
  await expect(page.getByText('Reserva creada exitosamente.')).toBeVisible();

  const reservationName = `${reservationFirstName} ${reservationLastName}`;
  const reservationRow = page.getByRole('row').filter({ hasText: reservationName });
  await expect(reservationRow).toContainText(departmentName);
  await expect(reservationRow).toContainText('2 personas');
  await expect(reservationRow).toContainText('Pendiente');
  await expect(reservationRow).toContainText('$ 0');
  await expect(reservationRow.getByRole('button', { name: 'Señar' })).toBeVisible();
  await expect(reservationRow.getByRole('button', { name: 'Cancelar' })).toBeVisible();

  await reservationRow.getByRole('button', { name: 'Señar' }).click();
  let depositDialog = page.getByRole('dialog', { name: 'Registrar seña' });
  await expect(depositDialog).toContainText('Falta para confirmar: $64.000');
  await depositDialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(reservationRow).toContainText('$ 0');

  await reservationRow.getByRole('button', { name: 'Señar' }).click();
  depositDialog = page.getByRole('dialog', { name: 'Registrar seña' });
  await depositDialog.locator('input[name="depositAmount"]').fill('20000');
  await expect(depositDialog).toContainText('Falta para confirmar: $44.000');
  await depositDialog.getByRole('button', { name: 'Aceptar' }).click();
  await expect(reservationRow).toContainText('Pendiente');
  await expect(reservationRow).toContainText('$ 20000');

  await reservationRow.getByRole('button', { name: 'Señar' }).click();
  depositDialog = page.getByRole('dialog', { name: 'Registrar seña' });
  await expect(depositDialog).toContainText('Falta para confirmar: $44.000');
  await depositDialog.locator('input[name="depositAmount"]').fill('44000');
  await expect(depositDialog).toContainText('Falta para confirmar: $0');
  await depositDialog.getByRole('button', { name: 'Aceptar' }).click();
  await expect(reservationRow).toContainText('Confirmada');
  await expect(reservationRow).toContainText(`$ ${reservationDeposit}`);

  await page.getByRole('link', { name: 'Estadías' }).click();
  await page.getByRole('button', { name: 'Desde Reserva' }).click();
  const reservationSelect = page.locator('select[formcontrolname="reservationId"]');
  await expect(reservationSelect.locator('option', {
    hasText: `${reservationName} - ${checkInDate}`
  })).toHaveCount(1);
  await reservationSelect.selectOption({
    label: `${reservationName} - ${checkInDate}`
  });
  const tenantCards = page.locator('div[formArrayName="tenants"] > div.border.rounded-lg');
  await expect(tenantCards).toHaveCount(2);
  await tenantCards.nth(0).locator('input[formcontrolname="documentNumber"]').fill(`${unique}01`);
  await tenantCards.nth(0).locator('input[formcontrolname="firstName"]').fill(firstTenantFirstName);
  await tenantCards.nth(0).locator('input[formcontrolname="lastName"]').fill(firstTenantLastName);
  await tenantCards.nth(0).locator('input[formcontrolname="email"]').fill(`lucia-${unique}@nido-sereno.local`);
  await tenantCards.nth(0).locator('input[formcontrolname="phoneNumber"]').fill('1123456780');
  await tenantCards.nth(1).locator('input[formcontrolname="documentNumber"]').fill(`${unique}02`);
  await tenantCards.nth(1).locator('input[formcontrolname="firstName"]').fill(secondTenantFirstName);
  await tenantCards.nth(1).locator('input[formcontrolname="lastName"]').fill(secondTenantLastName);
  await tenantCards.nth(1).locator('input[formcontrolname="email"]').fill(`pablo-${unique}@nido-sereno.local`);
  await tenantCards.nth(1).locator('input[formcontrolname="phoneNumber"]').fill('1123456781');

  await page.getByRole('button', { name: /Agregar inquilino/ }).click();
  let tenantCountDialog = page.getByRole('dialog', { name: 'Diferencia en cantidad de inquilinos' });
  await expect(tenantCountDialog).toContainText('La reserva propone 2 personas');
  await expect(tenantCountDialog).toContainText('check-in quedaría con 3 personas');
  await tenantCountDialog.getByRole('button', { name: 'Cancelar acción' }).click();
  await expect(tenantCards).toHaveCount(2);

  await page.getByRole('button', { name: /Agregar inquilino/ }).click();
  tenantCountDialog = page.getByRole('dialog', { name: 'Diferencia en cantidad de inquilinos' });
  await tenantCountDialog.getByRole('button', { name: 'Proceder de todas formas' }).click();
  await expect(tenantCards).toHaveCount(3);
  await tenantCards.nth(2).locator('input[formcontrolname="documentNumber"]').fill(`${unique}03`);
  await tenantCards.nth(2).locator('input[formcontrolname="firstName"]').fill('Prueba');
  await tenantCards.nth(2).locator('input[formcontrolname="lastName"]').fill('Temporal');
  await tenantCards.nth(2).locator('input[formcontrolname="email"]').fill(`temporal-${unique}@nido-sereno.local`);
  await tenantCards.nth(2).locator('input[formcontrolname="phoneNumber"]').fill('1123456782');
  await expect(page.getByRole('button', { name: 'Realizar Check-In' })).toBeEnabled();
  await tenantCards.nth(2).getByRole('button', { name: 'Eliminar' }).click();
  tenantCountDialog = page.getByRole('dialog', { name: 'Diferencia en cantidad de inquilinos' });
  await expect(tenantCountDialog).toContainText('check-in quedaría con 2 personas');
  await tenantCountDialog.getByRole('button', { name: 'Proceder de todas formas' }).click();
  await expect(tenantCards).toHaveCount(2);

  await page.locator('input[formcontrolname="montoPagadoEnCheckIn"]').fill(String(Number(totalPrice) - reservationDeposit));
  await page.getByRole('button', { name: 'Realizar Check-In' }).click();
  await expect(page.getByText('Check-in realizado exitosamente.')).toBeVisible();

  await simulatedDate.fill(checkOutDate);
  const firstTenantName = `${firstTenantFirstName} ${firstTenantLastName}`;
  const secondTenantName = `${secondTenantFirstName} ${secondTenantLastName}`;
  const stayRow = page.getByRole('row').filter({ hasText: firstTenantName });
  await expect(stayRow).toContainText('+1 más');
  await stayRow.getByRole('button', { name: 'Check-out' }).click();
  await page.locator('input[formcontrolname="fechaHoraCheckOutReal"]').fill(`${checkOutDate}T12:00`);
  await page.locator('select[formcontrolname="classificationScore"]').selectOption({ label: '5 - Excelente' });
  await page.getByPlaceholder('Ej: Dejó el departamento impecable / Rompió una silla / Dejó las luces encendidas...').fill(classificationComment);
  await page.getByRole('button', { name: 'Confirmar Check-out' }).click();
  await expect(page.getByText('Check-out realizado exitosamente.')).toBeVisible();

  const completedStay = page.getByRole('row').filter({ hasText: firstTenantName });
  await expect(completedStay).toContainText('Completada');
  await expect(completedStay).toContainText('(5/5)');

  await page.getByRole('link', { name: 'Inquilinos' }).click();
  const guestRow = page.getByRole('row').filter({ hasText: firstTenantName });
  const secondGuestRow = page.getByRole('row').filter({ hasText: secondTenantName });
  await expect(secondGuestRow).toBeVisible();
  await guestRow.getByRole('button', { name: 'Ver clasificaciones' }).click();
  await expect(page.getByText(classificationComment)).toBeVisible();

  const checkoutDebtScenarios = [
    { payment: 40_000, remaining: 36_000, label: 'Cuarenta' },
    { payment: 20_000, remaining: 56_000, label: 'Veinte' },
    { payment: 0, remaining: 76_000, label: 'Cero' }
  ];
  const firstDebtCheckInDate = addDays(checkOutDate, 1);

  for (let index = 0; index < checkoutDebtScenarios.length; index++) {
    const scenario = checkoutDebtScenarios[index];
    const scenarioCheckInDate = addDays(firstDebtCheckInDate, index * 4);
    const scenarioCheckOutDate = addDays(scenarioCheckInDate, 3);
    const scenarioReservationName = `Reservante ${scenario.label}`;
    const scenarioTenantName = `Inquilino ${scenario.label}`;

    await simulatedDate.fill(scenarioCheckInDate);
    await page.getByRole('link', { name: 'Reservas', exact: true }).click();
    await page.locator('input[formcontrolname="firstName"]').fill('Reservante');
    await page.locator('input[formcontrolname="lastName"]').fill(scenario.label);
    await page.locator('input[formcontrolname="documentNumber"]').fill(`${unique}${index}10`);
    await page.locator('input[formcontrolname="phoneNumber"]').fill(`112345678${index}`);
    await page.locator('input[formcontrolname="cantidadPersonas"]').fill('1');
    await page.locator('input[formcontrolname="fechaCheckIn"]').fill(scenarioCheckInDate);
    await page.locator('input[formcontrolname="cantidadNoches"]').fill('3');
    await page.locator('select[formcontrolname="departmentId"]').selectOption({
      label: `${departmentName} (${departmentPricePerNight}$/noche)`
    });
    await page.locator('input[formcontrolname="montoSenia"]').fill(String(departmentDepositAmount));
    await page.getByRole('button', { name: 'Crear reserva' }).click();
    await expect(page.getByText('Reserva creada exitosamente.')).toBeVisible();

    await page.getByRole('link', { name: 'Estadías' }).click();
    await page.getByRole('button', { name: 'Desde Reserva' }).click();
    const scenarioReservationSelect = page.locator('select[formcontrolname="reservationId"]');
    await scenarioReservationSelect.selectOption({
      label: `${scenarioReservationName} - ${scenarioCheckInDate}`
    });
    const scenarioTenant = page.locator('div[formArrayName="tenants"] > div.border.rounded-lg').nth(0);
    await scenarioTenant.locator('input[formcontrolname="documentNumber"]').fill(`${unique}${index}20`);
    await scenarioTenant.locator('input[formcontrolname="firstName"]').fill('Inquilino');
    await scenarioTenant.locator('input[formcontrolname="lastName"]').fill(scenario.label);
    await scenarioTenant.locator('input[formcontrolname="email"]').fill(`inquilino-${scenario.label.toLowerCase()}-${unique}@nido-sereno.local`);
    await scenarioTenant.locator('input[formcontrolname="phoneNumber"]').fill(`112345679${index}`);
    await page.locator('input[formcontrolname="montoPagadoEnCheckIn"]').fill('100000');
    await page.getByRole('button', { name: 'Realizar Check-In' }).click();
    await expect(page.getByText('Check-in realizado exitosamente.')).toBeVisible();

    await simulatedDate.fill(scenarioCheckOutDate);
    const scenarioStayRow = page.getByRole('row').filter({ hasText: scenarioTenantName });
    await scenarioStayRow.getByRole('button', { name: 'Check-out' }).click();
    await page.locator('input[formcontrolname="fechaHoraCheckOutReal"]').fill(`${scenarioCheckOutDate}T12:00`);
    await page.locator('select[formcontrolname="classificationScore"]').selectOption({ label: '5 - Excelente' });
    await page.getByRole('button', { name: 'Confirmar Check-out' }).click();

    let checkoutDialog = page.getByRole('dialog', { name: 'Registrar pago del check-out' });
    await expect(checkoutDialog).toContainText('Saldo pendiente antes de este pago: $ 76.000');
    await checkoutDialog.locator('input[name="checkoutPaymentAmount"]').fill(String(scenario.payment));
    const remainingText = checkoutDialog.locator('p').filter({ hasText: 'Saldo después del pago:' });
    await expect(remainingText).toContainText(`$ ${scenario.remaining.toLocaleString('es-AR')}`);
    await expect(remainingText).toHaveClass(/text-red-700/);
    await expect(checkoutDialog.getByText(/El huésped se retirará con un saldo impago/)).toBeVisible();
    await checkoutDialog.getByRole('button', { name: 'Cerrar check-out con saldo impago' }).click();
    await expect(checkoutDialog.getByText('Explicá el motivo del saldo impago para cerrar la estadía.')).toBeVisible();

    const debtReason = `No pudo pagar los ${scenario.remaining} restantes al retirarse.`;
    await checkoutDialog.locator('textarea[name="checkoutDebtComment"]').fill(debtReason);
    if (index === 0) {
      await checkoutDialog.getByRole('button', { name: 'Cancelar' }).click();
      await expect(checkoutDialog).toBeHidden();
      await expect(scenarioStayRow).toContainText('En curso');

      await page.getByRole('button', { name: 'Confirmar Check-out' }).click();
      checkoutDialog = page.getByRole('dialog', { name: 'Registrar pago del check-out' });
      await checkoutDialog.locator('input[name="checkoutPaymentAmount"]').fill(String(scenario.payment));
      await checkoutDialog.locator('textarea[name="checkoutDebtComment"]').fill(debtReason);
    }

    await checkoutDialog.getByRole('button', { name: 'Cerrar check-out con saldo impago' }).click();
    await expect(page.getByText('Check-out realizado exitosamente.')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: scenarioTenantName })).toContainText('Completada');

    await page.getByRole('link', { name: 'Reservas', exact: true }).click();
    const paidReservationRow = page.getByRole('row').filter({ hasText: scenarioReservationName });
    await expect(paidReservationRow).toContainText(`$ ${240_000 - scenario.remaining}`);
  }

  const mismatchCheckInDate = addDays(firstDebtCheckInDate, checkoutDebtScenarios.length * 4);
  const mismatchReservationName = 'Reservante Diferencia';
  await simulatedDate.fill(mismatchCheckInDate);
  await page.getByRole('link', { name: 'Reservas' }).click();
  await page.locator('input[formcontrolname="firstName"]').fill('Reservante');
  await page.locator('input[formcontrolname="lastName"]').fill('Diferencia');
  await page.locator('input[formcontrolname="documentNumber"]').fill(`${unique}99`);
  await page.locator('input[formcontrolname="phoneNumber"]').fill('1123456783');
  await page.locator('input[formcontrolname="cantidadPersonas"]').fill('2');
  await page.locator('input[formcontrolname="fechaCheckIn"]').fill(mismatchCheckInDate);
  await page.locator('input[formcontrolname="cantidadNoches"]').fill('1');
  await page.locator('select[formcontrolname="departmentId"]').selectOption({
    label: `${departmentName} (${departmentPricePerNight}$/noche)`
  });
  await page.locator('input[formcontrolname="montoSenia"]').fill('0');
  await page.getByRole('button', { name: 'Crear reserva' }).click();
  await expect(page.getByText('Reserva creada exitosamente.')).toBeVisible();

  await page.getByRole('link', { name: 'Estadías' }).click();
  await page.getByRole('button', { name: 'Desde Reserva' }).click();
  const mismatchReservationSelect = page.locator('select[formcontrolname="reservationId"]');
  await mismatchReservationSelect.selectOption({
    label: `${mismatchReservationName} - ${mismatchCheckInDate}`
  });
  const mismatchTenantCards = page.locator('div[formArrayName="tenants"] > div.border.rounded-lg');
  await expect(mismatchTenantCards).toHaveCount(2);
  await mismatchTenantCards.nth(1).getByRole('button', { name: 'Eliminar' }).click();
  const mismatchDialog = page.getByRole('dialog', { name: 'Diferencia en cantidad de inquilinos' });
  await expect(mismatchDialog).toContainText('check-in quedaría con 1 persona');
  await mismatchDialog.getByRole('button', { name: 'Proceder de todas formas' }).click();
  await expect(mismatchTenantCards).toHaveCount(1);
  await mismatchTenantCards.nth(0).locator('input[formcontrolname="documentNumber"]').fill(`${unique}98`);
  await mismatchTenantCards.nth(0).locator('input[formcontrolname="firstName"]').fill('Inquilino');
  await mismatchTenantCards.nth(0).locator('input[formcontrolname="lastName"]').fill('Diferente');
  await mismatchTenantCards.nth(0).locator('input[formcontrolname="email"]').fill(`diferente-${unique}@nido-sereno.local`);
  await mismatchTenantCards.nth(0).locator('input[formcontrolname="phoneNumber"]').fill('1123456784');
  await page.locator('input[formcontrolname="montoPagadoEnCheckIn"]').fill('0');
  await page.getByRole('button', { name: 'Realizar Check-In' }).click();
  await expect(page.getByText('Check-in realizado exitosamente.')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Inquilino Diferente' })).toBeVisible();
});