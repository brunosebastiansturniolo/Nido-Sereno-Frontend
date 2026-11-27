import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const mailDevApi = 'http://127.0.0.1:1081/api/email';
const baseDate = new Date().toISOString().slice(0, 10);
const pricePerNight = 80_000;
const minimumDeposit = 64_000;
const password = 'E2e-local-Password-123!';

let ownerEmail: string;
let complexName: string;
let departmentName: string;
let documentSequence = 0;

type Booking = {
  label: string;
  firstName: string;
  lastName: string;
  name: string;
  checkInDate: string;
  nights: number;
  people: number;
  deposit: number;
};

type Tenant = {
  firstName: string;
  lastName: string;
};

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
  }, { timeout: 30_000, message: `Debe llegar el correo de activación a ${email}` }).toBe(true);

  const messageId = activationEmail.id ?? activationEmail._id;
  if (messageId) {
    const detail = await request.get(`${mailDevApi}/${encodeURIComponent(messageId)}`);
    if (detail.ok()) activationEmail = await detail.json();
  }

  const body = [activationEmail.text, activationEmail.html]
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
  const code = body.match(/<div class="activation-code">[\s\S]*?<span>(\d{6})<\/span>/i)?.[1];
  expect(code, 'El correo local debe contener el código de activación de seis dígitos').toBeDefined();
  return code!;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function nextDocumentNumber(): string {
  documentSequence += 1;
  return `${Date.now()}${documentSequence}`;
}

async function setSimulatedDate(page: Page, date: string, time = '12:00'): Promise<void> {
  await page.evaluate(value => {
    localStorage.setItem('dateSimulator_enabled', '1');
    localStorage.setItem('dateSimulator_date', new Date(`${value.date}T${value.time}:00`).toISOString());
    localStorage.setItem('dateSimulator_skipWarning', '1');
  }, { date, time });
  await page.reload();
  await expect(page.locator('aside input[type="date"]')).toHaveValue(date);
}

function createBooking(label: string, dayOffset: number, nights = 3, people = 1, deposit = 0): Booking {
  const firstName = 'Reservante';
  const lastName = `${label} ${Date.now()}`;
  return {
    label,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    checkInDate: addDays(baseDate, dayOffset),
    nights,
    people,
    deposit
  };
}

async function createReservation(page: Page, booking: Booking): Promise<void> {
  await setSimulatedDate(page, addDays(booking.checkInDate, -1));
  await page.goto('/#/dashboard/reservations');
  await page.locator('input[formcontrolname="firstName"]').fill(booking.firstName);
  await page.locator('input[formcontrolname="lastName"]').fill(booking.lastName);
  await page.locator('input[formcontrolname="documentNumber"]').fill(nextDocumentNumber());
  await page.locator('input[formcontrolname="phoneNumber"]').fill('1123456789');
  await page.locator('input[formcontrolname="cantidadPersonas"]').fill(String(booking.people));
  await page.locator('input[formcontrolname="fechaCheckIn"]').fill(booking.checkInDate);
  await page.locator('input[formcontrolname="cantidadNoches"]').fill(String(booking.nights));
  await page.locator('select[formcontrolname="departmentId"]').selectOption({
    label: `${departmentName} (${pricePerNight}$/noche)`
  });
  await page.locator('input[formcontrolname="montoSenia"]').fill(String(booking.deposit));
  await page.getByRole('button', { name: 'Crear reserva' }).click();
  await expect(page.getByText('Reserva creada exitosamente.')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: booking.name })).toBeVisible();
}

async function fillTenantCard(page: Page, index: number, tenant: Tenant, emailPrefix: string): Promise<void> {
  const card = page.locator('div[formArrayName="tenants"] > div.border.rounded-lg').nth(index);
  await card.locator('input[formcontrolname="documentNumber"]').fill(nextDocumentNumber());
  await card.locator('input[formcontrolname="firstName"]').fill(tenant.firstName);
  await card.locator('input[formcontrolname="lastName"]').fill(tenant.lastName);
  await card.locator('input[formcontrolname="email"]').fill(`${emailPrefix}-${documentSequence}@nido-sereno.local`);
  await card.locator('input[formcontrolname="phoneNumber"]').fill(`11234567${String(documentSequence).slice(-2).padStart(2, '0')}`);
}

async function checkInFromReservation(
  page: Page,
  booking: Booking,
  tenants: Tenant[],
  payment: number,
  actualDate = booking.checkInDate
): Promise<any> {
  await setSimulatedDate(page, actualDate);
  await page.goto('/#/dashboard/stays');
  await page.getByRole('button', { name: 'Desde Reserva' }).click();
  const reservationSelect = page.locator('select[formcontrolname="reservationId"]');
  await reservationSelect.selectOption({ label: `${booking.name} - ${booking.checkInDate}` });
  const cards = page.locator('div[formArrayName="tenants"] > div.border.rounded-lg');
  await expect(cards).toHaveCount(booking.people);
  for (let index = 0; index < tenants.length; index++) {
    await fillTenantCard(page, index, tenants[index], `tenant-${booking.label.toLowerCase()}`);
  }
  await page.locator('input[formcontrolname="fechaHoraCheckInReal"]').fill(`${actualDate}T13:00`);
  await page.locator('input[formcontrolname="montoPagadoEnCheckIn"]').fill(String(payment));
  const responsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST' && response.url().endsWith('/stays/checkin')
  );
  await page.getByRole('button', { name: 'Realizar Check-In' }).click();
  const response = await responsePromise;
  expect(response.status(), 'El check-in debe responder correctamente').toBe(201);
  const body = await response.json();
  await expect(page.getByText('Check-in realizado exitosamente.')).toBeVisible();
  return body;
}

