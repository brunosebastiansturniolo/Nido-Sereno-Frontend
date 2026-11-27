import { expect, test, type APIRequestContext } from '@playwright/test';

const mailDevApi = 'http://127.0.0.1:1081/api/email';

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
  }, { timeout: 30_000, message: 'El correo local debe llegar a MailDev' }).toBe(true);

  const messageId = activationEmail.id ?? activationEmail._id;
  if (messageId) {
    const detail = await request.get(`${mailDevApi}/${encodeURIComponent(messageId)}`);
    if (detail.ok()) activationEmail = await detail.json();
  }

  const body = [activationEmail.text, activationEmail.html]
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
  const code = body.match(/<div class="activation-code">[\s\S]*?<span>(\d{6})<\/span>/i)?.[1];
  expect(code, 'El correo local debe contener el código de activación').toBeDefined();
  return code!;
}

test('renueva el access token vencido sin perder la sesión', async ({ page, request }) => {
  test.setTimeout(180_000);

  const unique = Date.now();
  const email = `refresh-e2e-${unique}@nido-sereno.local`;
  const password = 'E2e-local-Password-123!';

  await page.goto('/#/register');
  await page.getByPlaceholder('Juan').fill('Refresh');
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

  await page.getByPlaceholder('tu@email.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/#\/dashboard/);

  const initialTokens = await page.evaluate(() => ({
    accessToken: localStorage.getItem('token'),
    refreshToken: localStorage.getItem('refreshToken')
  }));
  expect(initialTokens.accessToken).toBeTruthy();
  expect(initialTokens.refreshToken).toBeTruthy();

  await page.waitForTimeout(65_000);
  expect(await page.evaluate(() => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  })).toBe(true);

  const refreshRequestPromise = page.waitForRequest(
    request => request.url().includes('/auth/refresh-token'),
    { timeout: 15_000 }
  );
  const complexesResponsePromise = page.waitForResponse(
    response => response.url().includes('/complexs/myComplexs') && response.status() === 200,
    { timeout: 15_000 }
  );
  await page.getByRole('link', { name: 'Complejos', exact: true }).evaluate(link => {
    (link as HTMLElement).click();
  });
  const refreshRequest = await refreshRequestPromise;
  expect((await refreshRequest.response())?.status()).toBe(200);
  expect((await complexesResponsePromise).status()).toBe(200);

  await expect(page).toHaveURL(/#\/dashboard\/complexes$/);
  await expect(page.getByRole('heading', { name: /Complejos/ })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  })).toBe(true);

  const refreshedTokens = await page.evaluate(() => ({
    accessToken: localStorage.getItem('token'),
    refreshToken: localStorage.getItem('refreshToken'),
    user: localStorage.getItem('user')
  }));
  expect(refreshedTokens.accessToken).not.toBe(initialTokens.accessToken);
  expect(refreshedTokens.refreshToken).not.toBe(initialTokens.refreshToken);
  expect(refreshedTokens.user).toBeTruthy();
  await expect(page).not.toHaveURL(/#\/login$/);
});