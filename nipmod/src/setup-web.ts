import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { join } from "node:path";
import { cwd } from "node:process";
import { maskToken, saveCloudflareEnv, validateCloudflareToken, type CloudflareValidationResult } from "./cloudflare.js";

export type CloudflareValidation = (input: {
  accountId?: string;
  apiToken: string;
  zoneName: string;
}) => Promise<CloudflareValidationResult>;

export interface SetupServerOptions {
  envPath?: string;
  host?: string;
  port?: number;
  validateCloudflare?: CloudflareValidation;
}

export interface SetupServer {
  close: () => Promise<void>;
  envPath: string;
  server: Server;
  url: string;
}

interface CloudflareSetupRequest {
  accountId?: string;
  apiToken?: string;
  validate?: boolean;
  zoneName?: string;
}

export async function startSetupServer(options: SetupServerOptions = {}): Promise<SetupServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8788;
  const envPath = options.envPath ?? join(cwd(), ".env.local");
  const setupToken = randomBytes(24).toString("base64url");
  const validateCloudflare =
    options.validateCloudflare ??
    ((input) => {
      const credentials = {
        apiToken: input.apiToken,
        zoneName: input.zoneName
      };
      return validateCloudflareToken(input.accountId ? { ...credentials, accountId: input.accountId } : credentials);
    });

  const server = createServer(async (request, response) => {
    try {
      await routeRequest(request, response, envPath, validateCloudflare, setupToken);
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "unknown server error",
        ok: false
      });
    }
  });

  await listen(server, port, host);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("setup server did not bind to a TCP port");
  }

  return {
    close: () => closeServer(server),
    envPath,
    server,
    url: `http://${host}:${address.port}/?token=${encodeURIComponent(setupToken)}`
  };
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  envPath: string,
  validateCloudflare: CloudflareValidation,
  setupToken: string
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  if (request.method === "GET" && url.pathname === "/") {
    if (url.searchParams.get("token") !== setupToken) {
      sendJson(response, 403, { error: "setup token required", ok: false });
      return;
    }
    sendHtml(response, renderSetupPage(envPath, setupToken));
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/cloudflare") {
    if (!isAllowedBrowserPost(request, setupToken)) {
      sendJson(response, 403, { error: "setup token required", ok: false });
      return;
    }
    const body = await readJsonBody<CloudflareSetupRequest>(request);
    const apiToken = body.apiToken?.trim();
    const zoneName = body.zoneName?.trim().toLowerCase() || "nipmod.com";
    const accountId = body.accountId?.trim() || undefined;

    if (!apiToken) {
      sendJson(response, 400, { error: "Cloudflare API token is required", ok: false });
      return;
    }

    const validationInput = accountId ? { accountId, apiToken, zoneName } : { apiToken, zoneName };
    const validation = await validateCloudflare(validationInput);
    const saveInput = {
      apiToken,
      zoneName
    };
    const resolvedAccountId = validation?.accountId ?? accountId;
    const resolvedZoneId = validation?.zoneId;
    await saveCloudflareEnv(envPath, {
      ...saveInput,
      ...(resolvedAccountId ? { accountId: resolvedAccountId } : {}),
      ...(resolvedZoneId ? { zoneId: resolvedZoneId } : {})
    });

    sendJson(response, 200, {
      accountId: validation?.accountId ?? accountId,
      envPath,
      ok: true,
      token: maskToken(apiToken),
      tokenId: validation?.tokenId,
      zoneId: validation?.zoneId,
      zoneName
    });
    return;
  }

  sendJson(response, 404, { error: "not found", ok: false });
}