async function cancelReservation(page: Page, row: ReturnType<Page['getByRole']>, confirm: boolean): Promise<void> {
  const dialogPromise = page.waitForEvent('dialog');
  const clickPromise = row.getByRole('button', { name: 'Cancelar' }).click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toBe('¿Estás seguro de cancelar esta reserva?');
  if (confirm) await dialog.accept();
  else await dialog.dismiss();
  await clickPromise;
}

async function startCheckout(
  page: Page,
  tenantName: string,
  checkoutDate: string,
  time = '10:00'
): Promise<ReturnType<Page['getByRole']>> {
  await setSimulatedDate(page, checkoutDate);
  await page.goto('/#/dashboard/stays');
  const row = page.getByRole('row').filter({ hasText: tenantName });
  await row.getByRole('button', { name: 'Check-out' }).click();
  await page.locator('input[formcontrolname="fechaHoraCheckOutReal"]').fill(`${checkoutDate}T${time}`);
  await page.locator('select[formcontrolname="classificationScore"]').selectOption({ label: '5 - Excelente' });
  await page.locator('input[formcontrolname="classificationReviewComment"]').fill('Buena estadía de prueba.');
  await page.getByRole('button', { name: 'Confirmar Check-out' }).click();
  return row;
}

test.describe('Flujos E2E de reservas y estadías', () => {
  test.beforeAll(async ({ browser, request }) => {
    test.setTimeout(180_000);

    const unique = Date.now();
    ownerEmail = `workflow-e2e-${unique}@nido-sereno.local`;
    complexName = `Complejo E2E ${unique}`;
    departmentName = `Cabaña E2E ${unique}`;

    const context = await browser.newContext({ baseURL: 'http://localhost:4201' });
    const page = await context.newPage();
    await page.goto('/#/register');
    await page.getByPlaceholder('Juan').fill('Propietario');
    await page.getByPlaceholder('Pérez').fill(`Workflow${unique}`);
    await page.getByPlaceholder('tu@email.com').fill(ownerEmail);
    await page.getByPlaceholder('Mínimo 8 caracteres').fill(password);
    await page.getByPlaceholder('Repetí la contraseña').fill(password);
    await page.getByRole('button', { name: 'Registrarse' }).click();
    await expect(page.getByText('¡Registro exitoso! Revisá tu email para activar tu cuenta.')).toBeVisible();

    const activationCode = await getActivationCode(request, ownerEmail);
    await page.goto('/#/activate-account');
    await page.getByPlaceholder('123456').fill(activationCode);
    await page.getByRole('button', { name: 'Activar cuenta' }).click();
    await expect(page.getByText('¡Cuenta activada exitosamente! Podés iniciar sesión.')).toBeVisible();
    await page.goto('/#/login');
    await page.getByPlaceholder('tu@email.com').fill(ownerEmail);
    await page.getByPlaceholder('••••••••').fill(password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/#\/dashboard/);

    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
    const complexResponse = await request.post('http://localhost:8081/api/v1/complexs', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        nombre: complexName,
        ubicacion: 'Bariloche, Río Negro',
        descripcion: 'Complejo base para las pruebas E2E'
      }
    });
    expect(complexResponse.status()).toBe(201);
    const complexesResponse = await request.get('http://localhost:8081/api/v1/complexs/myComplexs', {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(complexesResponse.status()).toBe(200);
    const complexes = await complexesResponse.json();
    const persistedComplex = complexes.find((complex: { nombre: string }) => complex.nombre === complexName);
    expect(persistedComplex?.id).toBeTruthy();
    const departmentResponse = await request.post('http://localhost:8081/api/v1/departments', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        nombre: departmentName,
        numeroHabitaciones: 2,
        precioPorNoche: pricePerNight,
        porcentajeSeniaRequerida: 80,
        baseCalculoSenia: 'NIGHT_PRICE',
        tamañoM2: 65,
        incluyeCochera: false,
        incluyeDesayuno: true,
        tieneWifi: true,
        tienePileta: false,
        complexId: persistedComplex.id
      }
    });
    expect(departmentResponse.status(), await departmentResponse.text()).toBe(201);
    const createdDepartment = await departmentResponse.json();
    expect(createdDepartment.nombre).toBe(departmentName);
    expect(createdDepartment.precioPorNoche).toBe(pricePerNight);
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(initialDate => {
      if (localStorage.getItem('dateSimulator_enabled') === null) {
        localStorage.setItem('dateSimulator_enabled', '1');
        localStorage.setItem('dateSimulator_date', new Date(`${initialDate}T12:00:00`).toISOString());
        localStorage.setItem('dateSimulator_skipWarning', '1');
      }
    }, baseDate);
    await page.goto('/#/login');
    await page.getByPlaceholder('tu@email.com').fill(ownerEmail);
    await page.getByPlaceholder('••••••••').fill(password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/#\/dashboard/);
  });

  test('crea un complejo y muestra sus datos en la lista', async ({ page }) => {
    const uiComplexName = `Complejo interfaz ${Date.now()}`;
    await page.goto('/#/dashboard/complexes');
    await page.getByPlaceholder('Nombre').fill(uiComplexName);
    await page.getByPlaceholder('Ubicación').fill('Bariloche, Río Negro');
    await page.getByPlaceholder('Descripción (opcional)').fill('Alojamiento para pruebas E2E');
    const responsePromise = page.waitForResponse(response =>
      response.request().method() === 'POST' && response.url().endsWith('/complexs')
    );
    await page.getByRole('button', { name: 'Crear complejo' }).click();
    expect((await responsePromise).status()).toBe(201);
    await expect(page.getByText('Complejo creado exitosamente.')).toBeVisible();
    const row = page.getByRole('row').filter({ hasText: uiComplexName });
    await expect(row).toContainText('Bariloche, Río Negro');
    await expect(row).toContainText('Alojamiento para pruebas E2E');
  });

  test('crea un departamento y lo muestra asociado al complejo', async ({ page }) => {
    const uiDepartmentName = `Cabaña interfaz ${Date.now()}`;
    await page.goto('/#/dashboard/departments');
    await page.getByPlaceholder('Ej: Planta baja').fill(uiDepartmentName);
    await page.locator('input[formcontrolname="numeroHabitaciones"]').fill('2');
    await page.locator('input[formcontrolname="precioPorNoche"]').fill(String(pricePerNight));
    await page.locator('input[formcontrolname="porcentajeSeniaRequerida"]').fill('80');
    await page.locator('select[formcontrolname="baseCalculoSenia"]').selectOption('NIGHT_PRICE');
    await expect(page.locator('input[formcontrolname="montoSeniaRequerida"]')).toHaveValue(String(minimumDeposit));
    await page.getByPlaceholder('Ej: 65').fill('65');
    await page.locator('select[formcontrolname="complexId"]').selectOption({ label: complexName });
    const responsePromise = page.waitForResponse(response =>
      response.request().method() === 'POST' && response.url().endsWith('/departments')
    );
    await page.getByRole('button', { name: 'Crear departamento' }).click();
    expect((await responsePromise).status()).toBe(201);
    await expect(page.getByText('Departamento creado exitosamente.')).toBeVisible();
    const entry = page.locator('tr, div.border.rounded-lg').filter({ hasText: uiDepartmentName }).first();
    await expect(entry).toContainText(complexName);
    await expect(entry).toContainText(`$ ${pricePerNight}`);
    await expect(entry).toContainText('80% de una noche');
  });

  test('crea y lista una reserva pendiente, y recalcula fechas, noches y total', async ({ page }) => {
    await page.goto('/#/dashboard/reservations');
    const checkIn = page.locator('input[formcontrolname="fechaCheckIn"]');
    const checkOut = page.locator('input[formcontrolname="fechaCheckOut"]');
    const nights = page.locator('input[formcontrolname="cantidadNoches"]');
    const total = page.locator('input[formcontrolname="precioTotal"]');
    await expect(checkIn).toHaveValue(baseDate);
    await expect(checkOut).toHaveValue(addDays(baseDate, 1));
    await expect(nights).toHaveValue('1');
    await page.locator('select[formcontrolname="departmentId"]').selectOption({
      label: `${departmentName} (${pricePerNight}$/noche)`
    });
    await expect(total).toHaveValue(String(pricePerNight));

    await checkIn.fill(addDays(baseDate, -1));
    await expect(checkOut).toHaveValue(addDays(baseDate, 1));
    await expect(nights).toHaveValue('2');
    await expect(total).toHaveValue(String(pricePerNight * 2));
    await checkOut.fill(addDays(baseDate, 2));
    await expect(checkIn).toHaveValue(addDays(baseDate, -1));
    await expect(nights).toHaveValue('3');
    await expect(total).toHaveValue(String(pricePerNight * 3));
    await nights.fill('2');
    await expect(checkOut).toHaveValue(addDays(baseDate, 1));
    await expect(total).toHaveValue(String(pricePerNight * 2));

    const booking = createBooking('Pendiente', 4, 3, 2, 0);
    await createReservation(page, booking);
    const row = page.getByRole('row').filter({ hasText: booking.name });
    await expect(row).toContainText(departmentName);
    await expect(row).toContainText('2 personas');
    await expect(row).toContainText('Pendiente');
    await expect(row).toContainText('$ 0');
    await expect(row.getByRole('button', { name: 'Señar' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Cancelar' })).toBeVisible();
  });

  test('cancela reservas con y sin seña, conserva el historial pagado', async ({ page }) => {
    const noDepositBooking = createBooking('CancelarSinSenia', 10, 1, 1, 0);
    await createReservation(page, noDepositBooking);
    const noDepositRow = page.getByRole('row').filter({ hasText: noDepositBooking.name });
    await expect(noDepositRow).toContainText('Pendiente');
    await cancelReservation(page, noDepositRow, false);
    await expect(noDepositRow).toContainText('Pendiente');
    await expect(noDepositRow.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    await cancelReservation(page, noDepositRow, true);
    await expect(noDepositRow).toContainText('Cancelada');
    await expect(noDepositRow).toContainText('$ 0');

    const paidBooking = createBooking('CancelarConSenia', 20, 1, 1, minimumDeposit);
    await createReservation(page, paidBooking);
    const paidRow = page.getByRole('row').filter({ hasText: paidBooking.name });
    await expect(paidRow).toContainText('Confirmada');
    await expect(paidRow).toContainText(`$ ${minimumDeposit}`);
    await cancelReservation(page, paidRow, true);
    await expect(paidRow).toContainText('Cancelada');
    await expect(paidRow).toContainText(`$ ${minimumDeposit}`);
    await expect(paidRow.getByRole('button', { name: 'Cancelar' })).toHaveCount(0);
  });

  test('acumula abonos de seña y confirma al alcanzar el mínimo', async ({ page }) => {
    const booking = createBooking('Abonos', 30, 2, 1, 0);
    await createReservation(page, booking);
    const row = page.getByRole('row').filter({ hasText: booking.name });

    await row.getByRole('button', { name: 'Señar' }).click();
    let dialog = page.getByRole('dialog', { name: 'Registrar seña' });
    await expect(dialog).toContainText('Falta para confirmar: $64.000');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(row).toContainText('$ 0');

    await row.getByRole('button', { name: 'Señar' }).click();
    dialog = page.getByRole('dialog', { name: 'Registrar seña' });
    await dialog.locator('input[name="depositAmount"]').fill('20000');
    await expect(dialog).toContainText('Falta para confirmar: $44.000');
    await dialog.getByRole('button', { name: 'Aceptar' }).click();
    await expect(row).toContainText('Pendiente');
    await expect(row).toContainText('$ 20000');

    await row.getByRole('button', { name: 'Señar' }).click();
    dialog = page.getByRole('dialog', { name: 'Registrar seña' });
    await dialog.locator('input[name="depositAmount"]').fill('44000');
    await expect(dialog).toContainText('Falta para confirmar: $0');
    await dialog.getByRole('button', { name: 'Aceptar' }).click();
    await expect(row).toContainText('Confirmada');
    await expect(row).toContainText(`$ ${minimumDeposit}`);
  });

  test('precarga dos inquilinos y confirma cambios en la cantidad antes del check-in', async ({ page }) => {
    const booking = createBooking('DosInquilinos', 40, 3, 2, minimumDeposit);
    await createReservation(page, booking);
    await setSimulatedDate(page, booking.checkInDate);
    await page.goto('/#/dashboard/stays');
    await page.getByRole('button', { name: 'Desde Reserva' }).click();
    await page.locator('select[formcontrolname="reservationId"]').selectOption({
      label: `${booking.name} - ${booking.checkInDate}`
    });
    const cards = page.locator('div[formArrayName="tenants"] > div.border.rounded-lg');
    await expect(cards).toHaveCount(2);
    await fillTenantCard(page, 0, { firstName: 'Lucía', lastName: 'Fernández' }, 'lucia');
    await fillTenantCard(page, 1, { firstName: 'Pablo', lastName: 'Suárez' }, 'pablo');

    await page.getByRole('button', { name: /Agregar inquilino/ }).click();
    let countDialog = page.getByRole('dialog', { name: 'Diferencia en cantidad de inquilinos' });
    await expect(countDialog).toContainText('La reserva propone 2 personas');
    await expect(countDialog).toContainText('check-in quedaría con 3 personas');
    await countDialog.getByRole('button', { name: 'Cancelar acción' }).click();
    await expect(cards).toHaveCount(2);

    await page.getByRole('button', { name: /Agregar inquilino/ }).click();
    countDialog = page.getByRole('dialog', { name: 'Diferencia en cantidad de inquilinos' });
    await countDialog.getByRole('button', { name: 'Proceder de todas formas' }).click();
    await expect(cards).toHaveCount(3);
    await fillTenantCard(page, 2, { firstName: 'Prueba', lastName: 'Temporal' }, 'temporal');
    await cards.nth(2).getByRole('button', { name: 'Eliminar' }).click();
    countDialog = page.getByRole('dialog', { name: 'Diferencia en cantidad de inquilinos' });
    await expect(countDialog).toContainText('check-in quedaría con 2 personas');
    await countDialog.getByRole('button', { name: 'Proceder de todas formas' }).click();
    await expect(cards).toHaveCount(2);

    await page.locator('input[formcontrolname="montoPagadoEnCheckIn"]').fill('176000');
    const requestPromise = page.waitForRequest(request =>
      request.method() === 'POST' && request.url().endsWith('/stays/checkin')
    );
    await page.getByRole('button', { name: 'Realizar Check-In' }).click();
    const request = await requestPromise;
    expect(request.postDataJSON().tenants).toHaveLength(2);
    expect(request.postDataJSON().montoPagadoEnCheckIn).toBe(176_000);
    await expect(page.getByText('Check-in realizado exitosamente.')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Lucía Fernández' })).toContainText('En curso');
  });

  test('registra el pago completo al check-out y guarda la clasificación', async ({ page }) => {
    const booking = createBooking('CheckoutCompleto', 50, 3, 1, minimumDeposit);
    await createReservation(page, booking);
    const tenant = { firstName: 'Huésped', lastName: `PagoCompleto${Date.now()}` };
    const tenantName = `${tenant.firstName} ${tenant.lastName}`;
    const stay = await checkInFromReservation(page, booking, [tenant], 100_000);
    const checkOutDate = addDays(booking.checkInDate, booking.nights);
    await setSimulatedDate(page, checkOutDate);
    await page.goto('/#/dashboard/stays');
    const stayRow = page.getByRole('row').filter({ hasText: tenantName });
    await stayRow.getByRole('button', { name: 'Check-out' }).click();
    await page.locator('input[formcontrolname="fechaHoraCheckOutReal"]').fill(`${checkOutDate}T10:00`);
    await page.locator('textarea[formcontrolname="comentariosCheckOut"]').fill('Pagó el saldo al retirarse.');
    await page.locator('select[formcontrolname="classificationScore"]').selectOption({ label: '5 - Excelente' });
    await page.locator('input[formcontrolname="classificationReviewComment"]').fill('Dejó el departamento en buen estado.');
    await page.getByRole('button', { name: 'Confirmar Check-out' }).click();

    const dialog = page.getByRole('dialog', { name: 'Registrar pago del check-out' });
    await expect(dialog).toContainText('Saldo pendiente antes de este pago: $ 76.000');
    await dialog.locator('input[name="checkoutPaymentAmount"]').fill('76000');
    await expect(dialog.locator('p').filter({ hasText: 'Saldo después del pago:' })).toContainText('$ 0');
    await expect(dialog.getByText(/saldo impago/)).toHaveCount(0);
    const requestPromise = page.waitForRequest(request =>
      request.method() === 'PATCH' && request.url().endsWith(`/stays/${stay.id}/checkout`)
    );
    await dialog.getByRole('button', { name: 'Registrar pago y finalizar check-out' }).click();
    const request = await requestPromise;
    expect(request.postDataJSON().montoPagadoEnCheckOut).toBe(76_000);
    expect(request.postDataJSON().comentariosCheckOut).toBe('Pagó el saldo al retirarse.');
    expect(request.postDataJSON().comentariosCheckOut).not.toContain('SALDO IMPAGO');
    await expect(page.getByText('Check-out realizado exitosamente.')).toBeVisible();
    await expect(stayRow).toContainText('Completada');
    await page.goto('/#/dashboard/tenants');
    const tenantRow = page.getByRole('row').filter({ hasText: tenantName });
    await tenantRow.getByRole('button', { name: 'Ver clasificaciones' }).click();
    await expect(page.getByText('Dejó el departamento en buen estado.')).toBeVisible();
  });

  for (const scenario of [
    { label: 'Cuarenta', payment: 40_000, remaining: 36_000, offset: 60 },
    { label: 'Veinte', payment: 20_000, remaining: 56_000, offset: 70 },
    { label: 'Cero', payment: 0, remaining: 76_000, offset: 80 }
  ]) {
    test(`finaliza con deuda después de pagar $${scenario.payment.toLocaleString('es-AR')} al check-out`, async ({ page }) => {
      const booking = createBooking(`Deuda${scenario.label}`, scenario.offset, 3, 1, minimumDeposit);
      await createReservation(page, booking);
      const tenant = { firstName: 'Huésped', lastName: `Deuda${scenario.label}${Date.now()}` };
      const tenantName = `${tenant.firstName} ${tenant.lastName}`;
      await checkInFromReservation(page, booking, [tenant], 100_000);
      const checkOutDate = addDays(booking.checkInDate, booking.nights);
      const stayRow = await startCheckout(page, tenantName, checkOutDate);
      let dialog = page.getByRole('dialog', { name: 'Registrar pago del check-out' });
      await expect(dialog).toContainText('Saldo pendiente antes de este pago: $ 76.000');
      await dialog.locator('input[name="checkoutPaymentAmount"]').fill(String(scenario.payment));
      const remaining = dialog.locator('p').filter({ hasText: 'Saldo después del pago:' });
      await expect(remaining).toContainText(`$ ${scenario.remaining.toLocaleString('es-AR')}`);
      await expect(remaining).toHaveClass(/text-red-700/);
      await expect(dialog.getByText(/El huésped se retirará con un saldo impago/)).toBeVisible();

      await dialog.getByRole('button', { name: 'Cerrar check-out con saldo impago' }).click();
      await expect(dialog.getByText('Explicá el motivo del saldo impago para cerrar la estadía.')).toBeVisible();
      const reason = `Quedaron $${scenario.remaining} pendientes al retirarse.`;
      await dialog.locator('textarea[name="checkoutDebtComment"]').fill(reason);
      if (scenario.payment === 40_000) {
        await dialog.getByRole('button', { name: 'Cancelar' }).click();
        await expect(dialog).toBeHidden();
        await expect(stayRow).toContainText('En curso');
        await page.getByRole('button', { name: 'Confirmar Check-out' }).click();
        dialog = page.getByRole('dialog', { name: 'Registrar pago del check-out' });
        await dialog.locator('input[name="checkoutPaymentAmount"]').fill(String(scenario.payment));
        await dialog.locator('textarea[name="checkoutDebtComment"]').fill(reason);
      }
      await dialog.getByRole('button', { name: 'Cerrar check-out con saldo impago' }).click();
      await expect(page.getByText('Check-out realizado exitosamente.')).toBeVisible();
      await expect(stayRow).toContainText('Completada');
      await page.goto('/#/dashboard/reservations');
      const reservationRow = page.getByRole('row').filter({ hasText: booking.name });
      await expect(reservationRow).toContainText(`$ ${240_000 - scenario.remaining}`);
    });
  }

  test('requiere justificar la llegada en otra fecha antes de completar el check-in', async ({ page }) => {
    const booking = createBooking('FechaDiferente', 90, 3, 2, 0);
    await createReservation(page, booking);
    const actualDate = addDays(booking.checkInDate, 1);
    await setSimulatedDate(page, actualDate);
    await page.goto('/#/dashboard/stays');
    await page.getByRole('button', { name: 'Desde Reserva' }).click();
    await page.locator('select[formcontrolname="reservationId"]').selectOption({
      label: `${booking.name} - ${booking.checkInDate}`
    });
    const cards = page.locator('div[formArrayName="tenants"] > div.border.rounded-lg');
    await expect(cards).toHaveCount(2);
    await cards.nth(1).getByRole('button', { name: 'Eliminar' }).click();
    const countDialog = page.getByRole('dialog', { name: 'Diferencia en cantidad de inquilinos' });
    await countDialog.getByRole('button', { name: 'Proceder de todas formas' }).click();
    await fillTenantCard(page, 0, { firstName: 'Huésped', lastName: 'Diferente' }, 'diferente');
    await page.locator('input[formcontrolname="fechaHoraCheckInReal"]').fill(`${actualDate}T13:00`);
    await page.locator('input[formcontrolname="montoPagadoEnCheckIn"]').fill('0');

    await page.getByRole('button', { name: 'Realizar Check-In' }).click();
    let dialog = page.getByRole('dialog', { name: 'Fecha de check-in no coincide' });
    await expect(dialog).toContainText(booking.checkInDate);
    await expect(dialog).toContainText(actualDate);
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('row').filter({ hasText: 'Huésped Diferente' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Realizar Check-In' }).click();
    dialog = page.getByRole('dialog', { name: 'Fecha de check-in no coincide' });
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(dialog.getByText('La justificación es obligatoria para continuar con el check-in.')).toBeVisible();
    const reason = 'Llegó un día después por un retraso en el viaje.';
    await dialog.getByPlaceholder('Escribí el motivo de la diferencia de fecha...').fill(reason);
    const requestPromise = page.waitForRequest(request =>
      request.method() === 'POST' && request.url().endsWith('/stays/checkin')
    );
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    const request = await requestPromise;
    expect(request.postDataJSON().fechaHoraCheckInReal).toMatch(new RegExp(`^${actualDate}T`));
    expect(request.postDataJSON().comentariosCheckIn).toContain(`[FECHA JUSTIFICADA] Motivo: ${reason}`);
    await expect(page.getByText('Check-in realizado exitosamente.')).toBeVisible();
  });

  test('suma una noche y exige motivo cuando el check-in ocurre un día antes', async ({ page }) => {
    const booking = createBooking('LlegadaAnticipada', 101, 3, 1, 0);
    await createReservation(page, booking);
    const actualDate = addDays(booking.checkInDate, -1);
    await setSimulatedDate(page, actualDate);
    await page.goto('/#/dashboard/stays');
    await page.getByRole('button', { name: 'Desde Reserva' }).click();
    await page.locator('select[formcontrolname="reservationId"]').selectOption({
      label: `${booking.name} - ${booking.checkInDate}`
    });
    await fillTenantCard(page, 0, { firstName: 'Huésped', lastName: 'Anticipado' }, 'anticipado');
    await page.locator('input[formcontrolname="fechaHoraCheckInReal"]').fill(`${actualDate}T13:00`);
    await page.locator('input[formcontrolname="montoPagadoEnCheckIn"]').fill('0');
    await page.getByRole('button', { name: 'Realizar Check-In' }).click();

    const dialog = page.getByRole('dialog', { name: 'Fecha de check-in no coincide' });
    await expect(dialog).toContainText('antes');
    await expect(dialog).toContainText('La llegada anticipada suma 1 noche. Al continuar, el total pasa de $ 240.000 a $ 320.000.');
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(dialog.getByText('La justificación es obligatoria para continuar con el check-in.')).toBeVisible();
    const reason = 'El huésped solicitó ingresar un día antes.';
    await dialog.getByPlaceholder('Escribí el motivo de la diferencia de fecha...').fill(reason);
    const requestPromise = page.waitForRequest(request =>
      request.method() === 'POST' && request.url().endsWith('/stays/checkin')
    );
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    const request = await requestPromise;
    expect(request.postDataJSON().fechaHoraCheckInReal).toMatch(new RegExp(`^${actualDate}T`));
    expect(request.postDataJSON().comentariosCheckIn).toContain(`[FECHA JUSTIFICADA] Motivo: ${reason}`);
    await expect(page.getByText('Check-in realizado exitosamente.')).toBeVisible();
    await page.goto('/#/dashboard/reservations');
    await expect(page.getByRole('row').filter({ hasText: booking.name })).toContainText('$ 320000');
  });

  test('registra una llegada tardía en el mismo día sin pedir justificación', async ({ page }) => {
    const booking = createBooking('LlegadaMismoDia', 110, 1, 1, 0);
    await createReservation(page, booking);
    await setSimulatedDate(page, booking.checkInDate);
    await page.goto('/#/dashboard/stays');
    await page.getByRole('button', { name: 'Desde Reserva' }).click();
    await page.locator('select[formcontrolname="reservationId"]').selectOption({
      label: `${booking.name} - ${booking.checkInDate}`
    });
    await fillTenantCard(page, 0, { firstName: 'Huésped', lastName: 'MismoDia' }, 'mismo-dia');
    const arrival = page.locator('input[formcontrolname="fechaHoraCheckInReal"]');
    await arrival.fill(`${booking.checkInDate}T22:30`);
    const requestPromise = page.waitForRequest(request =>
      request.method() === 'POST' && request.url().endsWith('/stays/checkin')
    );
    await page.getByRole('button', { name: 'Realizar Check-In' }).click();
    const request = await requestPromise;
    expect(request.postDataJSON().fechaHoraCheckInReal).toBe(`${booking.checkInDate}T22:30`);
    expect(request.postDataJSON().comentariosCheckIn ?? '').not.toContain('[FECHA JUSTIFICADA]');
    await expect(page.getByRole('dialog', { name: 'Fecha de check-in no coincide' })).toHaveCount(0);
    await expect(page.getByText('Check-in realizado exitosamente.')).toBeVisible();
  });

  test('suma una noche al check-out tardío y exige justificar la diferencia', async ({ page }) => {
    const booking = createBooking('SalidaTarde', 120, 2, 1, minimumDeposit);
    await createReservation(page, booking);
    const tenant = { firstName: 'Huésped', lastName: `SalidaTarde${Date.now()}` };
    const tenantName = `${tenant.firstName} ${tenant.lastName}`;
    await checkInFromReservation(page, booking, [tenant], 96_000);
    const plannedCheckout = addDays(booking.checkInDate, booking.nights);
    const actualCheckout = addDays(plannedCheckout, 1);
    await setSimulatedDate(page, actualCheckout);
    await page.goto('/#/dashboard/stays');
    const row = page.getByRole('row').filter({ hasText: tenantName });
    await row.getByRole('button', { name: 'Check-out' }).click();
    await page.locator('input[formcontrolname="fechaHoraCheckOutReal"]').fill(`${actualCheckout}T10:00`);
    await page.locator('select[formcontrolname="classificationScore"]').selectOption({ label: '5 - Excelente' });
    await page.locator('input[formcontrolname="classificationReviewComment"]').fill('Una noche adicional acordada.');
    await page.getByRole('button', { name: 'Confirmar Check-out' }).click();

    const paymentDialog = page.getByRole('dialog', { name: 'Registrar pago del check-out' });
    await expect(paymentDialog).toContainText('El total se actualiza de $ 160.000 a $ 240.000');
    await expect(paymentDialog).toContainText('Saldo pendiente antes de este pago: $ 80.000');
    await paymentDialog.locator('input[name="checkoutPaymentAmount"]').fill('80000');
    await paymentDialog.getByRole('button', { name: 'Registrar pago y finalizar check-out' }).click();

    const justification = page.getByRole('dialog', { name: 'Fecha de check-out no coincide' });
    await expect(justification).toContainText(plannedCheckout);
    await expect(justification).toContainText(actualCheckout);
    await justification.getByRole('button', { name: 'Confirmar' }).click();
    await expect(justification.getByText('La justificación es obligatoria para continuar con el check-out.')).toBeVisible();
    const reason = 'El huésped solicitó quedarse una noche más.';
    await justification.getByPlaceholder('Escribí el motivo de la diferencia de fecha...').fill(reason);
    const requestPromise = page.waitForRequest(request =>
      request.method() === 'PATCH' && request.url().endsWith('/checkout')
    );
    await justification.getByRole('button', { name: 'Confirmar' }).click();
    const request = await requestPromise;
    expect(request.postDataJSON().montoPagadoEnCheckOut).toBe(80_000);
    expect(request.postDataJSON().comentariosCheckOut).toContain(`[FECHA JUSTIFICADA] Motivo: ${reason}`);
    await expect(page.getByText('Check-out realizado exitosamente.')).toBeVisible();
    await page.goto('/#/dashboard/reservations');
    await expect(page.getByRole('row').filter({ hasText: booking.name })).toContainText('$ 240000');
  });

  test('permite el check-in express el mismo día y advierte si se omite la clasificación', async ({ page }) => {
    const expressDate = addDays(baseDate, 130);
    await setSimulatedDate(page, expressDate, '06:00');
    await page.goto('/#/dashboard/stays');
    await page.getByRole('button', { name: 'Check-In Express', exact: true }).click();
    await page.locator('select[formcontrolname="departmentId"]').selectOption({ label: departmentName });
    const checkIn = page.locator('input[formcontrolname="fechaHoraCheckInReal"]');
    const checkOutDate = page.locator('input[formcontrolname="fechaCheckOutPlaneada"]');
    await checkOutDate.fill(expressDate);
    const checkOutTime = page.locator('input[formcontrolname="horaCheckOutPlaneada"]');
    await expect(checkOutTime).toBeVisible();
    await expect(checkOutTime).toHaveValue('10:00');
    const peopleCount = page.locator('input[formcontrolname="cantidadPersonas"]');
    await expect(peopleCount).toHaveValue('1');
    await peopleCount.fill('2');
    await page.getByRole('button', { name: '+ Agregar inquilino' }).click();
    const cards = page.locator('div[formArrayName="tenants"] > div.border.rounded-lg');
    await expect(cards).toHaveCount(2);
    const firstTenant = { firstName: 'Eva', lastName: `Express${Date.now()}` };
    const secondTenant = { firstName: 'Nora', lastName: `Express${Date.now()}` };
    await fillTenantCard(page, 0, firstTenant, 'express-eva');
    await fillTenantCard(page, 1, secondTenant, 'express-nora');
    await page.locator('textarea[formcontrolname="comentariosCheckIn"]').fill('Llegada sin reserva previa.');
    const checkInTime = (await checkIn.inputValue()).slice(11, 16);
    await checkOutTime.fill(checkInTime);
    const submit = page.getByRole('button', { name: 'Realizar Check-In Express' });
    await expect(submit).toBeDisabled();
    await expect(page.getByText('La hora de check-out debe ser posterior a la hora de check-in.')).toBeVisible();
    await checkOutTime.fill('10:00');
    await expect(submit).toBeEnabled();

    const expectedCheckout = `${expressDate}T10:00:00`;
    const requestPromise = page.waitForRequest(request =>
      request.method() === 'POST' && request.url().endsWith('/stays')
    );
    const responsePromise = page.waitForResponse(response =>
      response.request().method() === 'POST' && response.url().endsWith('/stays')
    );
    await submit.click();
    const request = await requestPromise;
    const response = await responsePromise;
    const requestBody = request.postDataJSON();
    expect(requestBody.fechaCheckOutPlaneada).toBe(expressDate);
    expect(requestBody.fechaHoraCheckOutPlaneada).toBe(expectedCheckout);
    expect(requestBody.cantidadPersonas).toBe(2);
    expect(requestBody.precioTotal).toBe(pricePerNight);
    expect(requestBody.tenants).toHaveLength(2);
    expect(response.status()).toBe(201);
    const createdStay = await response.json();
    expect(createdStay.fechaHoraCheckOutPlaneada).toBe(expectedCheckout);
    await expect(page.getByText('Check-in express realizado exitosamente.')).toBeVisible();

    const tenantName = `${firstTenant.firstName} ${firstTenant.lastName}`;
    const stayRow = page.getByRole('row').filter({ hasText: tenantName });
    await expect(stayRow).toContainText('En curso');
    await stayRow.getByRole('button', { name: 'Check-out' }).click();
    await page.locator('input[formcontrolname="fechaHoraCheckOutReal"]').fill(`${expressDate}T10:00`);
    const score = page.locator('select[formcontrolname="classificationScore"]');
    await score.selectOption({ label: '5 - Excelente' });
    await page.getByRole('button', { name: 'Confirmar Check-out' }).click();
    let classificationDialog = page.getByRole('dialog', { name: 'Recordatorio de clasificación' });
    await expect(classificationDialog).toBeVisible();
    await classificationDialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(classificationDialog).toBeHidden();
    await expect(stayRow).toContainText('En curso');
    await score.selectOption({ label: 'Seleccioná una puntuación' });
    await page.locator('input[formcontrolname="classificationReviewComment"]').fill('Solo comentario, sin puntuación.');
    await page.getByRole('button', { name: 'Confirmar Check-out' }).click();
    classificationDialog = page.getByRole('dialog', { name: 'Recordatorio de clasificación' });
    const checkoutRequestPromise = page.waitForRequest(request =>
      request.method() === 'PATCH' && request.url().endsWith(`/stays/${createdStay.id}/checkout`)
    );
    await classificationDialog.getByRole('button', { name: 'Confirmar de todas formas' }).click();
    const checkoutRequest = await checkoutRequestPromise;
    expect(checkoutRequest.postDataJSON()).not.toHaveProperty('classificationScore');
    expect(checkoutRequest.postDataJSON()).not.toHaveProperty('classificationReviewComment');
    await expect(page.getByText('Check-out realizado exitosamente.')).toBeVisible();
    await expect(stayRow).toContainText('Completada');
  });

  test('mantiene el precio reservado si el huésped hace check-out anticipado', async ({ page }) => {
    const booking = createBooking('SalidaAnticipada', 140, 3, 1, minimumDeposit);
    await createReservation(page, booking);
    const tenant = { firstName: 'Huésped', lastName: `SalidaAnticipada${Date.now()}` };
    const tenantName = `${tenant.firstName} ${tenant.lastName}`;
    const stay = await checkInFromReservation(page, booking, [tenant], 176_000);
    const plannedCheckout = addDays(booking.checkInDate, booking.nights);
    const actualCheckout = addDays(plannedCheckout, -1);
    await setSimulatedDate(page, actualCheckout);
    await page.goto('/#/dashboard/stays');
    const row = page.getByRole('row').filter({ hasText: tenantName });
    await row.getByRole('button', { name: 'Check-out' }).click();
    await page.locator('input[formcontrolname="fechaHoraCheckOutReal"]').fill(`${actualCheckout}T10:00`);
    await page.locator('select[formcontrolname="classificationScore"]').selectOption({ label: '5 - Excelente' });
    await page.locator('input[formcontrolname="classificationReviewComment"]').fill('La estadía terminó antes de lo reservado.');
    await page.getByRole('button', { name: 'Confirmar Check-out' }).click();
    const dialog = page.getByRole('dialog', { name: 'Fecha de check-out no coincide' });
    await expect(dialog).toContainText(plannedCheckout);
    await expect(dialog).toContainText(actualCheckout);
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(dialog.getByText('La justificación es obligatoria para continuar con el check-out.')).toBeVisible();
    const reason = 'El huésped debió retirarse una noche antes.';
    await dialog.getByPlaceholder('Escribí el motivo de la diferencia de fecha...').fill(reason);
    const requestPromise = page.waitForRequest(request =>
      request.method() === 'PATCH' && request.url().endsWith(`/stays/${stay.id}/checkout`)
    );
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    const request = await requestPromise;
    expect(request.postDataJSON().fechaHoraCheckOutReal).toBe(`${actualCheckout}T10:00`);
    expect(request.postDataJSON().comentariosCheckOut).toContain(`[FECHA JUSTIFICADA] Motivo: ${reason}`);
    await expect(page.getByText('Check-out realizado exitosamente.')).toBeVisible();
    await page.goto('/#/dashboard/reservations');
    await expect(page.getByRole('row').filter({ hasText: booking.name })).toContainText('$ 240000');
  });
});