import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..");
const scriptPath = join(root, "tools", "bankr-agent-smoke.mjs");

describe("Bankr agent smoke", () => {
  test("skips when BANKR_API_KEY is missing", async () => {
    const result = await runSmoke([], { BANKR_API_KEY: undefined });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      reason: "BANKR_API_KEY is not set",
      status: "skip",
      type: "dev.nipmod.bankr-agent-smoke.v1"
    });
  });

  test("fails when auth is required and BANKR_API_KEY is missing", async () => {
    const result = await runSmoke(["--require-auth"], { BANKR_API_KEY: undefined });
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      reason: "BANKR_API_KEY is not set",
      status: "fail"
    });
  });

  test("passes against the Bankr Agent API job contract", async () => {
    const server = await createMockBankrApi();
    try {
      const result = await runSmoke([], {
        BANKR_AGENT_SMOKE_POLL_MS: "5",
        BANKR_API_KEY: "bk_test_key",
        BANKR_API_URL: server.url
      });
      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload).toMatchObject({
        jobId: "job_test",
        ok: true,
        status: "pass",
        threadId: "thread_test",
        type: "dev.nipmod.bankr-agent-smoke.v1"
      });
      expect(payload.responsePreview).toContain("skillRead");
      expect(server.seenPrompt).toContain("Do not trade");
      expect(server.seenApiKey).toBe("bk_test_key");
    } finally {
      await server.close();
    }
  });
});

function runSmoke(args = [], envPatch = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    for (const [key, value] of Object.entries(envPatch)) {
      if (value === undefined) {
        delete env[key];
      } else {
        env[key] = value;
      }
    }
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: root,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stderr, stdout });
    });
  });
}

function createMockBankrApi() {
  let seenPrompt = "";
  let seenApiKey = "";
  const server = createServer(async (request, response) => {
    seenApiKey = String(request.headers["x-api-key"] ?? "");
    if (request.method === "POST" && request.url === "/agent/prompt") {
      const body = await readRequest(request);
      seenPrompt = JSON.parse(body).prompt;
      responseJson(response, {
        jobId: "job_test",
        threadId: "thread_test"
      });
      return;
    }
    if (request.method === "GET" && request.url === "/agent/job/job_test") {
      responseJson(response, {
        response: JSON.stringify({
          installPlanReady: true,
          packageFound: "gitlawb-repo-reader 0.1.0",
          safety: ["no wallet action"],
          skillRead: true,
          trustChecked: true
        }),
        status: "completed"
      });
      return;
    }
    response.writeHead(404);
    response.end();
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        close: () => new Promise((closeResolve) => server.close(closeResolve)),
        get seenApiKey() {
          return seenApiKey;
        },
        get seenPrompt() {
          return seenPrompt;
        },
        url: `http://127.0.0.1:${address.port}`
      });
    });
  });
}

function readRequest(request) {
  return new Promise((resolve) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
  });
}

function responseJson(response, payload) {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}
