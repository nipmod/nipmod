import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { SandboxAuditReport } from "./sandbox-audit.js";

export interface SandboxDecisionBindingCheck {
  detail: string;
  id: string;
  label: string;
  ok: boolean;
}

export interface SandboxDecisionBinding {
  checkedAt: string;
  checks: SandboxDecisionBindingCheck[];
  decision: {
    decisionSha256: string | null;
    expectedReceiptType: string;
    policyKey: string | null;
    recommendedId: string | null;
    recommendedSource: string | null;
    requiredFieldCount: number;
    runbookStatus: string | null;
    target: {
      displayName: string | null;
      id: string | null;
      source: string | null;
      version: string | null;
    };
  };
  ok: boolean;
  receipt: {
    auditReceiptSha256: string | null;
    cacheKey: string | null;
    contentSha256: string | null;
    executionGateStatus: string | null;
    policySha256: string | null;
    type: string | null;
    verdict: string | null;
  };
  status: "matched" | "not-ready";
  summary: string;
  targetConfirmed: boolean;
  type: "dev.nipmod.sandbox-decision-binding.v1";
}

export interface SandboxDecisionBindingOptions {
  decision: unknown;
  report: SandboxAuditReport;
  targetConfirmed: boolean;
}

const DEFAULT_SANDBOX_RECEIPT_REQUIRED_FIELDS = [
  "type",
  "subject.contentSha256",
  "policy.policySha256",
  "cache.contentSha256",
  "cache.policySha256",
  "cache.cacheKey",
  "cache.keyScope",
  "cache.runOncePerHash",
  "provenanceBinding.contentSha256",
  "provenanceBinding.policySha256",
  "provenanceBinding.cacheKey",
  "provenanceBinding.auditReceiptSha256",
  "executionGate.status",
  "executionGate.requiresExplicitRuntimeConfirmation",
  "sandbox.workspaceWrites",
  "sandbox.executesCode",
  "verdict"
] as const;

