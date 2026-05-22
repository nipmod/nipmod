import { createServer } from "node:http";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const host = "127.0.0.1";
const port = Number(process.env.PORT || "8789");
const envPath = resolve(process.argv[2] || "nipmod/.env.local");

function normalizeToken(token) {
  return token
    .trim()
    .replace(/^DIGITALOCEAN_API_TOKEN\s*=\s*/i, "")
    .replace(/^Authorization\s*:\s*/i, "")
    .replace(/^Bearer\s+/i, "")
    .replace(/^["'`]|["'`]$/g, "")
    .trim();
}

function maskToken(token) {
  return token.length <= 8 ? "********" : `********${token.slice(-4)}`;
}

function assertToken(token) {
  if (!token) throw new Error("DigitalOcean token is required");
  if (/\s/.test(token)) throw new Error("Paste the raw token only, without spaces or Bearer");
}

async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

function upsertEnv(content, updates) {
  const keys = new Set(Object.keys(updates));
  const seen = new Set();
  const lines = content.split(/\r?\n/).filter((line, index, all) => index < all.length - 1 || line !== "");
  const next = lines.map((line) => {
    const match = /^([A-Z0-9_]+)=/.exec(line);
    const key = match?.[1];
    if (!key || !keys.has(key)) return line;
    seen.add(key);
    return `${key}=${updates[key]}`;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) next.push(`${key}=${value}`);
  }
  return `${next.join("\n")}\n`;
}

async function saveEnv(token) {
  const current = await readOptional(envPath);
  await mkdir(dirname(envPath), { recursive: true });
  await writeFile(envPath, upsertEnv(current, { DIGITALOCEAN_API_TOKEN: token }), { mode: 0o600 });
  await chmod(envPath, 0o600);
}

async function validateDigitalOcean(token) {
  const response = await fetch("https://api.digitalocean.com/v2/account", {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message || body?.id || `DigitalOcean API returned ${response.status}`;
    throw new Error(message);
  }
  return {
    dropletLimit: body?.account?.droplet_limit ?? null,
    emailVerified: body?.account?.email_verified ?? null,
    status: body?.account?.status ?? null
  };
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function sendHtml(response) {
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": "text/html; charset=utf-8"
  });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>nipmod DigitalOcean setup</title>
    <style>
      :root {
        background: #030304;
        color: #f6f7f8;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      body {
        display: grid;
        margin: 0;
        min-height: 100svh;
        padding: 24px;
        place-items: center;
      }
      main {
        backdrop-filter: blur(28px) saturate(170%);
        background: rgba(255, 255, 255, 0.055);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 18px;
        box-shadow: 0 28px 90px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.08);
        max-width: 620px;
        padding: 24px;
        width: 100%;
      }
      h1 {
        font-size: 28px;
        letter-spacing: 0;
        line-height: 1.1;
        margin: 0 0 10px;
      }
      p {
        color: #a8adb7;
        line-height: 1.5;
        margin: 0 0 22px;
      }
      form {
        display: grid;
        gap: 14px;
      }
      label {
        color: #d6d9df;
        display: grid;
        font-size: 13px;
        font-weight: 650;
        gap: 8px;
      }
      input {
        background: rgba(0, 0, 0, 0.28);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 14px;
        color: #f6f7f8;
        font: inherit;
        min-height: 48px;
        padding: 0 14px;
        width: 100%;
      }
      input:focus {
        border-color: rgba(155, 188, 255, 0.8);
        box-shadow: 0 0 0 3px rgba(155, 188, 255, 0.14);
        outline: none;
      }
      button {
        background: rgba(246, 247, 248, 0.94);
        border: 0;
        border-radius: 14px;
        color: #050506;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        min-height: 48px;
        padding: 0 18px;
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }
      code {
        background: rgba(0, 0, 0, 0.26);
        border-radius: 8px;
        color: #f6f7f8;
        padding: 2px 6px;
      }
      .status {
        border-radius: 14px;
        display: none;
        line-height: 1.45;
        padding: 13px 14px;
      }
      .status.ok {
        background: rgba(34, 197, 94, 0.12);
        color: #bbf7d0;
        display: block;
      }
      .status.error {
        background: rgba(239, 68, 68, 0.12);
        color: #fecaca;
        display: block;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>DigitalOcean setup</h1>
      <p>Stores the token locally in <code>${escapeHtml(envPath)}</code>. Nothing is sent to chat.</p>
      <form id="form">
        <label>
          DigitalOcean API token
          <input name="token" type="password" autocomplete="off" required />
        </label>
        <button type="submit">Save token</button>
        <div id="status" class="status" role="status"></div>
      </form>
    </main>
    <script>
      const form = document.querySelector("#form");
      const statusBox = document.querySelector("#status");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button");
        button.disabled = true;
        statusBox.className = "status";
        statusBox.textContent = "";
        try {
          const response = await fetch("/api/digitalocean", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: form.token.value })
          });
          const body = await response.json();
          if (!response.ok || !body.ok) throw new Error(body.error || "Save failed");
          statusBox.className = "status ok";
          statusBox.textContent = "Saved token " + body.token + ". Account status " + body.account.status + ".";
          form.token.value = "";
        } catch (error) {
          statusBox.className = "status error";
          statusBox.textContent = error instanceof Error ? error.message : "Save failed";
        } finally {
          button.disabled = false;
        }
      });
    </script>
  </body>
</html>`);
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${host}:${port}`);
    if (request.method === "GET" && url.pathname === "/") return sendHtml(response);
    if (request.method === "GET" && url.pathname === "/health") return sendJson(response, 200, { ok: true });
    if (request.method === "POST" && url.pathname === "/api/digitalocean") {
      const body = await readJson(request);
      const token = normalizeToken(String(body.token || ""));
      assertToken(token);
      const account = await validateDigitalOcean(token);
      await saveEnv(token);
      return sendJson(response, 200, { ok: true, token: maskToken(token), account });
    }
    return sendJson(response, 404, { ok: false, error: "not found" });
  } catch (error) {
    return sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : "unknown error" });
  }
});

server.listen(port, host, () => {
  console.log(`DigitalOcean setup: http://${host}:${port}`);
  console.log(`Secrets file: ${envPath}`);
});
