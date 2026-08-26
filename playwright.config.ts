import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3210);

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    // WebGL im Headless-Chromium: ohne Software-Rasterizer bleibt die Karte leer.
    launchOptions: {
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
      // Umgebungen mit vorinstalliertem Chromium (CI-Images, Container) setzen
      // PLAYWRIGHT_CHROMIUM_PATH; lokal löst Playwright seinen eigenen Browser auf.
      ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
        : {}),
    },
  },
  /*
   * Zwei Breiten, weil die App mobile first gebaut ist und sich ab `sm:`
   * anders verhält: das Kontextblatt wechselt vom Bottom-Sheet zur Spalte
   * rechts, und damit ändert sich der frei sichtbare Teil der Karte — die
   * Grundlage der Kameraentscheidung.
   */
  projects: [
    { name: 'mobil', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
});
