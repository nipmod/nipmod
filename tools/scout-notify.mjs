#!/usr/bin/env node
import { createHash, createPrivateKey, sign as signMessage } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_NODE_URL = "https://node.nipmod.com";
const DEFAULT_MAX_PER_CYCLE = 5;
const DEFAULT_MAX_PER_OWNER_PER_CYCLE = 2;
const DEFAULT_DEDUPE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DID_KEY_PATTERN = /^did:key:z[A-Za-z0-9]+$/;

export function notificationOptionsFromEnv(env = process.env) {
  return {
    allowAll: booleanFromEnv(env.NIPMOD_SCOUT_NOTIFY_ALLOW_ALL, true),
    allowList: parseList(env.NIPMOD_SCOUT_NOTIFY_ALLOWLIST),
    maxPerCycle: numberFromEnv(env.NIPMOD_SCOUT_NOTIFY_MAX_PER_CYCLE, DEFAULT_MAX_PER_CYCLE),
    maxPerOwnerPerCycle: numberFromEnv(env.NIPMOD_SCOUT_NOTIFY_MAX_PER_OWNER_PER_CYCLE, DEFAULT_MAX_PER_OWNER_PER_CYCLE),
    optOut: parseList(env.NIPMOD_SCOUT_NOTIFY_OPTOUT)
  };
}

export function createOwnerNotificationPlan(cycle, options = {}) {
  const generatedAt = options.generatedAt ?? cycle?.generatedAt ?? new Date().toISOString();
  const maxPerCycle = numberOr(options.maxPerCycle, DEFAULT_MAX_PER_CYCLE);
  const maxPerOwnerPerCycle = numberOr(options.maxPerOwnerPerCycle, DEFAULT_MAX_PER_OWNER_PER_CYCLE);
  const allowAll = options.allowAll ?? true;
  const allowList = normalizeList(options.allowList);
  const optOut = normalizeList(options.optOut);
  const sentKeys = new Set(normalizeList(options.sentKeys));
  const candidates = Array.isArray(cycle?.candidates) ? cycle.candidates : [];
  const drafts = new Set((Array.isArray(cycle?.drafts) ? cycle.drafts : []).map((draft) => draft?.package).filter(Boolean));
  const summary = emptySummary();
  const notifications = [];
  const seenKeys = new Set();
  const perOwner = new Map();
  const ready = cycle?.claimIndex?.ok === true && cycle?.registry?.ok === true;
  const blockedReason = ready ? null : "claim index and registry must both be fresh before owner notifications are planned";

  for (const candidate of candidates) {
    if (!isNotificationEligible(candidate, drafts)) {
      summary.skipped += 1;
      continue;
    }
    summary.eligible += 1;

    if (!allowAll && !matchesAny(candidate, allowList)) {
      summary.optedOut += 1;
      continue;
    }
    if (matchesAny(candidate, optOut)) {
      summary.optedOut += 1;
      continue;
    }

    const dedupeKey = notificationDedupeKey(candidate.package);
    if (seenKeys.has(dedupeKey) || sentKeys.has(dedupeKey)) {
      summary.deduped += 1;
      continue;
    }
    seenKeys.add(dedupeKey);

    if (!ready) {
      summary.blocked += 1;
      continue;
    }

    const ownerDid = ownerDidFromSource(candidate.source);
    const ownerCount = perOwner.get(ownerDid) ?? 0;
    if (ownerCount >= maxPerOwnerPerCycle || notifications.length >= maxPerCycle) {
      summary.rateLimited += 1;
      continue;
    }
    perOwner.set(ownerDid, ownerCount + 1);

    notifications.push(ownerNotification(candidate, dedupeKey, generatedAt));
  }

  summary.planned = notifications.length;

  return {
    blockedReason,
    dryRun: true,
    formatVersion: 1,
    generatedAt,
    notifications,
    policy: {
      allowAll,
      allowListCount: allowList.size,
      claimIndexRequired: true,
      dedupeWindowMs: DEFAULT_DEDUPE_WINDOW_MS,
      maxPerCycle,
      maxPerOwnerPerCycle,
      optOutCount: optOut.size,
      registryRequired: true,
      remoteWritesRequireExplicitRun: true
    },
    ready,
    remoteWrites: false,
    summary,
    transport: {
      channel: "gitlawb-issue",
      writeEndpointTemplate: `${trimTrailingSlash(cycle?.node?.url ?? DEFAULT_NODE_URL)}/api/v1/repos/{owner}/{repo}/issues`,
      writeRequires: [
        "operator authorization",
        "explicit remote write mode",
        "Scout signing identity"
      ]
    },
    type: "dev.nipmod.scout-owner-notifications.v1"
  };
}

