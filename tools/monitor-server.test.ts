import { describe, expect, test } from "vitest";
import { startMonitorServer } from "./monitor-server.ts";

describe("production monitor server", () => {
  test("runs alert cycles on start and interval", async () => {
    let runs = 0;
    const server = await startMonitorServer({
      intervalMs: 25,
      port: 0,
      runAlertCycleFn: async () => healthyCycle(++runs)
    });

    try {
      await waitFor(async () => (await fetchJson(`${server.url}/health`)).runs >= 2);
      const health = await fetchJson(`${server.url}/health`);
      const last = await fetchJson(`${server.url}/last`);

      expect(health).toMatchObject({
        ok: true,
        intervalMs: 25
      });
      expect(health.runs).toBeGreaterThanOrEqual(2);
      expect(health.lastRunAt).toEqual(expect.any(String));
      expect((await fetch(`${server.url}/health`)).status).toBe(200);
      expect(last).toMatchObject({
        ok: true,
        status: "healthy",
        type: "dev.nipmod.monitor-last-public.v1"
      });
      expect(last.runId).toBeUndefined();
      expect(last.suites).toBeUndefined();
    } finally {
      await server.close();
    }
  });

  test("reports unhealthy when the latest cycle fails", async () => {
    const server = await startMonitorServer({
      intervalMs: 1_000,
      port: 0,
      runAlertCycleFn: async () => ({
        ...healthyCycle(1),
        ok: false,
        status: "firing"
      })
    });

    try {
      await waitFor(async () => (await fetchJson(`${server.url}/health`)).runs === 1);
      const health = await fetchJson(`${server.url}/health`);
      const healthResponse = await fetch(`${server.url}/health`);

      expect(health).toMatchObject({
        lastStatus: "firing",
        ok: false,
        runs: 1
      });
      expect(healthResponse.status).toBe(503);
    } finally {
      await server.close();
    }
  });

  test("reports unhealthy when the latest cycle is stale", async () => {
    const server = await startMonitorServer({
      intervalMs: 1_000,
      port: 0,
      runAlertCycleFn: async () => healthyCycle(1)
    });

    try {
      await waitFor(async () => (await fetchJson(`${server.url}/health`)).runs === 1);
      server.state.lastRunAt = new Date(Date.now() - 3_000).toISOString();
      const response = await fetch(`${server.url}/health`);
      const health = await response.json();

      expect(response.status).toBe(503);
      expect(health.ok).toBe(false);
      expect(health.stale).toBe(true);
    } finally {
      await server.close();
    }
  });
});

function healthyCycle(run) {
  return {
    alertAttempted: false,
    alertSent: false,
    alertTriggered: false,
    checkedAt: new Date(1_776_444_800_000 + run).toISOString(),
    deliveries: [],
    deliverySummary: { failed: 0, sent: 0, total: 0 },
    formatVersion: 1,
    mode: "normal",
    ok: true,
    runId: `run-${run}`,
    status: "healthy",
    summary: {
      failedChecks: 0,
      suites: 2,
      totalChecks: 18
    },
    suites: [],
    type: "dev.nipmod.alert-delivery.v1"
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  return response.json();
}

async function waitFor(predicate) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for condition");
}