function renderSetupPage(envPath: string, setupToken: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>nipmod setup</title>
    <style>
      :root {
        color: #111827;
        background: #f7f8fb;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 32px;
      }
      main {
        width: min(720px, 100%);
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
        padding: 28px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 28px;
        line-height: 1.15;
        letter-spacing: 0;
      }
      p {
        margin: 0 0 20px;
        color: #4b5563;
        line-height: 1.5;
      }
      form {
        display: grid;
        gap: 16px;
      }
      label {
        display: grid;
        gap: 7px;
        font-size: 13px;
        font-weight: 650;
        color: #1f2937;
      }
      input {
        width: 100%;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        color: #111827;
        font: inherit;
        min-height: 42px;
        padding: 9px 11px;
      }
      input:focus {
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.16);
        outline: none;
      }
      .row {
        align-items: center;
        display: flex;
        gap: 10px;
      }
      .row input {
        width: 18px;
        min-height: 18px;
        padding: 0;
      }
      button {
        align-items: center;
        background: #111827;
        border: 0;
        border-radius: 6px;
        color: #ffffff;
        cursor: pointer;
        display: inline-flex;
        font: inherit;
        font-weight: 700;
        justify-content: center;
        min-height: 44px;
        padding: 0 16px;
        transition: transform 140ms ease, background 140ms ease;
      }
      button:hover { background: #0f172a; }
      button:active { transform: translateY(1px); }
      button:disabled { background: #9ca3af; cursor: not-allowed; transform: none; }
      code {
        background: #f3f4f6;
        border-radius: 4px;
        padding: 2px 5px;
      }
      .status {
        border-radius: 6px;
        display: none;
        line-height: 1.45;
        padding: 12px;
      }
      .status.ok {
        background: #ecfdf5;
        color: #065f46;
        display: block;
      }
      .status.error {
        background: #fef2f2;
        color: #991b1b;
        display: block;
      }
      @media (max-width: 520px) {
        body { padding: 16px; }
        main { padding: 20px; }
        h1 { font-size: 24px; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>nipmod Cloudflare setup</h1>
      <p>Stores DNS credentials locally in <code>${escapeHtml(envPath)}</code>. Nothing is sent to chat.</p>
      <form id="cloudflare-form">
        <label>
          Cloudflare API token
          <input name="apiToken" type="password" autocomplete="off" required />
        </label>
        <label>
          Zone
          <input name="zoneName" value="nipmod.com" required />
        </label>
        <label>
          Account ID
          <input name="accountId" placeholder="optional" />
        </label>
        <button type="submit">Save Cloudflare token</button>
        <div id="status" class="status" role="status"></div>
      </form>
    </main>
    <script>
      const form = document.querySelector("#cloudflare-form");
      const statusBox = document.querySelector("#status");
      const setupToken = "${setupToken}";
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button");
        button.disabled = true;
        statusBox.className = "status";
        statusBox.textContent = "";

        const data = Object.fromEntries(new FormData(form).entries());

        try {
          const response = await fetch("/api/cloudflare", {
            method: "POST",
            headers: { "content-type": "application/json", "x-nipmod-setup-token": setupToken },
            body: JSON.stringify(data)
          });
          const body = await response.json();
          if (!response.ok || !body.ok) throw new Error(body.error || "Save failed");
          statusBox.className = "status ok";
          statusBox.textContent = "Saved " + body.zoneName + " token " + body.token + " to local env.";
          form.apiToken.value = "";
        } catch (error) {
          statusBox.className = "status error";
          statusBox.textContent = error instanceof Error ? error.message : "Save failed";
        } finally {
          button.disabled = false;
        }
      });
    </script>
  </body>
</html>`;
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.byteLength;
    if (total > 8 * 1024) {
      throw new Error("request body is too large");
    }
    chunks.push(bytes);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function isAllowedBrowserPost(request: IncomingMessage, setupToken: string): boolean {
  if (request.headers["x-nipmod-setup-token"] !== setupToken) {
    return false;
  }
  if (!String(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
    return false;
  }
  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }
  const host = request.headers.host;
  return Boolean(host) && origin === `http://${host}`;
}

function sendHtml(response: ServerResponse, html: string): void {
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": "text/html; charset=utf-8"
  });
  response.end(html);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