export async function runOwnerNotificationDelivery({
  cycle,
  fetchFn = fetch,
  generatedAt = new Date().toISOString(),
  identity = null,
  ledger = null,
  ledgerPath = null,
  nodeUrl = cycle?.node?.url ?? DEFAULT_NODE_URL,
  plan = null,
  remoteWrites = false
} = {}) {
  const notificationPlan = plan ?? createOwnerNotificationPlan(cycle, { generatedAt });
  const results = [];
  const summary = {
    blocked: 0,
    deduped: 0,
    failed: 0,
    planned: notificationPlan.notifications.length,
    skipped: 0,
    written: 0
  };
  const sentLedger = await loadLedger({ ledger, ledgerPath });

  if (!remoteWrites || !identity?.did || !identity?.privateKeyPem) {
    summary.blocked = notificationPlan.notifications.length;
    return deliveryResult({ generatedAt, ok: true, remoteWrites: false, results, summary });
  }

  for (const notification of notificationPlan.notifications) {
    if (sentLedger.has(notification.dedupeKey)) {
      summary.deduped += 1;
      results.push(notificationResult(notification, "deduped", { reason: "dedupe ledger already contains notification" }));
      continue;
    }

    const existing = await remoteIssueHasDedupeKey({ fetchFn, nodeUrl, notification });
    if (existing.found) {
      sentLedger.set(notification.dedupeKey, { issue: existing.issueId ?? null, sentAt: generatedAt });
      summary.deduped += 1;
      results.push(notificationResult(notification, "deduped", { issueId: existing.issueId ?? null, reason: "remote issue already contains dedupe key" }));
      continue;
    }
    if (existing.error) {
      summary.failed += 1;
      results.push(notificationResult(notification, "failed", { reason: existing.error }));
      continue;
    }

    const write = await postGitlawbIssue({ fetchFn, generatedAt, identity, nodeUrl, notification });
    if (write.ok) {
      sentLedger.set(notification.dedupeKey, { issue: write.issueId ?? null, sentAt: generatedAt });
      summary.written += 1;
      results.push(notificationResult(notification, "written", { issueId: write.issueId ?? null }));
      continue;
    }

    summary.failed += 1;
    results.push(notificationResult(notification, "failed", { reason: write.error }));
  }

  await persistLedger({ ledger, ledgerPath, sentLedger });
  return deliveryResult({ generatedAt, ok: summary.failed === 0, remoteWrites: true, results, summary });
}

export async function loadNotificationIdentityFromEnv(env = process.env) {
  const encoded = env.NIPMOD_SCOUT_NOTIFY_IDENTITY_B64;
  if (encoded) {
    return parseIdentityJson(Buffer.from(encoded, "base64").toString("utf8"));
  }
  if (env.NIPMOD_SCOUT_NOTIFY_IDENTITY_JSON) {
    return parseIdentityJson(env.NIPMOD_SCOUT_NOTIFY_IDENTITY_JSON);
  }
  if (env.NIPMOD_SCOUT_NOTIFY_IDENTITY_PATH) {
    return parseIdentityJson(await readFile(env.NIPMOD_SCOUT_NOTIFY_IDENTITY_PATH, "utf8"));
  }
  return null;
}

export function notificationDedupeKey(packageId) {
  return `nipmod-scout:${Buffer.from(String(packageId)).toString("base64url")}:package-claim`;
}

