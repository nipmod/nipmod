import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";
import { scryptSync } from "node:crypto";

const e2ePort = process.env.NIPMOD_E2E_PORT ?? "3000";
const e2eBaseURL = process.env.NIPMOD_E2E_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;
const e2eApiKey = process.env.NIPMOD_E2E_API_KEY ?? "nka_e2e_beta_route_key_1234567890";
const e2eHashSecret = process.env.NIPMOD_API_KEY_HASH_SECRET ?? "nipmod-e2e-api-key-secret";
const e2eApiKeyHash = scryptSync(e2eApiKey, e2eHashSecret, 32).toString("hex");

process.env.NIPMOD_E2E_API_KEY = e2eApiKey;

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
    env: {
      ...process.env,
      NIPMOD_API_KEY_HASH_SECRET: e2eHashSecret,
      NIPMOD_API_KEY_HASHES: process.env.NIPMOD_API_KEY_HASHES ?? `e2e:beta:${e2eApiKeyHash}`
    },
    reuseExistingServer: process.env.NIPMOD_E2E_REUSE_SERVER === "1",
    timeout: 120_000,
    url: e2eBaseURL
  };
}

export default defineConfig(config);
