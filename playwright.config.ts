import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
  },
  webServer: [
    {
      command:
        'AUTH_DISABLED=true BRD_PROVIDER=mock BRD_CORS_ORIGINS=http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:5173,http://localhost:5173 apps/api/.venv/bin/python -m uvicorn app.main:app --app-dir apps/api --host 127.0.0.1 --port 18000',
      url: 'http://127.0.0.1:18000/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command:
        'VITE_BRD_API_URL=http://127.0.0.1:18000 npm run dev:ui -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
