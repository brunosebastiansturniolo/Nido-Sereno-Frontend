import { expect, test, type APIRequestContext } from '@playwright/test';

const mailDevApi = 'http://127.0.0.1:1081/api/email';

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function oneHourAfter(dateTime: string): string {
  const [hours, minutes] = dateTime.slice(11, 16).split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + 60;
  return `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
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
  const reservationCheckIn = page.locator('input[formcontrolname="fechaCheckIn"]');
  const reservationCheckOut = page.locator('input[formcontrolname="fechaCheckOut"]');
  const reservationNights = page.locator('input[formcontrolname="cantidadNoches"]');
  const reservationTotal = page.locator('input[formcontrolname="precioTotal"]');
  await expect(reservationCheckIn).toHaveValue(checkInDate);
  await expect(reservationCheckOut).toHaveValue(addDays(checkInDate, 1));
  await expect(reservationNights).toHaveValue('1');

  await page.locator('select[formcontrolname="departmentId"]').selectOption({
    label: `${departmentName} (${departmentPricePerNight}$/noche)`
  });
  await expect(reservationTotal).toHaveValue(String(departmentPricePerNight));

  const earlierCheckIn = addDays(checkInDate, -1);
  await reservationCheckIn.fill(earlierCheckIn);
  await expect(reservationCheckOut).toHaveValue(addDays(checkInDate, 1));
  await expect(reservationNights).toHaveValue('2');
  await expect(reservationTotal).toHaveValue(String(departmentPricePerNight * 2));

  await reservationCheckOut.fill(addDays(checkInDate, 2));
  await expect(reservationCheckIn).toHaveValue(earlierCheckIn);
  await expect(reservationNights).toHaveValue('3');
  await expect(reservationTotal).toHaveValue(String(departmentPricePerNight * 3));

  await reservationNights.fill('2');
  await expect(reservationCheckIn).toHaveValue(earlierCheckIn);
  await expect(reservationCheckOut).toHaveValue(addDays(checkInDate, 1));
  await expect(reservationTotal).toHaveValue(String(departmentPricePerNight * 2));

  await page.locator('input[formcontrolname="firstName"]').fill(reservationFirstName);
  await page.locator('input[formcontrolname="lastName"]').fill(reservationLastName);
  await page.locator('input[formcontrolname="documentNumber"]').fill(`${unique}`);
  await page.locator('input[formcontrolname="phoneNumber"]').fill('1123456789');
  await page.locator('input[formcontrolname="cantidadPersonas"]').fill('2');
  await reservationCheckIn.fill(checkInDate);
  await reservationNights.fill('3');
  const totalPrice = await page.locator('input[formcontrolname="precioTotal"]').inputValue();
  expect(Number(totalPrice)).toBe(departmentPricePerNight * 3);
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

  const createCancellationReservation = async (
    firstName: string,
    lastName: string,
    documentNumber: string,
    checkIn: string,
    deposit: number
  ) => {
    await page.locator('input[formcontrolname="firstName"]').fill(firstName);
    await page.locator('input[formcontrolname="lastName"]').fill(lastName);
    await page.locator('input[formcontrolname="documentNumber"]').fill(documentNumber);
    await page.locator('input[formcontrolname="phoneNumber"]').fill('1123456789');
    await page.locator('input[formcontrolname="cantidadPersonas"]').fill('1');
    await page.locator('input[formcontrolname="fechaCheckIn"]').fill(checkIn);
    await page.locator('input[formcontrolname="cantidadNoches"]').fill('1');
    await page.locator('select[formcontrolname="departmentId"]').selectOption({
      label: `${departmentName} (${departmentPricePerNight}$/noche)`
    });
    await page.locator('input[formcontrolname="montoSenia"]').fill(String(deposit));
    await page.getByRole('button', { name: 'Crear reserva' }).click();
    await expect(page.getByText('Reserva creada exitosamente.')).toBeVisible();
  };
  const respondToCancellation = async (row: ReturnType<typeof page.getByRole>, accept: boolean) => {
    const dialogPromise = page.waitForEvent('dialog');
    const clickPromise = row.getByRole('button', { name: 'Cancelar' }).click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('¿Estás seguro de cancelar esta reserva?');
    if (accept) await dialog.accept();
    else await dialog.dismiss();
    await clickPromise;
  };

  const noDepositName = `Ana SinSeña ${unique}`;
  await createCancellationReservation('Ana', `SinSeña ${unique}`, `${unique}10`, addDays(checkInDate, 10), 0);
  const noDepositRow = page.getByRole('row').filter({ hasText: noDepositName });
  await expect(noDepositRow).toContainText('Pendiente');
  await expect(noDepositRow).toContainText('$ 0');
  await respondToCancellation(noDepositRow, false);
  await expect(noDepositRow).toContainText('Pendiente');
  await expect(noDepositRow.getByRole('button', { name: 'Cancelar' })).toBeVisible();

  await respondToCancellation(noDepositRow, true);
  await expect(noDepositRow).toContainText('Cancelada');
  await expect(noDepositRow).toContainText('$ 0');
  await expect(noDepositRow.getByRole('button', { name: 'Cancelar' })).toHaveCount(0);

  const paidCancellationName = `Bruno ConSeña ${unique}`;
  await createCancellationReservation('Bruno', `ConSeña ${unique}`, `${unique}11`, addDays(checkInDate, 12), departmentDepositAmount);
  const paidCancellationRow = page.getByRole('row').filter({ hasText: paidCancellationName });
  await expect(paidCancellationRow).toContainText('Confirmada');
  await expect(paidCancellationRow).toContainText(`$ ${departmentDepositAmount}`);
  await respondToCancellation(paidCancellationRow, false);
  await expect(paidCancellationRow).toContainText('Confirmada');
  await expect(paidCancellationRow).toContainText(`$ ${departmentDepositAmount}`);

  await respondToCancellation(paidCancellationRow, true);
  await expect(paidCancellationRow).toContainText('Cancelada');
  await expect(paidCancellationRow).toContainText(`$ ${departmentDepositAmount}`);
  await expect(paidCancellationRow.getByRole('button', { name: 'Cancelar' })).toHaveCount(0);

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
    await page.locator('input[formcontrolname="classificationReviewComment"]').fill(`Buena estadía de ${scenario.label}.`);
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
  const actualMismatchCheckInDate = addDays(mismatchCheckInDate, 1);
  const mismatchReservationName = 'Reservante Diferencia';
  await simulatedDate.fill(mismatchCheckInDate);
  await page.getByRole('link', { name: 'Reservas' }).click();
  await page.locator('input[formcontrolname="firstName"]').fill('Reservante');
  await page.locator('input[formcontrolname="lastName"]').fill('Diferencia');
  await page.locator('input[formcontrolname="documentNumber"]').fill(`${unique}99`);
  await page.locator('input[formcontrolname="phoneNumber"]').fill('1123456783');
  await page.locator('input[formcontrolname="cantidadPersonas"]').fill('2');
  await page.locator('input[formcontrolname="fechaCheckIn"]').fill(mismatchCheckInDate);
  await page.locator('input[formcontrolname="cantidadNoches"]').fill('3');
  await page.locator('select[formcontrolname="departmentId"]').selectOption({
    label: `${departmentName} (${departmentPricePerNight}$/noche)`
  });
  await page.locator('input[formcontrolname="montoSenia"]').fill('0');
  await page.getByRole('button', { name: 'Crear reserva' }).click();
  await expect(page.getByText('Reserva creada exitosamente.')).toBeVisible();

  await simulatedDate.fill(actualMismatchCheckInDate);
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

  const checkInDateTime = page.locator('input[formcontrolname="fechaHoraCheckInReal"]');
  await expect(checkInDateTime).toHaveValue(new RegExp(`^${actualMismatchCheckInDate}T`));
  await page.getByRole('button', { name: 'Realizar Check-In' }).click();
  const justificationModal = page.locator('div.fixed.inset-0').filter({
    has: page.getByRole('heading', { name: /Fecha de check-in no coincide/ })
  });
  await expect(justificationModal).toContainText(mismatchCheckInDate);
  await expect(justificationModal).toContainText(actualMismatchCheckInDate);
  await expect(justificationModal).toContainText('después');
  await justificationModal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(justificationModal).toBeHidden();
  await expect(page.getByRole('row').filter({ hasText: 'Inquilino Diferente' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Realizar Check-In' }).click();
  const retryJustificationModal = page.locator('div.fixed.inset-0').filter({
    has: page.getByRole('heading', { name: /Fecha de check-in no coincide/ })
  });
  const checkInReason = 'Llegó un día después por un retraso en el viaje.';
  await retryJustificationModal.getByRole('button', { name: 'Confirmar' }).click();
  await expect(retryJustificationModal).toBeVisible();
  await expect(retryJustificationModal.getByText('La justificación es obligatoria para continuar con el check-in.')).toBeVisible();

  await retryJustificationModal.getByPlaceholder('Escribí el motivo de la diferencia de fecha...').fill(checkInReason);
  const checkInRequestPromise = page.waitForRequest(request =>
    request.method() === 'POST' && request.url().endsWith('/stays/checkin')
  );
  await retryJustificationModal.getByRole('button', { name: 'Confirmar' }).click();
  const checkInRequest = await checkInRequestPromise;
  expect(checkInRequest.postDataJSON().fechaHoraCheckInReal).toMatch(new RegExp(`^${actualMismatchCheckInDate}T`));
  expect(checkInRequest.postDataJSON().comentariosCheckIn).toContain(`[FECHA JUSTIFICADA] Motivo: ${checkInReason}`);
  await expect(page.getByText('Check-in realizado exitosamente.')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Inquilino Diferente' })).toBeVisible();

  const earlyReservationCheckInDate = addDays(mismatchCheckInDate, 10);
  const actualEarlyCheckInDate = addDays(earlyReservationCheckInDate, -1);
  const earlyReservationName = 'Reservante Anticipado';
  await simulatedDate.fill(actualEarlyCheckInDate);
  await page.getByRole('link', { name: 'Reservas', exact: true }).click();
  await page.locator('input[formcontrolname="firstName"]').fill('Reservante');
  await page.locator('input[formcontrolname="lastName"]').fill('Anticipado');
  await page.locator('input[formcontrolname="documentNumber"]').fill(`${unique}97`);
  await page.locator('input[formcontrolname="phoneNumber"]').fill('1123456785');
  await page.locator('input[formcontrolname="cantidadPersonas"]').fill('1');
  await page.locator('input[formcontrolname="fechaCheckIn"]').fill(earlyReservationCheckInDate);
  await page.locator('input[formcontrolname="cantidadNoches"]').fill('3');
  await page.locator('select[formcontrolname="departmentId"]').selectOption({
    label: `${departmentName} (${departmentPricePerNight}$/noche)`
  });
  await page.locator('input[formcontrolname="montoSenia"]').fill('0');
  await page.getByRole('button', { name: 'Crear reserva' }).click();
  await expect(page.getByText('Reserva creada exitosamente.')).toBeVisible();

  await page.getByRole('link', { name: 'Estadías', exact: true }).click();
  await page.getByRole('button', { name: 'Desde Reserva' }).click();
  await page.locator('select[formcontrolname="reservationId"]').selectOption({
    label: `${earlyReservationName} - ${earlyReservationCheckInDate}`
  });
  const earlyTenant = page.locator('div[formArrayName="tenants"] > div.border.rounded-lg').nth(0);
  await earlyTenant.locator('input[formcontrolname="documentNumber"]').fill(`${unique}96`);
  await earlyTenant.locator('input[formcontrolname="firstName"]').fill('Inquilino');
  await earlyTenant.locator('input[formcontrolname="lastName"]').fill('Anticipado');
  await earlyTenant.locator('input[formcontrolname="email"]').fill(`anticipado-${unique}@nido-sereno.local`);
  await earlyTenant.locator('input[formcontrolname="phoneNumber"]').fill('1123456786');
  await page.locator('input[formcontrolname="montoPagadoEnCheckIn"]').fill('0');

  const earlyCheckInDateTime = page.locator('input[formcontrolname="fechaHoraCheckInReal"]');
  await expect(earlyCheckInDateTime).toHaveValue(new RegExp(`^${actualEarlyCheckInDate}T`));
  await page.getByRole('button', { name: 'Realizar Check-In' }).click();
  const earlyJustificationModal = page.locator('div.fixed.inset-0').filter({
    has: page.getByRole('heading', { name: /Fecha de check-in no coincide/ })
  });
  await expect(earlyJustificationModal).toContainText(earlyReservationCheckInDate);
  await expect(earlyJustificationModal).toContainText(actualEarlyCheckInDate);
  await expect(earlyJustificationModal).toContainText('antes');
  await earlyJustificationModal.getByRole('button', { name: 'Confirmar' }).click();
  await expect(earlyJustificationModal.getByText('La justificación es obligatoria para continuar con el check-in.')).toBeVisible();

  const earlyCheckInReason = 'El huésped solicitó ingresar un día antes.';
  await earlyJustificationModal.getByPlaceholder('Escribí el motivo de la diferencia de fecha...').fill(earlyCheckInReason);
  const earlyCheckInRequestPromise = page.waitForRequest(request =>
    request.method() === 'POST' && request.url().endsWith('/stays/checkin')
  );
  await earlyJustificationModal.getByRole('button', { name: 'Confirmar' }).click();
  const earlyCheckInRequest = await earlyCheckInRequestPromise;
  expect(earlyCheckInRequest.postDataJSON().fechaHoraCheckInReal).toMatch(new RegExp(`^${actualEarlyCheckInDate}T`));
  expect(earlyCheckInRequest.postDataJSON().comentariosCheckIn).toContain(`[FECHA JUSTIFICADA] Motivo: ${earlyCheckInReason}`);
  await expect(page.getByText('Check-in realizado exitosamente.')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Inquilino Anticipado' })).toBeVisible();

  const sameDayCheckInDate = addDays(earlyReservationCheckInDate, 10);
  const sameDayReservationName = 'Reservante MismoDia';
  await simulatedDate.fill(sameDayCheckInDate);
  await page.getByRole('link', { name: 'Reservas', exact: true }).click();
  await page.locator('input[formcontrolname="firstName"]').fill('Reservante');
  await page.locator('input[formcontrolname="lastName"]').fill('MismoDia');
  await page.locator('input[formcontrolname="documentNumber"]').fill(`${unique}94`);
  await page.locator('input[formcontrolname="phoneNumber"]').fill('1123456787');
  await page.locator('input[formcontrolname="cantidadPersonas"]').fill('1');
  await page.locator('input[formcontrolname="fechaCheckIn"]').fill(sameDayCheckInDate);
  await page.locator('input[formcontrolname="cantidadNoches"]').fill('1');
  await page.locator('select[formcontrolname="departmentId"]').selectOption({
    label: `${departmentName} (${departmentPricePerNight}$/noche)`
  });
  await page.locator('input[formcontrolname="montoSenia"]').fill('0');
  await page.getByRole('button', { name: 'Crear reserva' }).click();
  await expect(page.getByText('Reserva creada exitosamente.')).toBeVisible();

  await page.getByRole('link', { name: 'Estadías', exact: true }).click();
  await page.getByRole('button', { name: 'Desde Reserva' }).click();
  await page.locator('select[formcontrolname="reservationId"]').selectOption({
    label: `${sameDayReservationName} - ${sameDayCheckInDate}`
  });
  const sameDayTenant = page.locator('div[formArrayName="tenants"] > div.border.rounded-lg').nth(0);
  await sameDayTenant.locator('input[formcontrolname="documentNumber"]').fill(`${unique}93`);
  await sameDayTenant.locator('input[formcontrolname="firstName"]').fill('Inquilino');
  await sameDayTenant.locator('input[formcontrolname="lastName"]').fill('MismoDia');
  await sameDayTenant.locator('input[formcontrolname="email"]').fill(`mismo-dia-${unique}@nido-sereno.local`);
  await sameDayTenant.locator('input[formcontrolname="phoneNumber"]').fill('1123456790');
  const sameDayCheckInDateTime = page.locator('input[formcontrolname="fechaHoraCheckInReal"]');
  await sameDayCheckInDateTime.fill(`${sameDayCheckInDate}T22:30`);

  const sameDayCheckInRequestPromise = page.waitForRequest(request =>
    request.method() === 'POST' && request.url().endsWith('/stays/checkin')
  );
  await page.getByRole('button', { name: 'Realizar Check-In' }).click();
  const sameDayCheckInRequest = await sameDayCheckInRequestPromise;
  const sameDayCheckInRequestBody = sameDayCheckInRequest.postDataJSON();
  expect(sameDayCheckInRequestBody.fechaHoraCheckInReal).toBe(`${sameDayCheckInDate}T22:30`);
  expect(sameDayCheckInRequestBody.comentariosCheckIn ?? '').not.toContain('[FECHA JUSTIFICADA]');
  await expect(page.getByRole('heading', { name: /Fecha de check-in no coincide/ })).toHaveCount(0);
  await expect(page.getByText('Check-in realizado exitosamente.')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Inquilino MismoDia' })).toContainText('En curso');

  const lateCheckInDate = addDays(sameDayCheckInDate, 10);
  const plannedLateCheckOutDate = addDays(lateCheckInDate, 2);
  const actualLateCheckOutDate = addDays(plannedLateCheckOutDate, 1);
  const lateCheckoutReservationName = 'Reservante SalidaTarde';
  const lateCheckoutTenantName = 'Inquilino SalidaTarde';
  await simulatedDate.fill(lateCheckInDate);
  await page.getByRole('link', { name: 'Reservas', exact: true }).click();
  await page.locator('input[formcontrolname="firstName"]').fill('Reservante');
  await page.locator('input[formcontrolname="lastName"]').fill('SalidaTarde');
  await page.locator('input[formcontrolname="documentNumber"]').fill(`${unique}92`);
  await page.locator('input[formcontrolname="phoneNumber"]').fill('1123456791');
  await page.locator('input[formcontrolname="cantidadPersonas"]').fill('1');
  await page.locator('input[formcontrolname="fechaCheckIn"]').fill(lateCheckInDate);
  await page.locator('input[formcontrolname="cantidadNoches"]').fill('2');
  await page.locator('select[formcontrolname="departmentId"]').selectOption({
    label: `${departmentName} (${departmentPricePerNight}$/noche)`
  });
  await page.locator('input[formcontrolname="montoSenia"]').fill(String(departmentDepositAmount));
  await page.getByRole('button', { name: 'Crear reserva' }).click();
  await expect(page.getByText('Reserva creada exitosamente.')).toBeVisible();

  await page.getByRole('link', { name: 'Estadías', exact: true }).click();
  await page.getByRole('button', { name: 'Desde Reserva' }).click();
  await page.locator('select[formcontrolname="reservationId"]').selectOption({
    label: `${lateCheckoutReservationName} - ${lateCheckInDate}`
  });
  const lateCheckoutTenant = page.locator('div[formArrayName="tenants"] > div.border.rounded-lg').nth(0);
  await lateCheckoutTenant.locator('input[formcontrolname="documentNumber"]').fill(`${unique}91`);
  await lateCheckoutTenant.locator('input[formcontrolname="firstName"]').fill('Inquilino');
  await lateCheckoutTenant.locator('input[formcontrolname="lastName"]').fill('SalidaTarde');
  await lateCheckoutTenant.locator('input[formcontrolname="email"]').fill(`salida-tarde-${unique}@nido-sereno.local`);
  await lateCheckoutTenant.locator('input[formcontrolname="phoneNumber"]').fill('1123456792');
  await page.locator('input[formcontrolname="montoPagadoEnCheckIn"]').fill(String(2 * departmentPricePerNight - departmentDepositAmount));
  await page.getByRole('button', { name: 'Realizar Check-In' }).click();
  await expect(page.getByText('Check-in realizado exitosamente.')).toBeVisible();

  await simulatedDate.fill(actualLateCheckOutDate);
  const lateCheckoutStayRow = page.getByRole('row').filter({ hasText: lateCheckoutTenantName });
  await lateCheckoutStayRow.getByRole('button', { name: 'Check-out' }).click();
  await page.locator('input[formcontrolname="fechaHoraCheckOutReal"]').fill(`${actualLateCheckOutDate}T10:00`);
  await page.locator('select[formcontrolname="classificationScore"]').selectOption({ label: '5 - Excelente' });
  await page.locator('input[formcontrolname="classificationReviewComment"]').fill('Buena estadía, con una noche adicional acordada.');
  await page.getByRole('button', { name: 'Confirmar Check-out' }).click();

  const lateCheckoutPaymentDialog = page.getByRole('dialog', { name: 'Registrar pago del check-out' });
  await expect(lateCheckoutPaymentDialog).toContainText('El total se actualiza de $ 160.000 a $ 240.000');
  await expect(lateCheckoutPaymentDialog).toContainText('Saldo pendiente antes de este pago: $ 80.000');
  await lateCheckoutPaymentDialog.locator('input[name="checkoutPaymentAmount"]').fill('80000');
  await lateCheckoutPaymentDialog.getByRole('button', { name: 'Registrar pago y finalizar check-out' }).click();

  const lateCheckoutJustification = page.locator('div.fixed.inset-0').filter({
    has: page.getByRole('heading', { name: /Fecha de check-out no coincide/ })
  });
  await expect(lateCheckoutJustification).toContainText(plannedLateCheckOutDate);
  await expect(lateCheckoutJustification).toContainText(actualLateCheckOutDate);
  await lateCheckoutJustification.getByRole('button', { name: 'Confirmar' }).click();
  await expect(lateCheckoutJustification.getByText('La justificación es obligatoria para continuar con el check-out.')).toBeVisible();
  const lateCheckoutReason = 'El huésped solicitó quedarse una noche más.';
  await lateCheckoutJustification.getByPlaceholder('Escribí el motivo de la diferencia de fecha...').fill(lateCheckoutReason);
  const lateCheckoutRequestPromise = page.waitForRequest(request =>
    request.method() === 'PATCH' && request.url().endsWith('/checkout')
  );
  await lateCheckoutJustification.getByRole('button', { name: 'Confirmar' }).click();
  const lateCheckoutRequest = await lateCheckoutRequestPromise;
  const lateCheckoutRequestBody = lateCheckoutRequest.postDataJSON();
  expect(lateCheckoutRequestBody.montoPagadoEnCheckOut).toBe(80_000);
  expect(lateCheckoutRequestBody.comentariosCheckOut).toContain(`[FECHA JUSTIFICADA] Motivo: ${lateCheckoutReason}`);
  await expect(page.getByText('Check-out realizado exitosamente.')).toBeVisible();
  await expect(lateCheckoutStayRow).toContainText('Completada');

  await page.getByRole('link', { name: 'Reservas', exact: true }).click();
  const lateCheckoutReservationRow = page.getByRole('row').filter({ hasText: lateCheckoutReservationName });
  await expect(lateCheckoutReservationRow).toContainText('$ 240000');

  const expressCheckInDate = addDays(actualMismatchCheckInDate, 5);
  await page.getByRole('link', { name: 'Reservas', exact: true }).click();
  await simulatedDate.fill(expressCheckInDate);
  await page.getByRole('link', { name: 'Estadías', exact: true }).click();
  await page.getByRole('button', { name: 'Check-In Express', exact: true }).click();

  const expressCheckInDateTime = page.locator('input[formcontrolname="fechaHoraCheckInReal"]');
  const expressCheckOutDate = page.locator('input[formcontrolname="fechaCheckOutPlaneada"]');
  const expressCheckOutTime = page.locator('input[formcontrolname="horaCheckOutPlaneada"]');
  const expressTenantCards = page.locator('div[formArrayName="tenants"] > div.border.rounded-lg');
  const expressPeopleCount = page.locator('input[formcontrolname="cantidadPersonas"]');
  await expect(expressCheckInDateTime).toHaveValue(new RegExp(`^${expressCheckInDate}T`));
  await expect(expressCheckOutDate).toHaveValue('');
  await expect(expressTenantCards).toHaveCount(1);

  await page.locator('select[formcontrolname="departmentId"]').selectOption({ label: departmentName });
  await expressCheckOutDate.fill(expressCheckInDate);
  await expect(expressCheckOutTime).toBeVisible();
  await expect(expressCheckOutTime).toHaveValue('10:00');
  await expressPeopleCount.fill('2');
  await page.getByRole('button', { name: '+ Agregar inquilino' }).click();
  await expect(expressTenantCards).toHaveCount(2);
  const expressTotal = page.locator('input[formcontrolname="precioTotal"]');
  await expect(expressTotal).toHaveValue(String(departmentPricePerNight));
  const expressSubmitButton = page.getByRole('button', { name: 'Realizar Check-In Express' });

  const expressTenantName = `Eva Express ${unique}`;
  const expressSecondTenantName = `Nora Express ${unique}`;
  const expressFirstTenant = expressTenantCards.nth(0);
  await expressFirstTenant.locator('input[formcontrolname="documentNumber"]').fill(`${unique}77`);
  await expressFirstTenant.locator('input[formcontrolname="firstName"]').fill('Eva');
  await expressFirstTenant.locator('input[formcontrolname="lastName"]').fill(`Express ${unique}`);
  await expressFirstTenant.locator('input[formcontrolname="email"]').fill(`express-${unique}@nido-sereno.local`);
  await expressFirstTenant.locator('input[formcontrolname="phoneNumber"]').fill('1123456788');
  const expressSecondTenant = expressTenantCards.nth(1);
  await expressSecondTenant.locator('input[formcontrolname="documentNumber"]').fill(`${unique}78`);
  await expressSecondTenant.locator('input[formcontrolname="firstName"]').fill('Nora');
  await expressSecondTenant.locator('input[formcontrolname="lastName"]').fill(`Express ${unique}`);
  await expressSecondTenant.locator('input[formcontrolname="email"]').fill(`express-nora-${unique}@nido-sereno.local`);
  await expressSecondTenant.locator('input[formcontrolname="phoneNumber"]').fill('1123456789');
  await page.locator('textarea[formcontrolname="comentariosCheckIn"]').fill('Llegada sin reserva previa.');

  await expressCheckOutTime.fill('10:00');
  await expect(expressSubmitButton).toBeDisabled();
  await expect(page.getByText('La hora de check-out debe ser posterior a la hora de check-in.')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: expressTenantName })).toHaveCount(0);
  await expressCheckOutTime.fill(oneHourAfter(await expressCheckInDateTime.inputValue()));
  await expect(expressSubmitButton).toBeEnabled();
  const expectedExpressCheckOutDateTime = `${expressCheckInDate}T${await expressCheckOutTime.inputValue()}:00`;

  const expressRequestPromise = page.waitForRequest(request =>
    request.method() === 'POST' && request.url().endsWith('/stays')
  );
  const expressResponsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST' && response.url().endsWith('/stays')
  );
  await expressSubmitButton.click();
  const expressRequest = await expressRequestPromise;
  const expressResponse = await expressResponsePromise;
  const expressRequestBody = expressRequest.postDataJSON();
  expect(expressRequestBody.fechaHoraCheckInReal).toMatch(new RegExp(`^${expressCheckInDate}T`));
  expect(expressRequestBody.fechaCheckOutPlaneada).toBe(expressCheckInDate);
  expect(expressRequestBody.fechaHoraCheckOutPlaneada).toBe(expectedExpressCheckOutDateTime);
  expect(expressRequestBody.cantidadPersonas).toBe(2);
  expect(expressRequestBody.precioTotal).toBe(departmentPricePerNight);
  expect(expressRequestBody.montoSenia).toBe(departmentPricePerNight);
  expect(expressRequestBody.tenants).toHaveLength(2);
  expect(expressRequestBody.tenants[0].firstName).toBe('Eva');
  expect(expressRequestBody.tenants[1].firstName).toBe('Nora');
  const createdExpressStay = await expressResponse.json();
  expect(createdExpressStay.fechaHoraCheckOutPlaneada).toBe(expectedExpressCheckOutDateTime);

  await expect(page.getByText('Check-in express realizado exitosamente.')).toBeVisible();
  const expressStayRow = page.getByRole('row').filter({ hasText: expressTenantName });
  await expect(expressStayRow).toContainText('En curso');

  await expressStayRow.getByRole('button', { name: 'Check-out' }).click();
  const checkoutScore = page.locator('select[formcontrolname="classificationScore"]');
  await checkoutScore.selectOption({ label: '5 - Excelente' });
  await page.getByRole('button', { name: 'Confirmar Check-out' }).click();
  const classificationDialog = page.getByRole('dialog', { name: 'Recordatorio de clasificación' });
  await expect(classificationDialog).toBeVisible();
  await expect(classificationDialog).toContainText('sin guardar una clasificación');
  await classificationDialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(classificationDialog).toBeHidden();
  await expect(page.locator('input[formcontrolname="fechaHoraCheckOutReal"]')).toBeVisible();
  await expect(checkoutScore).toHaveValue('5: 5');
  await expect(expressStayRow).toContainText('En curso');

  await checkoutScore.selectOption({ label: 'Seleccioná una puntuación' });
  await page.locator('input[formcontrolname="classificationReviewComment"]').fill('Sin puntuación, solo comentario.');
  await page.getByRole('button', { name: 'Confirmar Check-out' }).click();
  await expect(classificationDialog).toBeVisible();
  const expressCheckoutRequestPromise = page.waitForRequest(request =>
    request.method() === 'PATCH' && request.url().endsWith(`/stays/${createdExpressStay.id}/checkout`)
  );
  await classificationDialog.getByRole('button', { name: 'Confirmar de todas formas' }).click();
  const expressCheckoutRequest = await expressCheckoutRequestPromise;
  const expressCheckoutRequestBody = expressCheckoutRequest.postDataJSON();
  expect(expressCheckoutRequestBody).not.toHaveProperty('classificationScore');
  expect(expressCheckoutRequestBody).not.toHaveProperty('classificationReviewComment');
  await expect(page.getByText('Check-out realizado exitosamente.')).toBeVisible();
  await expect(expressStayRow).toContainText('Completada');
  await expect(expressStayRow.locator('td').nth(4)).toHaveText('—');
});