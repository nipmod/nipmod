#!/usr/bin/env node
import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { runWitnessWorker } from "./witness-worker.mjs";

const DEFAULT_OUTPUT_PATH = process.env.NIPMOD_WITNESS_STATEMENTS_PATH ?? "/data/witness-statements.json";
const DEFAULT_STATE_PATH = process.env.NIPMOD_WITNESS_STATE_PATH ?? "/data/witness-worker-state.json";
const DEFAULT_IDENTITY_PATH = process.env.NIPMOD_WITNESS_IDENTITY_PATH ?? "/data/transparency-witness-identity.json";

export function createWitnessServer(options = {}) {
  const outputPath = options.outputPath ?? DEFAULT_OUTPUT_PATH;
  const statePath = options.statePath ?? DEFAULT_STATE_PATH;
  const identityPath = options.identityPath ?? DEFAULT_IDENTITY_PATH;
  const intervalMs = options.intervalMs ?? Number(process.env.NIPMOD_WITNESS_INTERVAL_MS ?? "300000");
  const bootstrap = options.bootstrap ?? process.env.NIPMOD_WITNESS_BOOTSTRAP === "1";
  const runToken = options.runToken ?? process.env.NIPMOD_WITNESS_RUN_TOKEN ?? "";
  const allowUnauthenticatedRun = options.allowUnauthenticatedRun === true;
  const status = {
    lastError: null,
    lastRunAt: null,
    lastWitness: null,
    running: false
  };

  async function hydratePersistedWitness() {
    if (status.lastWitness) {
      return;
    }
    try {
      const payload = JSON.parse(await readFile(outputPath, "utf8"));
      const statement = payload?.statements?.[0];
      const treeHead = statement?.treeHead;
      if (
        payload?.type === "dev.nipmod.transparency.witness-statements.v1" &&
        typeof statement?.witness === "string" &&
        typeof treeHead?.rootHash === "string" &&
        Number.isSafeInteger(treeHead.treeSize)
      ) {
        status.lastWitness = {
          rootHash: treeHead.rootHash,
          treeSize: treeHead.treeSize,
          witness: statement.witness
        };
      }
    } catch {
      // Existing statements are an availability fallback only.
    }
  }

  async function runOnce() {
    if (status.running) {
      return status;
    }
    status.running = true;
    status.lastRunAt = new Date().toISOString();
    try {
      const result = await runWitnessWorker({
        allowedLogIds: options.allowedLogIds,
        bootstrap,
        fetchFn: options.fetchFn,
        identity: options.identity,
        identityPath,
        log: options.log,
        logSource: options.logSource,
        outputPath,
        registryUrl: options.registryUrl,
        request: options.request,
        requestSource: options.requestSource,
        state: options.state,
        statePath,
        transparency: options.transparency
      });
      status.lastError = null;
      status.lastWitness = {
        rootHash: result.payload.statements[0]?.treeHead.rootHash ?? null,
        treeSize: result.payload.statements[0]?.treeHead.treeSize ?? null,
        witness: result.payload.statements[0]?.witness ?? null
      };
    } catch (error) {
      status.lastError = error instanceof Error ? error.message : "unknown witness worker error";
    } finally {
      status.running = false;
    }
    return status;
  }

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/health") {
      await hydratePersistedWitness();
      const healthy = Boolean(status.lastWitness);
      return sendJson(response, healthy ? 200 : 503, {
        ok: healthy,
        ...status
      });
    }
    if (url.pathname === "/run" && request.method === "POST") {
      if (!allowUnauthenticatedRun) {
        const authorization = authorizeRun(request, runToken);
        if (!authorization.ok) {
          return sendJson(response, authorization.status, { error: authorization.error });
        }
      }
      await runOnce();
      return sendJson(response, status.lastError ? 500 : 200, {
        ok: !status.lastError,
        ...status
      });
    }
    if (url.pathname === "/witness-statements.json") {
      try {
        const payload = await readFile(outputPath, "utf8");
        response.writeHead(200, {
          "cache-control": "no-store",
          "content-type": "application/json; charset=utf-8"
        });
        response.end(payload);
      } catch (error) {
        if (error?.code === "ENOENT") {
          return sendJson(response, 404, { error: "witness statements not available" });
        }
        return sendJson(response, 500, { error: "failed to read witness statements" });
      }
      return;
    }
    sendJson(response, 404, { error: "not found" });
  });

  let timer = null;
  return {
    runOnce,
    server,
    start(port = Number(process.env.PORT ?? "8080"), host = process.env.HOST ?? "0.0.0.0") {
      server.listen(port, host);
      hydratePersistedWitness().then(runOnce, runOnce);
      if (Number.isFinite(intervalMs) && intervalMs > 0) {
        timer = setInterval(runOnce, intervalMs);
        timer.unref?.();
      }
      return server;
    },
    stop() {
      if (timer) {
        clearInterval(timer);
      }
      server.close();
    }
  };
}

function authorizeRun(request, token) {
  if (!token) {
    return { error: "manual run authorization is not configured", ok: false, status: 503 };
  }
  const header = request.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) {
    return { error: "missing run authorization", ok: false, status: 401 };
  }
  if (!isEqualToken(header.slice("Bearer ".length), token)) {
    return { error: "invalid run authorization", ok: false, status: 403 };
  }
  return { ok: true };
}

function isEqualToken(actual, expected) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8"
  });
  response.end(`${JSON.stringify(body)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createWitnessServer().start();
}
