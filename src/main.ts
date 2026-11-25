import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

const legacyResetPasswordPath = window.location.pathname.match(/^(.*)\/reset-password\/?$/);
if (legacyResetPasswordPath && !window.location.hash) {
  const basePath = `${legacyResetPasswordPath[1] || ''}/`;
  window.history.replaceState(null, '', `${basePath}#/reset-password${window.location.search}`);
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