export async function readSandboxDecisionFile(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`could not read sandbox decision JSON ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function bindSandboxAuditReportToDecision(input: SandboxDecisionBindingOptions): SandboxDecisionBinding {
  const decision = unwrapPackageDecision(input.decision);
  const report = input.report as unknown as Record<string, unknown>;
  const receiptContract = isRecord(readPath(decision, "sandboxPlan.analysisCache.receiptContract"))
    ? (readPath(decision, "sandboxPlan.analysisCache.receiptContract") as Record<string, unknown>)
    : null;
  const requiredFields = readStringArray(receiptContract?.requiredFields).length
    ? readStringArray(receiptContract?.requiredFields)
    : [...DEFAULT_SANDBOX_RECEIPT_REQUIRED_FIELDS];
  const missingFields = requiredFields.filter((field) => !isPresent(readPath(report, field)));
  const expectedReceiptType = readString(receiptContract?.expectedReceiptType) ?? "dev.nipmod.sandbox-audit.v1";
  const receiptType = readStringPath(report, "type");
  const subjectHash = readStringPath(report, "subject.contentSha256");
  const cacheContentHash = readStringPath(report, "cache.contentSha256");
  const provenanceContentHash = readStringPath(report, "provenanceBinding.contentSha256");
  const policyHash = readStringPath(report, "policy.policySha256");
  const cachePolicyHash = readStringPath(report, "cache.policySha256");
  const provenancePolicyHash = readStringPath(report, "provenanceBinding.policySha256");
  const cacheKey = readStringPath(report, "cache.cacheKey");
  const provenanceCacheKey = readStringPath(report, "provenanceBinding.cacheKey");
  const auditReceiptSha256 = readStringPath(report, "provenanceBinding.auditReceiptSha256");
  const verdict = readStringPath(report, "verdict");
  const executionGateStatus = readStringPath(report, "executionGate.status");
  const policyKey = readStringPath(decision, "sandboxPlan.analysisCache.policyKey");
  const decisionSha256 = readStringPath(decision, "integrity.decisionSha256");
  const recommendedId = readStringPath(decision, "recommended.id");
  const recommendedSource = readStringPath(decision, "recommended.source");
  const target = {
    displayName: readStringPath(decision, "sandboxPlan.target.displayName"),
    id: readStringPath(decision, "sandboxPlan.target.id"),
    source: readStringPath(decision, "sandboxPlan.target.source"),
    version: readStringPath(decision, "sandboxPlan.target.version")
  };
  const expectedCacheKey = isSha256(subjectHash) && isSha256(policyHash) ? sandboxAuditCacheKey(subjectHash, policyHash) : null;

  const checks: SandboxDecisionBindingCheck[] = [
    {
      detail: isRecord(decision) ? "Package decision object is present." : "Pass the JSON response from /api/decision or its decision object.",
      id: "decision-json",
      label: "Decision JSON",
      ok: isRecord(decision)
    },
    {
      detail: missingFields.length
        ? `Missing: ${missingFields.slice(0, 6).join(", ")}${missingFields.length > 6 ? "..." : ""}`
        : `${requiredFields.length} receipt field(s) required by the decision are present.`,
      id: "required-fields",
      label: "Receipt fields",
      ok: missingFields.length === 0
    },
    {
      detail: receiptType ? `Receipt type is ${receiptType}.` : "Receipt type is missing.",
      id: "receipt-type",
      label: "Receipt type",
      ok: receiptType === expectedReceiptType
    },
    {
      detail:
        isSha256(subjectHash) && cacheContentHash === subjectHash && provenanceContentHash === subjectHash
          ? `Content hash sha256:${shortHash(subjectHash)} is bound across subject, cache and provenance.`
          : "subject.contentSha256 must match cache.contentSha256 and provenanceBinding.contentSha256.",
      id: "content-binding",
      label: "Content binding",
      ok: isSha256(subjectHash) && cacheContentHash === subjectHash && provenanceContentHash === subjectHash
    },
    {
      detail:
        isSha256(policyHash) && cachePolicyHash === policyHash && provenancePolicyHash === policyHash
          ? `Audit policy sha256:${shortHash(policyHash)} is internally bound.`
          : "policy.policySha256 must match cache.policySha256 and provenanceBinding.policySha256.",
      id: "policy-binding",
      label: "Policy binding",
      ok: isSha256(policyHash) && cachePolicyHash === policyHash && provenancePolicyHash === policyHash
    },
    {
      detail:
        expectedCacheKey && cacheKey === expectedCacheKey && provenanceCacheKey === cacheKey
          ? `Cache key sha256:${shortHash(cacheKey)} matches content plus policy.`
          : "cache.cacheKey must match sha256(subject.contentSha256 + policy.policySha256) and provenanceBinding.cacheKey.",
      id: "cache-key",
      label: "Cache key",
      ok:
        readStringPath(report, "cache.keyScope") === "artifact-content-plus-policy" &&
        readBooleanPath(report, "cache.runOncePerHash") === true &&
        Boolean(expectedCacheKey) &&
        cacheKey === expectedCacheKey &&
        provenanceCacheKey === cacheKey
    },
    {
      detail:
        readBooleanPath(report, "sandbox.workspaceWrites") === false && readBooleanPath(report, "sandbox.executesCode") === false
          ? "Audit receipt says no workspace writes and no package code execution."
          : "sandbox-audit must not write to the workspace or execute package code.",
      id: "audit-boundary",
      label: "Audit boundary",
      ok: readBooleanPath(report, "sandbox.workspaceWrites") === false && readBooleanPath(report, "sandbox.executesCode") === false
    },
    {
      detail:
        readBooleanPath(report, "executionGate.requiresExplicitRuntimeConfirmation") === true && Boolean(executionGateStatus)
          ? `Execution gate is ${executionGateStatus} and requires explicit runtime confirmation.`
          : "executionGate.requiresExplicitRuntimeConfirmation must be true.",
      id: "execution-gate",
      label: "Execution gate",
      ok: readBooleanPath(report, "executionGate.requiresExplicitRuntimeConfirmation") === true && Boolean(executionGateStatus)
    },
    {
      detail: isSha256(auditReceiptSha256)
        ? `Audit receipt sha256:${shortHash(auditReceiptSha256)} is present.`
        : "provenanceBinding.auditReceiptSha256 must be a SHA-256 hex string.",
      id: "receipt-hash",
      label: "Receipt hash",
      ok: isSha256(auditReceiptSha256)
    },
    {
      detail:
        verdict === "pass"
          ? "sandbox-audit verdict is pass."
          : verdict === "review"
            ? "sandbox-audit produced review; approval is not ready without an explicit local policy exception."
            : verdict === "blocked"
              ? "sandbox-audit is blocked."
              : "sandbox-audit verdict must be pass.",
      id: "audit-verdict",
      label: "Audit verdict",
      ok: verdict === "pass"
    },
    {
      detail: policyKey ? `Hosted decision policy fingerprint sha256:${shortHash(policyKey)} is attached.` : "Hosted decision has no policyKey.",
      id: "decision-policy",
      label: "Decision policy",
      ok: policyKey ? isSha256(policyKey) : false
    },
    {
      detail: input.targetConfirmed
        ? `Caller confirmed the audited local subject matches ${formatDecisionTarget(target)}.`
        : `Caller must confirm the local path is the selected package/source target: ${formatDecisionTarget(target)}.`,
      id: "target-confirmed",
      label: "Target confirmed",
      ok: input.targetConfirmed
    },
    {
      detail:
        readBooleanPath(decision, "sandboxRunbook.localOnly") === true &&
        readBooleanPath(decision, "sandboxRunbook.hostedApiExecutes") === false &&
        readBooleanPath(decision, "sandboxRunbook.workspaceWrites") === false
          ? "Decision runbook is local-only and hosted API does not execute or write."
          : "Decision sandboxRunbook must be local-only with hostedApiExecutes=false and workspaceWrites=false.",
      id: "runbook-boundary",
      label: "Runbook boundary",
      ok:
        readBooleanPath(decision, "sandboxRunbook.localOnly") === true &&
        readBooleanPath(decision, "sandboxRunbook.hostedApiExecutes") === false &&
        readBooleanPath(decision, "sandboxRunbook.workspaceWrites") === false
    },
    {
      detail:
        readBooleanPath(decision, "sandboxRunbook.runtime.requiresPassReceipt") === true &&
        readBooleanPath(decision, "sandboxRunbook.runtime.requiresExplicitApproval") === true &&
        readBooleanPath(decision, "sandboxRunbook.runtime.workspaceMountAllowed") === false &&
        readBooleanPath(decision, "sandboxRunbook.runtime.secretsAllowed") === false
          ? "Runtime is gated by pass receipt, explicit approval, no secrets and no workspace mount."
          : "Decision runtime gate must require pass receipt and approval, with no secrets or workspace mount.",
      id: "runtime-gate",
      label: "Runtime gate",
      ok:
        readBooleanPath(decision, "sandboxRunbook.runtime.requiresPassReceipt") === true &&
        readBooleanPath(decision, "sandboxRunbook.runtime.requiresExplicitApproval") === true &&
        readBooleanPath(decision, "sandboxRunbook.runtime.workspaceMountAllowed") === false &&
        readBooleanPath(decision, "sandboxRunbook.runtime.secretsAllowed") === false
    },
    {
      detail:
        isSha256(decisionSha256) && recommendedId && recommendedSource
          ? `Decision sha256:${shortHash(decisionSha256)} recommends ${recommendedSource}:${recommendedId}.`
          : "Decision should include integrity.decisionSha256, recommended.id and recommended.source for approval logs.",
      id: "decision-identity",
      label: "Decision identity",
      ok: isSha256(decisionSha256) && Boolean(recommendedId) && Boolean(recommendedSource)
    }
  ];
  const ok = checks.every((check) => check.ok);
  return {
    checkedAt: new Date().toISOString(),
    checks,
    decision: {
      decisionSha256,
      expectedReceiptType,
      policyKey,
      recommendedId,
      recommendedSource,
      requiredFieldCount: requiredFields.length,
      runbookStatus: readStringPath(decision, "sandboxRunbook.status"),
      target
    },
    ok,
    receipt: {
      auditReceiptSha256,
      cacheKey,
      contentSha256: subjectHash,
      executionGateStatus,
      policySha256: policyHash,
      type: receiptType,
      verdict
    },
    status: ok ? "matched" : "not-ready",
    summary: ok ? "Sandbox receipt is bound to the package decision and ready for approval storage." : "Sandbox receipt is not ready for approval.",
    targetConfirmed: input.targetConfirmed,
    type: "dev.nipmod.sandbox-decision-binding.v1"
  };
}

export function formatSandboxDecisionBinding(binding: SandboxDecisionBinding): string {
  const failing = binding.checks.filter((check) => !check.ok);
  const lines = [
    `decision binding: ${binding.status}`,
    `decision: ${binding.decision.recommendedSource ?? "unknown"}:${binding.decision.recommendedId ?? "unknown"} policy:${shortHash(binding.decision.policyKey)}`,
    `receipt: ${binding.receipt.verdict ?? "unknown"} sha256:${shortHash(binding.receipt.auditReceiptSha256)} cache:${shortHash(binding.receipt.cacheKey)}`,
    binding.targetConfirmed ? "target: confirmed" : "target: not confirmed"
  ];
  if (failing.length > 0) {
    lines.push(`blocking checks: ${failing.map((check) => check.id).join(", ")}`);
  }
  return lines.join("\n");
}

function unwrapPackageDecision(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }
  if (isRecord(value.decision)) {
    return value.decision;
  }
  if (isRecord(value.data) && isRecord(value.data.decision)) {
    return value.data.decision;
  }
  if (value.type === "dev.nipmod.package-decision.v1") {
    return value;
  }
  return value;
}

function sandboxAuditCacheKey(contentSha256: string, policySha256: string): string {
  return sha256Text(
    JSON.stringify({
      contentSha256,
      policySha256,
      type: "dev.nipmod.sandbox-audit-cache-key.v1"
    })
  );
}

function formatDecisionTarget(target: SandboxDecisionBinding["decision"]["target"]): string {
  return [target.source, target.id, target.version].filter(Boolean).join(":") || target.displayName || "decision target";
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readPath(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of path.split(".")) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function readStringPath(value: unknown, path: string): string | null {
  return readString(readPath(value, path));
}

function readBooleanPath(value: unknown, path: string): boolean | null {
  const current = readPath(value, path);
  return typeof current === "boolean" ? current : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function isSha256(value: string | null): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function shortHash(value: string | null): string {
  return value && value.length >= 12 ? value.slice(0, 12) : "none";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
