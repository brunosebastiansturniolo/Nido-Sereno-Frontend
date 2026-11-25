import { expect, test } from '@playwright/test';

test('navigates between login and registration', async ({ page }) => {
  await page.goto('/#/login');

  await expect(page.getByRole('heading', { name: /Nido Sereno/ })).toBeVisible();
  await expect(page.getByPlaceholder('tu@email.com')).toBeVisible();
  await page.getByRole('link', { name: 'Registrate' }).click();

  await expect(page).toHaveURL(/#\/register$/);
  await expect(page.getByText('Creá tu cuenta')).toBeVisible();
  await expect(page.getByPlaceholder('Juan')).toBeVisible();
});