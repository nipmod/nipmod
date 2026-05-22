import { describe, expect, test } from "vitest";
import { runAlertCycle } from "./prod-alert-runner.ts";

const now = Date.parse("2026-05-16T14:00:00.000Z");

describe("production alert runner", () => {
  test("does not send alerts for a healthy cycle by default", async () => {
    const deliveries = [];
    const result = await runAlertCycle({
      destinations: ["https://alerts.example.test/primary"],
      fetchFn: recordDeliveries(deliveries),
      now,
      restoreDrillFn: async () => healthySuite("dev.nipmod.restore-drill.v1", "restore"),
      syntheticMonitorFn: async () => healthySuite("dev.nipmod.prod-synthetic-monitor.v1", "monitor")
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("healthy");
    expect(result.alertTriggered).toBe(false);
    expect(result.alertAttempted).toBe(false);
    expect(result.alertSent).toBe(false);
    expect(deliveries).toHaveLength(0);
  });

  test("sends a firing alert to every configured destination when a production check fails", async () => {
    const deliveries = [];
    const result = await runAlertCycle({
      destinations: ["https://alerts.example.test/primary", "https://alerts.example.test/secondary"],
      fetchFn: recordDeliveries(deliveries),
      now,
      restoreDrillFn: async () => healthySuite("dev.nipmod.restore-drill.v1", "restore"),
      syntheticMonitorFn: async () => failedSuite("dev.nipmod.prod-synthetic-monitor.v1", "monitor", "node_health", "node down")
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("firing");
    expect(result.alertTriggered).toBe(true);
    expect(result.alertAttempted).toBe(true);
    expect(result.alertSent).toBe(true);
    expect(result.deliveries).toHaveLength(2);
    expect(result.deliveries.every((delivery) => delivery.status === "sent")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("alerts.example.test");
    expect(deliveries).toHaveLength(2);
    expect(deliveries[0].payload).toMatchObject({
      severity: "critical",
      status: "firing",
      title: "nipmod production checks failed",
      type: "dev.nipmod.production-alert.v1"
    });
    expect(deliveries[0].payload.suites[0].failures).toEqual([
      {
        error: "node down",
        name: "node_health",
        status: "fail"
      }
    ]);
  });

  test("probe mode proves alert delivery even when production checks are healthy", async () => {
    const deliveries = [];
    const result = await runAlertCycle({
      destinations: ["https://alerts.example.test/primary"],
      fetchFn: recordDeliveries(deliveries),
      mode: "probe",
      now,
      restoreDrillFn: async () => healthySuite("dev.nipmod.restore-drill.v1", "restore"),
      syntheticMonitorFn: async () => healthySuite("dev.nipmod.prod-synthetic-monitor.v1", "monitor")
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("probe");
    expect(result.alertTriggered).toBe(true);
    expect(result.alertAttempted).toBe(true);
    expect(result.alertSent).toBe(true);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].payload).toMatchObject({
      severity: "info",
      status: "probe",
      title: "nipmod alert delivery probe"
    });
  });

  test("sends an optional bearer token without leaking it in results", async () => {
    const deliveries = [];
    const result = await runAlertCycle({
      bearerToken: "alert-secret-token",
      destinations: ["https://alerts.example.test/primary"],
      fetchFn: recordDeliveries(deliveries),
      mode: "probe",
      now,
      restoreDrillFn: async () => healthySuite("dev.nipmod.restore-drill.v1", "restore"),
      syntheticMonitorFn: async () => healthySuite("dev.nipmod.prod-synthetic-monitor.v1", "monitor")
    });

    expect(result.ok).toBe(true);
    expect(deliveries[0].headers).toMatchObject({
      authorization: "Bearer alert-secret-token"
    });
    expect(JSON.stringify(result)).not.toContain("alert-secret-token");
    expect(JSON.stringify(result)).not.toContain("alerts.example.test");
  });

  test("uses destination specific bearer tokens without leaking them", async () => {
    const deliveries = [];
    const result = await runAlertCycle({
      bearerToken: "fallback-token",
      destinations: [
        { bearerToken: "primary-token", url: "https://alerts.example.test/primary" },
        { bearerToken: "secondary-token", url: "https://alerts.example.test/secondary" }
      ],
      fetchFn: recordDeliveries(deliveries),
      mode: "probe",
      now,
      restoreDrillFn: async () => healthySuite("dev.nipmod.restore-drill.v1", "restore"),
      syntheticMonitorFn: async () => healthySuite("dev.nipmod.prod-synthetic-monitor.v1", "monitor")
    });

    expect(result.ok).toBe(true);
    expect(deliveries.map((delivery) => delivery.headers.authorization)).toEqual([
      "Bearer primary-token",
      "Bearer secondary-token"
    ]);
    expect(JSON.stringify(result)).not.toContain("primary-token");
    expect(JSON.stringify(result)).not.toContain("secondary-token");
  });

  test("fails closed when a firing alert has no configured destinations", async () => {
    const result = await runAlertCycle({
      destinations: [],
      fetchFn: recordDeliveries([]),
      now,
      restoreDrillFn: async () => healthySuite("dev.nipmod.restore-drill.v1", "restore"),
      syntheticMonitorFn: async () => failedSuite("dev.nipmod.prod-synthetic-monitor.v1", "monitor", "registry_verified", "bad registry")
    });

    expect(result.ok).toBe(false);
    expect(result.alertTriggered).toBe(true);
    expect(result.alertAttempted).toBe(false);
    expect(result.alertSent).toBe(false);
    expect(result.deliverySummary).toEqual({ failed: 1, sent: 0, total: 1 });
    expect(result.deliveries[0]).toMatchObject({
      error: "no alert destinations configured",
      status: "failed"
    });
  });

  test("fails closed when an alert destination rejects delivery", async () => {
    const result = await runAlertCycle({
      destinations: ["https://alerts.example.test/primary"],
      fetchFn: async () => jsonResponse({ ok: false }, 503),
      mode: "probe",
      now,
      restoreDrillFn: async () => healthySuite("dev.nipmod.restore-drill.v1", "restore"),
      syntheticMonitorFn: async () => healthySuite("dev.nipmod.prod-synthetic-monitor.v1", "monitor")
    });

    expect(result.ok).toBe(false);
    expect(result.alertTriggered).toBe(true);
    expect(result.alertAttempted).toBe(true);
    expect(result.alertSent).toBe(false);
    expect(result.deliveries[0]).toMatchObject({
      error: "alert destination returned 503",
      status: "failed"
    });
    expect(JSON.stringify(result)).not.toContain("alerts.example.test");
  });

  test("turns monitor exceptions into firing alerts", async () => {
    const deliveries = [];
    const result = await runAlertCycle({
      destinations: ["https://alerts.example.test/primary"],
      fetchFn: recordDeliveries(deliveries),
      now,
      restoreDrillFn: async () => healthySuite("dev.nipmod.restore-drill.v1", "restore"),
      syntheticMonitorFn: async () => {
        throw new Error("monitor timed out");
      }
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("firing");
    expect(deliveries[0].payload.suites[0]).toMatchObject({
      name: "synthetic_monitor",
      ok: false
    });
    expect(deliveries[0].payload.suites[0].failures[0]).toMatchObject({
      error: "monitor timed out",
      name: "runner"
    });
  });
});

function healthySuite(type, name) {
  return {
    checkedAt: new Date(now).toISOString(),
    checks: [{ name: `${name}_ok`, status: "pass" }],
    ok: true,
    summary: { fail: 0, pass: 1, total: 1 },
    type
  };
}

function failedSuite(type, name, checkName, error) {
  return {
    checkedAt: new Date(now).toISOString(),
    checks: [
      { name: `${name}_ok`, status: "pass" },
      { error, name: checkName, status: "fail" }
    ],
    ok: false,
    summary: { fail: 1, pass: 1, total: 2 },
    type
  };
}

function recordDeliveries(deliveries) {
  return async (url, init) => {
    deliveries.push({
      headers: init.headers,
      payload: JSON.parse(init.body),
      url
    });
    return jsonResponse({ ok: true });
  };
}

function jsonResponse(payload, status = 200) {
  return {
    json: async () => payload,
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload)
  };
}
