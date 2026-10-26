import { defineConfig, devices } from "@playwright/test";
const port = process.env.CHESSLENS_TEST_PORT || "4190";
export default defineConfig({
  timeout: 120000,
  testDir: "./e2e",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...devices["Desktop Chrome"],
    channel: process.env.CI
      ? undefined
      : process.env.CHESSLENS_TEST_BROWSER || "msedge",
  },
  webServer: process.env.CHESSLENS_TEST_SKIP_SERVER
    ? undefined
    : {
        command: `npm run build && npm run preview -- --port ${port} --strictPort`,
        url: `http://127.0.0.1:${port}`,
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