function ownerNotification(candidate, dedupeKey, generatedAt) {
  const ownerDid = ownerDidFromSource(candidate.source);
  const shortOwner = ownerSegment(ownerDid);
  const title = "Package this repo with Nipmod";
  const body = [
    "Nipmod Scout prepared a package draft for this Gitlawb repo.",
    "",
    `Package: ${candidate.package}`,
    `Draft: ${candidate.draft?.endpoint ?? ""}`,
    "",
    "Owner command:",
    "```sh",
    candidate.commands?.packagePr ?? `nipmod package pr ${candidate.source} --dir . --identity .nipmod/identity.json --json`,
    "git add nipmod.json README.nipmod.md .nipmod/package-claim.json",
    "git commit -m \"feat: add nipmod package manifest\"",
    "GITLAWB_NODE=https://node.nipmod.com git push",
    "```",
    "",
    "Nothing is claimed until the Gitlawb owner DID signs and pushes `.nipmod/package-claim.json`.",
    "",
    `Dedupe: ${dedupeKey}`
  ].join("\n");

  return {
    body,
    channel: "gitlawb-issue",
    createdAt: generatedAt,
    dedupeKey,
    draft: {
      endpoint: candidate.draft?.endpoint ?? null,
      remoteWrites: false
    },
    issue: {
      path: `/api/v1/repos/${shortOwner}/${candidate.repoName}/issues`
    },
    package: candidate.package,
    remoteWrites: false,
    repo: {
      gitlawbUrl: candidate.gitlawbUrl,
      name: candidate.repoName,
      ownerDid,
      shortOwner
    },
    source: candidate.source,
    status: "planned",
    title,
    type: "dev.nipmod.scout-owner-notification.v1"
  };
}

function isNotificationEligible(candidate, draftPackages) {
  return (
    candidate?.status === "unclaimed-draft" &&
    candidate.claimStatus === "unclaimed" &&
    candidate.draft?.status === "unclaimed" &&
    candidate.draft?.remoteWrites === false &&
    draftPackages.has(candidate.package) &&
    typeof candidate.package === "string" &&
    typeof candidate.source === "string" &&
    typeof candidate.repoName === "string" &&
    DID_KEY_PATTERN.test(ownerDidFromSource(candidate.source))
  );
}

