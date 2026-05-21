import { describe, expect, test } from "vitest";
import { handleAlertSinkPost } from "../lib/alert-sink";

const validAlert = {
  formatVersion: 1,
  generatedAt: "2026-05-16T16:40:00.000Z",
  runId: "probe-run",
  severity: "info",
  status: "probe",
  summary: {
    failedChecks: 0,
    suites: 2,
    totalChecks: 18
  },
  suites: [],
  title: "nipmod alert delivery probe",
  type: "dev.nipmod.production-alert.v1"
};

describe("alert sink route handler", () => {
  test("accepts signed probe alerts for known channels", async () => {
    const response = await handleAlertSinkPost(request(validAlert, "secret-token"), {
      channel: "primary",
      token: "secret-token\n"
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      channel: "primary",
      ok: true,
      type: "dev.nipmod.alert-sink.ack.v1"
    });
  });

  test("rejects missing or wrong bearer token", async () => {
    const missing = await handleAlertSinkPost(request(validAlert), {
      channel: "primary",
      token: "secret-token"
    });
    const wrong = await handleAlertSinkPost(request(validAlert, "wrong"), {
      channel: "secondary",
      token: "secret-token"
    });

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
  });

  test("rejects unknown channels and malformed alert payloads", async () => {
    const badChannel = await handleAlertSinkPost(request(validAlert, "secret-token"), {
      channel: "debug",
      token: "secret-token"
    });
    const badPayload = await handleAlertSinkPost(request({ ...validAlert, type: "other" }, "secret-token"), {
      channel: "primary",
      token: "secret-token"
    });

    expect(badChannel.status).toBe(404);
    expect(badPayload.status).toBe(400);
  });

  test("rejects oversized alert payloads before parsing", async () => {
    const response = await handleAlertSinkPost(
      new Request("https://nipmod.com/api/alerts/primary", {
        body: JSON.stringify({ ...validAlert, padding: "x".repeat(70_000) }),
        headers: {
          authorization: "Bearer secret-token",
          "content-type": "application/json"
        },
        method: "POST"
      }),
      {
        channel: "primary",
        token: "secret-token"
      }
    );

    expect(response.status).toBe(413);
  });
});

function request(payload: unknown, token?: string): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return new Request("https://nipmod.com/api/alerts/primary", {
    body: JSON.stringify(payload),
    headers,
    method: "POST"
  });
}
