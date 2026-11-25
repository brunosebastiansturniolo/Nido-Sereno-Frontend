# NidoSereno

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.2.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

Playwright usa el Google Chrome estable instalado y levanta Angular automáticamente. El smoke test no necesita backend:

```bash
npm run test:e2e
```

Para ver el navegador realizar el smoke test:

```bash
npm run test:e2e:headed
```

Para correr el recorrido E2E completo contra el backend local, PostgreSQL descartable y MailDev:

```bash
npm run test:e2e:local
```

El comando recrea los servicios E2E antes de cada ejecución, inicia el backend con el perfil `e2e` y levanta Angular. El test registra una cuenta, toma el código del buzón MailDev local, la activa, inicia sesión y completa el flujo complejo → departamento → reserva → check-in → check-out y clasificación. No usa Neon, Brevo ni credenciales de producción.

Para ver ese recorrido en Chrome:

```bash
npm run test:e2e:local:headed
```

Los servicios E2E usan `4201` (Angular), `8081` (backend), `5434` (PostgreSQL), `1026` (SMTP) y `1081` (MailDev); no comparten los puertos ni el volumen del entorno de desarrollo. PostgreSQL usa `tmpfs` y el comando recrea los contenedores en cada corrida. Para retirarlos manualmente al terminar:

```bash
docker compose --project-name nido-sereno-e2e -f ../nido-sereno-main/docker-compose.e2e.yml down
```

Los reportes, trazas y resultados de Playwright se guardan en `test-results/` y están ignorados por Git.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
