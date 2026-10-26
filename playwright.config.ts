import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  timeout: 120000,
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:4190",
    ...devices["Desktop Chrome"],
    channel: process.env.CI ? undefined : "msedge",
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4190 --strictPort",
    url: "http://127.0.0.1:4190",
    reuseExistingServer: true,
  },
  projects: [
    { name: "desktop" },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
