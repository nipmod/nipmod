#!/usr/bin/env node
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { runAlertCycle } from "./prod-alert-runner.mjs";

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_PORT = 8080;

export async function startMonitorServer({
  intervalMs = numberFromEnv(process.env.NIPMOD_MONITOR_INTERVAL_MS, DEFAULT_INTERVAL_MS),
  port = numberFromEnv(process.env.PORT, DEFAULT_PORT),
  runAlertCycleFn = runAlertCycle
} = {}) {
  const state = {
    intervalMs,
    lastError: null,
    lastRunAt: null,
    lastCycle: null,
    runs: 0,
    startedAt: new Date().toISOString()
  };
  let closed = false;
  let running = false;
  let timer = null;

  const runOnce = async () => {
    if (closed || running) {
      return;
    }
    running = true;
    try {
      const cycle = await runAlertCycleFn();
      state.lastCycle = cycle;
      state.lastError = null;
      state.lastRunAt = new Date().toISOString();
      state.runs += 1;
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      state.lastRunAt = new Date().toISOString();
      state.runs += 1;
    } finally {
      running = false;
    }
  };

  const server = createServer((request, response) => {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method not allowed", ok: false });
      return;
    }

    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/health") {
      const health = healthPayload(state, running);
      sendJson(response, health.ok ? 200 : 503, health);
      return;
    }

    if (url.pathname === "/last") {
      if (!state.lastCycle) {
        sendJson(response, 404, { error: "no completed monitor cycle yet", ok: false });
        return;
      }
      sendJson(response, redactedCycle(state.lastCycle));
      return;
    }

    sendJson(response, 404, { error: "not found", ok: false });
  });

  await listen(server, port);
  timer = setInterval(runOnce, intervalMs);
  timer.unref?.();
  void runOnce();

  return {
    close: async () => {
      closed = true;
      if (timer) {
        clearInterval(timer);
      }
      await close(server);
    },
    state,
    url: serverUrl(server)
  };
}

function redactedCycle(cycle) {
  return {
    checkedAt: cycle.checkedAt,
    deliverySummary: cycle.deliverySummary,
    formatVersion: 1,
    mode: cycle.mode,
    ok: cycle.ok,
    status: cycle.status,
    summary: cycle.summary,
    type: "dev.nipmod.monitor-last-public.v1"
  };
}

function healthPayload(state, running) {
  const lastStatus = state.lastCycle?.status ?? (state.lastError ? "error" : null);
  const stale = isMonitorStale(state);
  const ok = state.lastError === null && stale === false && (state.lastCycle?.ok ?? true) === true;
  return {
    intervalMs: state.intervalMs,
    lastError: state.lastError,
    lastRunAt: state.lastRunAt,
    lastStatus,
    ok,
    running,
    runs: state.runs,
    stale,
    startedAt: state.startedAt,
    type: "dev.nipmod.monitor-health.v1"
  };
}

function isMonitorStale(state) {
  const maxAgeMs = state.intervalMs * 2;
  const reference = state.lastRunAt ?? state.startedAt;
  const timestamp = Date.parse(reference);
  if (!Number.isFinite(timestamp)) {
    return true;
  }
  return Date.now() - timestamp > maxAgeMs;
}

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function sendJson(response, statusOrPayload, payload) {
  const status = typeof statusOrPayload === "number" ? statusOrPayload : 200;
  const body = payload ?? statusOrPayload;
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function serverUrl(server) {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("monitor server is not listening on a TCP port");
  }
  return `http://127.0.0.1:${address.port}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startMonitorServer();
  console.log(`nipmod monitor listening on ${server.url}`);
}
