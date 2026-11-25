import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const localStack = process.env.PLAYWRIGHT_LOCAL_STACK === 'true';
const angularPort = localStack ? 4201 : 4200;
const angularHost = localStack ? 'localhost' : '127.0.0.1';
const angularServer = {
  command: `npm start -- --configuration=${localStack ? 'e2e' : 'development'} --host 127.0.0.1 --port ${angularPort}`,
  url: `http://${angularHost}:${angularPort}`,
  reuseExistingServer: !process.env.CI && !localStack,
  timeout: 120_000
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  testIgnore: localStack ? undefined : ['**/*.local.spec.ts'],
  reporter: 'list',
  outputDir: './test-results',
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    launchOptions: {
      slowMo: Number(process.env.PLAYWRIGHT_SLOW_MO ?? 0)
    },
    baseURL: `http://${angularHost}:${angularPort}`,
    trace: 'retain-on-failure'
  },
  webServer: localStack
    ? [
        angularServer,
        {
          command: './mvnw spring-boot:run',
          cwd: resolve(process.cwd(), '../nido-sereno-main'),
          url: 'http://127.0.0.1:8081/api/v1/v3/api-docs',
          reuseExistingServer: false,
          timeout: 180_000,
          env: {
            SPRING_PROFILES_ACTIVE: 'e2e',
            PORT: '8081'
          }
        }
      ]
    : angularServer
});