async function remoteIssueHasDedupeKey({ fetchFn, nodeUrl, notification }) {
  const url = `${trimTrailingSlash(nodeUrl)}${notification.issue.path}`;
  try {
    const response = await fetchFn(url, {
      headers: { accept: "application/json" },
      method: "GET"
    });
    if (response.status === 404) {
      return { error: "repo issue list returned 404" };
    }
    if (!response.ok) {
      return { error: `repo issue list returned HTTP ${response.status}` };
    }
    const payload = await response.json();
    const issues = Array.isArray(payload?.issues) ? payload.issues : [];
    const issue = issues.find((item) => JSON.stringify(item).includes(notification.dedupeKey));
    return issue ? { found: true, issueId: issue.id ?? null } : { found: false };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function postGitlawbIssue({ fetchFn, generatedAt, identity, nodeUrl, notification }) {
  const payload = {
    author: identity.did,
    body: notification.body,
    created_at: generatedAt,
    id: notification.dedupeKey,
    status: "open",
    title: notification.title
  };
  const payloadBytes = Buffer.from(stableJson(payload), "utf8");
  const signedPayload = {
    payload,
    signature: signMessage(null, payloadBytes, createPrivateKey(identity.privateKeyPem)).toString("base64"),
    signer: identity.did
  };
  const requestBody = Buffer.from(
    JSON.stringify({
      body: notification.body,
      signed_payload: signedPayload,
      title: notification.title
    }),
    "utf8"
  );
  const headers = signGitlawbRequest({
    body: requestBody,
    identity,
    method: "POST",
    path: notification.issue.path
  });
  const url = `${trimTrailingSlash(nodeUrl)}${notification.issue.path}`;

  try {
    const response = await fetchFn(url, {
      body: requestBody,
      headers: {
        "content-type": "application/json",
        ...headers
      },
      method: "POST"
    });
    const text = await response.text();
    const payload = text ? safeJson(text) : {};
    if (!response.ok) {
      return { error: `issue create returned HTTP ${response.status}`, ok: false };
    }
    return { issueId: payload?.id ?? null, ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), ok: false };
  }
}

function signGitlawbRequest({ body, identity, method, path }) {
  const created = Math.floor(Date.now() / 1000);
  const contentDigest = `sha-256=:${createHash("sha256").update(body).digest("base64")}:`;
  const signatureParams = `("@method" "@path" "content-digest");keyid="${identity.did}";alg="ed25519";created=${created}`;
  const signatureBase = [
    `"@method": ${method.toUpperCase()}`,
    `"@path": ${path}`,
    `"content-digest": ${contentDigest}`,
    `"@signature-params": ${signatureParams}`
  ].join("\n");
  const signature = signMessage(null, Buffer.from(signatureBase, "utf8"), createPrivateKey(identity.privateKeyPem)).toString("base64");

  return {
    "Content-Digest": contentDigest,
    "Signature-Input": `sig1=${signatureParams}`,
    Signature: `sig1=:${signature}:`
  };
}

async function loadLedger({ ledger, ledgerPath }) {
  if (ledger instanceof Map) {
    return ledger;
  }
  const map = new Map();
  if (!ledgerPath) {
    return map;
  }
  try {
    const payload = JSON.parse(await readFile(ledgerPath, "utf8"));
    for (const entry of Array.isArray(payload?.sent) ? payload.sent : []) {
      if (typeof entry?.dedupeKey === "string") {
        map.set(entry.dedupeKey, { issue: entry.issue ?? null, sentAt: entry.sentAt ?? null });
      }
    }
  } catch {
    return map;
  }
  return map;
}

async function persistLedger({ ledger, ledgerPath, sentLedger }) {
  if (!ledgerPath) {
    return;
  }
  if (ledger instanceof Map && ledger === sentLedger) {
    return;
  }
  const payload = {
    formatVersion: 1,
    sent: [...sentLedger.entries()].map(([dedupeKey, value]) => ({ dedupeKey, ...value })),
    type: "dev.nipmod.scout-owner-notification-ledger.v1"
  };
  await mkdir(dirname(ledgerPath), { recursive: true });
  await writeFile(ledgerPath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
}

function deliveryResult({ generatedAt, ok, remoteWrites, results, summary }) {
  return {
    formatVersion: 1,
    generatedAt,
    ok,
    remoteWrites,
    results,
    summary,
    type: "dev.nipmod.scout-owner-notification-delivery.v1"
  };
}

function notificationResult(notification, status, extra = {}) {
  return {
    dedupeKey: notification.dedupeKey,
    package: notification.package,
    source: notification.source,
    status,
    ...extra
  };
}

function emptySummary() {
  return {
    blocked: 0,
    deduped: 0,
    eligible: 0,
    optedOut: 0,
    planned: 0,
    rateLimited: 0,
    skipped: 0
  };
}

function matchesAny(candidate, values) {
  if (values.size === 0) {
    return false;
  }
  const ownerDid = ownerDidFromSource(candidate.source);
  const candidates = new Set([
    candidate.package,
    candidate.source,
    ownerDid,
    ownerSegment(ownerDid),
    `${ownerDid}/${candidate.repoName}`,
    `${ownerSegment(ownerDid)}/${candidate.repoName}`,
    candidate.repoName
  ]);
  for (const value of values) {
    if (candidates.has(value)) {
      return true;
    }
  }
  return false;
}

function ownerDidFromSource(source) {
  const match = /^gitlawb:\/\/(did:key:z[A-Za-z0-9]+)\/[a-z0-9][a-z0-9._-]*$/.exec(String(source ?? ""));
  return match?.[1] ?? "";
}

function ownerSegment(ownerDid) {
  return ownerDid.replace(/^did:key:/, "");
}

function parseIdentityJson(value) {
  const identity = JSON.parse(value);
  if (!DID_KEY_PATTERN.test(identity?.did ?? "") || typeof identity?.privateKeyPem !== "string") {
    throw new Error("notification identity must contain did:key and privateKeyPem");
  }
  return {
    did: identity.did,
    privateKeyPem: identity.privateKeyPem
  };
}

function normalizeList(value) {
  if (value instanceof Set) {
    return new Set([...value].map(String).map((item) => item.trim()).filter(Boolean));
  }
  if (Array.isArray(value)) {
    return new Set(value.map(String).map((item) => item.trim()).filter(Boolean));
  }
  return parseList(value);
}

function parseList(value) {
  if (typeof value !== "string" || !value.trim()) {
    return new Set();
  }
  return new Set(value.split(",").map((item) => item.trim()).filter(Boolean));
}

function booleanFromEnv(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  return /^(1|true|yes)$/i.test(value);
}

function numberFromEnv(value, fallback) {
  return numberOr(Number(value), fallback);
}

function numberOr(value, fallback) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, "");
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
