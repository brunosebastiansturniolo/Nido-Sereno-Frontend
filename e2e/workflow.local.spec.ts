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
  const guestFirstName = 'Huésped';
  const guestLastName = `E2E${unique}`;
  const complexName = `Complejo E2E ${unique}`;
  const departmentName = `Departamento E2E ${unique}`;
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
  const checkOutDate = addDays(checkInDate, 1);
  await simulatedDate.fill(checkInDate);

  await page.getByRole('link', { name: 'Complejos' }).click();
  await page.getByPlaceholder('Nombre').fill(complexName);
  await page.getByPlaceholder('Ubicación').fill('Local E2E');
  await page.getByPlaceholder('Descripción (opcional)').fill('Datos descartables de Playwright');
  await page.getByRole('button', { name: 'Crear complejo' }).click();
  await expect(page.getByText('Complejo creado exitosamente.')).toBeVisible();

  await page.getByRole('link', { name: 'Departamentos' }).click({ timeout: 10_000 });
  await expect(page).toHaveURL(/#\/dashboard\/departments$/, { timeout: 5_000 });
  await page.getByPlaceholder('Ej: Planta baja').fill(departmentName);
  await page.locator('input[formcontrolname="numeroHabitaciones"]').fill('2');
  await page.getByPlaceholder('Ej: 15000').fill('15000');
  await page.getByPlaceholder('Ej: 65').fill('65');
  await page.locator('select[formcontrolname="complexId"]').selectOption({ label: complexName });
  await page.getByRole('button', { name: 'Crear departamento' }).click();
  await expect(page.getByText('Departamento creado exitosamente.')).toBeVisible();

  await page.getByRole('link', { name: 'Reservas' }).click();
  await page.locator('input[formcontrolname="firstName"]').fill(guestFirstName);
  await page.locator('input[formcontrolname="lastName"]').fill(guestLastName);
  await page.locator('input[formcontrolname="documentNumber"]').fill(`${unique}`);
  await page.locator('input[formcontrolname="phoneNumber"]').fill('1123456789');
  await page.locator('input[formcontrolname="cantidadPersonas"]').fill('1');
  await page.locator('input[formcontrolname="fechaCheckIn"]').fill(checkInDate);
  await page.locator('input[formcontrolname="cantidadNoches"]').fill('1');
  await page.locator('select[formcontrolname="departmentId"]').selectOption({
    label: `${departmentName} (15000$/noche)`
  });
  const totalPrice = await page.locator('input[formcontrolname="precioTotal"]').inputValue();
  expect(Number(totalPrice)).toBeGreaterThan(0);
  const reservationDeposit = Number(totalPrice) / 2;
  await page.locator('input[formcontrolname="montoSenia"]').fill(String(reservationDeposit));
  await page.getByRole('button', { name: 'Crear reserva' }).click();
  await expect(page.getByText('Reserva creada exitosamente.')).toBeVisible();

  await page.getByRole('link', { name: 'Estadías' }).click();
  await page.getByRole('button', { name: 'Desde Reserva' }).click();
  const reservationSelect = page.locator('select[formcontrolname="reservationId"]');
  await expect(reservationSelect.locator('option', {
    hasText: `${guestFirstName} ${guestLastName} - ${checkInDate}`
  })).toHaveCount(1);
  await reservationSelect.selectOption({
    label: `${guestFirstName} ${guestLastName} - ${checkInDate}`
  });
  await page.locator('input[formcontrolname="montoPagadoEnCheckIn"]').fill(String(Number(totalPrice) - reservationDeposit));
  await page.getByLabel('Usar reservante como primer inquilino (autocompletar datos)').check();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByRole('button', { name: 'Realizar Check-In' }).click();
  await expect(page.getByText('Check-in realizado exitosamente.')).toBeVisible();

  await simulatedDate.fill(checkOutDate);
  const stayRow = page.getByRole('row').filter({ hasText: `${guestFirstName} ${guestLastName}` });
  await stayRow.getByRole('button', { name: 'Check-out' }).click();
  await page.locator('input[formcontrolname="fechaHoraCheckOutReal"]').fill(`${checkOutDate}T12:00`);
  await page.locator('select[formcontrolname="classificationScore"]').selectOption({ label: '5 - Excelente' });
  await page.getByPlaceholder('Ej: Dejó el departamento impecable / Rompió una silla / Dejó las luces encendidas...').fill(classificationComment);
  await page.getByRole('button', { name: 'Confirmar Check-out' }).click();
  await expect(page.getByText('Check-out realizado exitosamente.')).toBeVisible();

  const completedStay = page.getByRole('row').filter({ hasText: `${guestFirstName} ${guestLastName}` });
  await expect(completedStay).toContainText('Completada');
  await expect(completedStay).toContainText('(5/5)');

  await page.getByRole('link', { name: 'Inquilinos' }).click();
  const guestRow = page.getByRole('row').filter({ hasText: `${guestFirstName} ${guestLastName}` });
  await guestRow.getByRole('button', { name: 'Ver clasificaciones' }).click();
  await expect(page.getByText(classificationComment)).toBeVisible();
});