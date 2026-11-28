import { expect, test } from '@playwright/test';

test('muestra el logo de Nido Sereno y carga su imagen', async ({ page }) => {
  await page.goto('/');

  const logo = page.locator('header img[src="nido-sereno-logo.svg"]');
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});