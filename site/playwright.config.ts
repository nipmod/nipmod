import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

const e2ePort = process.env.NIPMOD_E2E_PORT ?? "3000";
const e2eBaseURL = process.env.NIPMOD_E2E_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;

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
    baseURL: e2eBaseURL,
    trace: "retain-on-failure"
  },
  workers: 1
};

if (!process.env.NIPMOD_E2E_BASE_URL) {
  config.webServer = {
    command: `pnpm dev --hostname 127.0.0.1 --port ${e2ePort}`,
    reuseExistingServer: process.env.NIPMOD_E2E_REUSE_SERVER === "1",
    timeout: 120_000,
    url: e2eBaseURL
  };
}

export default defineConfig(config);
