import { expect, test, type APIRequestContext } from '@playwright/test';

const mailDevApi = 'http://127.0.0.1:1081/api/email';

async function getEmail(
  request: APIRequestContext,
  email: string,
  excludeMessageId?: string
): Promise<any> {
  let message: any;
  await expect.poll(async () => {
    const response = await request.get(mailDevApi);
    if (!response.ok()) return false;
    const emails = await response.json();
    message = emails.find((item: any) => {
      const itemId = item.id ?? item._id;
      return (JSON.stringify(item)?.toLowerCase().includes(email.toLowerCase()) ?? false)
        && (!excludeMessageId || String(itemId) !== excludeMessageId);
    });
    return Boolean(message);
  }, { timeout: 30_000, message: `Debe llegar un correo a ${email} en MailDev` }).toBe(true);

  const messageId = message.id ?? message._id;
  if (messageId) {
    const detail = await request.get(`${mailDevApi}/${encodeURIComponent(messageId)}`);
    if (detail.ok()) message = await detail.json();
  }
  return message;
}

function getEmailBody(message: any): string {
  return [message.text, message.html]
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
}

test('registra, activa y recupera la contraseña de una cuenta', async ({ page, request }) => {
  test.setTimeout(120_000);

  const unique = Date.now();
  const email = `auth-e2e-${unique}@nido-sereno.local`;
  const originalPassword = 'E2e-local-Password-123!';
  const newPassword = 'E2e-local-Password-456!';

  await page.goto('/#/register');
  await page.getByPlaceholder('Juan').fill('Auth');
  await page.getByPlaceholder('Pérez').fill(`E2E${unique}`);
  await page.getByPlaceholder('tu@email.com').fill(email);
  await page.getByPlaceholder('Mínimo 8 caracteres').fill(originalPassword);
  await page.getByPlaceholder('Repetí la contraseña').fill(originalPassword);
  await page.getByRole('button', { name: 'Registrarse' }).click();
  await expect(page.getByText('¡Registro exitoso! Revisá tu email para activar tu cuenta.')).toBeVisible();

  const activationEmail = await getEmail(request, email);
  const activationMessageId = activationEmail.id ?? activationEmail._id;
  expect(activationMessageId, 'MailDev debe identificar el correo de activación').toBeTruthy();
  const activationBody = getEmailBody(activationEmail);
  expect(activationBody).toContain('Activación de Cuenta');
  const activationCode = activationBody.match(
    /<div class="activation-code">[\s\S]*?<span>(\d{6})<\/span>/i
  )?.[1];
  expect(activationCode, 'El correo debe incluir el código de activación de seis dígitos').toBeDefined();

  await expect(page).toHaveURL(/#\/activate-account$/, { timeout: 10_000 });
  await page.getByPlaceholder('123456').fill(activationCode!);
  await page.getByRole('button', { name: 'Activar cuenta' }).click();
  await expect(page.getByText('¡Cuenta activada exitosamente! Podés iniciar sesión.')).toBeVisible();
  await expect(page).toHaveURL(/#\/login$/, { timeout: 10_000 });

  await page.getByPlaceholder('tu@email.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(originalPassword);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/#\/dashboard/);

  await page.goto('/#/register');
  await page.getByPlaceholder('Juan').fill('Cuenta');
  await page.getByPlaceholder('Pérez').fill('Duplicada');
  await page.getByPlaceholder('tu@email.com').fill(email);
  await page.getByPlaceholder('Mínimo 8 caracteres').fill(originalPassword);
  await page.getByPlaceholder('Repetí la contraseña').fill(originalPassword);
  const duplicateRegistrationResponsePromise = page.waitForResponse(response =>
    response.url().endsWith('/auth/register') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Registrarse' }).click();
  expect((await duplicateRegistrationResponsePromise).status()).toBe(409);
  await expect(page.getByText('Error al registrar. Intentá de nuevo.')).toBeVisible();

  await page.goto('/#/forgot-password');
  await page.getByPlaceholder('tu@email.com').fill(email);
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(page.getByText('Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.')).toBeVisible();

  const resetEmail = await getEmail(request, email, String(activationMessageId));
  const resetBody = getEmailBody(resetEmail);
  expect(resetBody).toContain('Recuperar contraseña');
  const resetToken = resetBody.match(/token=([A-Za-z0-9_-]+)/)?.[1];
  expect(resetToken, 'El correo de recuperación debe incluir un enlace con token').toBeDefined();

  await page.goto(`/#/reset-password?token=${encodeURIComponent(resetToken!)}`);
  await page.getByLabel('Nueva contraseña').fill(newPassword);
  await page.getByLabel('Confirmar contraseña').fill(newPassword);
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await expect(page.getByText('Tu contraseña fue actualizada correctamente.')).toBeVisible();
  await expect(page).toHaveURL(/#\/login$/, { timeout: 10_000 });

  await page.goto('/#/login');
  await page.getByPlaceholder('tu@email.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(originalPassword);
  const oldPasswordResponsePromise = page.waitForResponse(response =>
    response.url().endsWith('/auth/authenticate') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  expect((await oldPasswordResponsePromise).status()).toBe(401);
  await expect(page.getByText('El email o la contraseña son incorrectos.')).toBeVisible();

  await page.getByPlaceholder('••••••••').fill(newPassword);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/#\/dashboard/);
});