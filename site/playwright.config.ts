import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] }
    }
  ],
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.NIPMOD_E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure"
  },
  workers: 1
};

if (!process.env.NIPMOD_E2E_BASE_URL) {
  config.webServer = {
    command: "pnpm dev --hostname 127.0.0.1 --port 3000",
    reuseExistingServer: process.env.NIPMOD_E2E_REUSE_SERVER === "1",
    timeout: 120_000,
    url: "http://127.0.0.1:3000"
  };
}

export default defineConfig(config);
