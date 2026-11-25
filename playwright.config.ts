import { defineConfig, devices } from '@playwright/test'

const remote = process.env.BASE_URL

export default defineConfig({
  testDir: './e2e',
  reporter: 'line',
  use: { baseURL: remote ?? 'http://localhost:4173' },
  // Runs against `vite preview` (the production build), so e2e tests what Vercel ships.
  webServer: remote ? undefined : {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
  },
  // iPhone 13 as-is: WebKit, touch, 390x664 = Safari's visible area. Don't override the viewport.
  projects: [{ name: 'iphone', use: { ...devices['iPhone 13'] } }],
})
