import { defineConfig, devices } from "@playwright/test";

// Not 3000: other local tools often use it, and we must never test against the wrong app.
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      // Our main user is on a mid-range Android phone.
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  // No webServer here: `npm run test:e2e` (scripts/e2e.mjs) builds, starts and stops the app.
});
