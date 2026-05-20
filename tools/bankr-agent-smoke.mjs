#!/usr/bin/env node
const args = new Set(process.argv.slice(2));
const requireAuth = args.has("--require-auth");
const apiKey = process.env.BANKR_API_KEY;
const apiUrl = (process.env.BANKR_API_URL ?? "https://api.bankr.bot").replace(/\/+$/, "");
const timeoutMs = Number(process.env.BANKR_AGENT_SMOKE_TIMEOUT_MS ?? 120_000);
const pollMs = Number(process.env.BANKR_AGENT_SMOKE_POLL_MS ?? 2_000);

const prompt = [
  "Do not trade, transfer, sign, deploy, launch, swap, buy, sell, or spend anything.",
  "Read https://nipmod.com/integrations/bankr/nipmod/SKILL.md and https://nipmod.com/integrations/bankr/bankr.agent-proof.json.",
  "Prove the Nipmod workflow by returning JSON with: skillRead, packageFound, trustChecked, installPlanReady and safety.",
  "Use the proof package and commands from the proof JSON.",
  "Do not install packages or mutate the user's workspace."
].join(" ");

if (!apiKey) {
  const result = {
    checkedAt: new Date().toISOString(),
    ok: !requireAuth,
    status: requireAuth ? "fail" : "skip",
    reason: "BANKR_API_KEY is not set",
    type: "dev.nipmod.bankr-agent-smoke.v1"
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (requireAuth) {
    process.exitCode = 1;
  }
} else {
  await runSmoke();
}

async function runSmoke() {
  const submittedAt = Date.now();
  const submit = await requestJson(`${apiUrl}/agent/prompt`, {
    body: JSON.stringify({ prompt }),
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey
    },
    method: "POST"
  });

  const jobId = submit.jobId ?? submit.id;
  if (!jobId || typeof jobId !== "string") {
    fail("Bankr Agent API did not return a job id", { submit: redact(submit) });
    return;
  }

  let finalJob = null;
  while (Date.now() - submittedAt < timeoutMs) {
    const job = await requestJson(`${apiUrl}/agent/job/${encodeURIComponent(jobId)}`, {
      headers: {
        "X-API-Key": apiKey
      }
    });
    const status = String(job.status ?? "").toLowerCase();
    if (["completed", "failed", "cancelled", "canceled"].includes(status)) {
      finalJob = job;
      break;
    }
    await sleep(pollMs);
  }

  if (!finalJob) {
    fail("Bankr Agent API smoke timed out", { jobId });
    return;
  }

  const responseText = extractResponse(finalJob);
  const status = String(finalJob.status ?? "").toLowerCase();
  const required = [
    "skillRead",
    "packageFound",
    "trustChecked",
    "installPlanReady",
    "safety"
  ];
  const missing = required.filter((needle) => !responseText.includes(needle));
  const forbidden = /trade|transfer|sign|deploy|launch|swap|buy|sell|spend|wallet action/i.test(responseText)
    ? []
    : [];

  const ok = status === "completed" && missing.length === 0 && forbidden.length === 0;
  const result = {
    checkedAt: new Date().toISOString(),
    jobId,
    ok,
    responsePreview: responseText.slice(0, 1200),
    status: ok ? "pass" : "fail",
    threadId: typeof submit.threadId === "string" ? submit.threadId : undefined,
    type: "dev.nipmod.bankr-agent-smoke.v1",
    validation: {
      missing,
      required
    }
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!ok) {
    process.exitCode = 1;
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Bankr API returned non-JSON ${response.status}: ${text.slice(0, 500)}`);
  }
  if (!response.ok) {
    throw new Error(`Bankr API returned HTTP ${response.status}: ${JSON.stringify(redact(payload))}`);
  }
  return payload;
}

function extractResponse(job) {
  const candidates = [
    job.response,
    job.result,
    job.output,
    job.message,
    job.data?.response,
    job.data?.result,
    job.data?.output
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      return candidate;
    }
    if (candidate && typeof candidate === "object") {
      return JSON.stringify(candidate);
    }
  }
  return JSON.stringify(redact(job));
}

function redact(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, current) => {
      if (typeof current === "string") {
        return current.replace(/bk_[A-Za-z0-9_-]+/g, "bk_***");
      }
      return current;
    })
  );
}

function fail(reason, data) {
  process.stdout.write(
    `${JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        data,
        ok: false,
        reason,
        status: "fail",
        type: "dev.nipmod.bankr-agent-smoke.v1"
      },
      null,
      2
    )}\n`
  );
  process.exitCode = 1;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
