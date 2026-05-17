#!/usr/bin/env node
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createPackagePatch, repoFromGitlawbSource, runScoutCycle } from "./scout-agent.mjs";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_PORT = 8080;

export async function startScoutServer({
  intervalMs = numberFromEnv(process.env.NIPMOD_SCOUT_INTERVAL_MS, DEFAULT_INTERVAL_MS),
  port = numberFromEnv(process.env.PORT, DEFAULT_PORT),
  publicOrigin = process.env.NIPMOD_SCOUT_PUBLIC_URL,
  runToken = process.env.NIPMOD_SCOUT_RUN_TOKEN,
  runScoutCycleFn = runScoutCycle
} = {}) {
  const state = {
    intervalMs,
    lastCycle: null,
    lastError: null,
    lastRunAt: null,
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
      const cycle = await runScoutCycleFn();
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
    if (!["GET", "POST"].includes(request.method ?? "")) {
      sendJson(response, 405, { error: "method not allowed", ok: false });
      return;
    }

    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/health") {
      const health = healthPayload(state, running);
      sendJson(response, health.ok ? 200 : 503, health);
      return;
    }

    if (request.method === "GET" && url.pathname === "/last") {
      if (!state.lastCycle) {
        sendJson(response, 404, { error: "no completed scout cycle yet", ok: false });
        return;
      }
      sendJson(response, publicLastCycle(state.lastCycle));
      return;
    }

    if (request.method === "GET" && url.pathname === "/candidates") {
      if (!state.lastCycle) {
        sendJson(response, 404, { error: "no completed scout cycle yet", ok: false });
        return;
      }
      sendJson(response, {
        candidates: absolutizeCandidates(state.lastCycle.candidates ?? [], configuredOrigin(publicOrigin, request)),
        formatVersion: 1,
        generatedAt: state.lastCycle.generatedAt,
        ok: true,
        summary: state.lastCycle.summary,
        type: "dev.nipmod.scout-candidates.v1"
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/drafts") {
      if (!state.lastCycle) {
        sendJson(response, 404, { error: "no completed scout cycle yet", ok: false });
        return;
      }
      sendJson(response, {
        drafts: state.lastCycle.drafts ?? [],
        formatVersion: 1,
        generatedAt: state.lastCycle.generatedAt,
        ok: true,
        summary: state.lastCycle.summary,
        type: "dev.nipmod.scout-drafts.v1"
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/draft") {
      try {
        const source = repoFromGitlawbSource(url.searchParams.get("repo"));
        const draft = draftFromCycle(state.lastCycle, `gitlawb://${source.owner_did}/${source.name}`);
        if (!draft) {
          sendJson(response, 404, { error: "repo is not a current Scout draft", ok: false });
          return;
        }
        sendJson(response, draft);
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : String(error), ok: false });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/patch") {
      try {
        const repo = repoFromGitlawbSource(url.searchParams.get("repo"));
        sendJson(response, createPackagePatch(repo));
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : String(error), ok: false });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/run") {
      if (!runToken || request.headers.authorization !== `Bearer ${runToken}`) {
        sendJson(response, 403, { error: "manual scout run is not authorized", ok: false });
        return;
      }
      void runOnce();
      sendJson(response, { ok: true, running: true, type: "dev.nipmod.scout-run-request.v1" });
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

function publicLastCycle(cycle) {
  return {
    claimIndex: cycle.claimIndex,
    draftCount: cycle.drafts?.length ?? 0,
    formatVersion: 1,
    generatedAt: cycle.generatedAt,
    node: cycle.node,
    ok: cycle.ok,
    summary: cycle.summary,
    type: "dev.nipmod.scout-last-public.v1"
  };
}

function absolutizeCandidates(candidates, origin) {
  return candidates.map((candidate) => ({
    ...candidate,
    draft: candidate.draft
      ? {
          ...candidate.draft,
          endpoint: absolutizeUrl(candidate.draft.endpoint, origin)
        }
      : candidate.draft,
    patch: candidate.patch
      ? {
          ...candidate.patch,
          endpoint: absolutizeUrl(candidate.patch.endpoint, origin)
        }
      : candidate.patch
  }));
}

function absolutizeUrl(value, origin) {
  if (typeof value !== "string" || value.length === 0 || /^https?:\/\//.test(value)) {
    return value;
  }
  return `${origin}${value.startsWith("/") ? "" : "/"}${value}`;
}

function draftFromCycle(cycle, source) {
  return cycle?.drafts?.find((draft) => draft.source === source) ?? null;
}

function configuredOrigin(publicOrigin, request) {
  if (typeof publicOrigin === "string" && publicOrigin.trim()) {
    return trimTrailingSlash(publicOrigin.trim());
  }
  return requestOrigin(request);
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function requestOrigin(request) {
  const host = request.headers.host ?? `127.0.0.1:${DEFAULT_PORT}`;
  return `http://${host}`;
}

function healthPayload(state, running) {
  const stale = isScoutStale(state);
  const lastOk = state.lastCycle?.ok ?? true;
  const ok = state.lastError === null && stale === false && lastOk === true;
  return {
    intervalMs: state.intervalMs,
    lastError: state.lastError,
    lastRunAt: state.lastRunAt,
    ok,
    running,
    runs: state.runs,
    stale,
    startedAt: state.startedAt,
    summary: state.lastCycle?.summary ?? null,
    type: "dev.nipmod.scout-health.v1"
  };
}

function isScoutStale(state) {
  if (!state.lastRunAt) {
    return false;
  }
  const maxAgeMs = state.intervalMs * 2;
  const timestamp = Date.parse(state.lastRunAt);
  if (!Number.isFinite(timestamp)) {
    return true;
  }
  return Date.now() - timestamp > maxAgeMs;
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
    throw new Error("scout server is not listening on a TCP port");
  }
  return `http://127.0.0.1:${address.port}`;
}

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startScoutServer();
  console.log(`nipmod scout listening on ${server.url}`);
}
