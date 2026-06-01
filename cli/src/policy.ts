import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as z from "zod";
import { readOptionalFile, type Lockfile } from "./lockfile.js";
import { permissionScopeIssue, type PermissionScopeIssue, type PermissionScopeKind } from "./protocol.js";
import { type TrustReport } from "./trust-report.js";

export type PolicyProfile = "developer-default" | "strict-ci" | "research-permissive";
export type PolicyDecisionStatus = "pass" | "fail";

export interface PolicyRuleResult {
  actual: unknown;
  expected: unknown;
  field: string;
  ruleId: string;
  status: PolicyDecisionStatus;
}

export interface PolicyDecision {
  allowed: boolean;
  formatVersion: 1;
  profile: PolicyProfile;
  reasons: string[];
  rules: PolicyRuleResult[];
  subject: string;
}

export interface PolicyCheckPackage {
  canonical: string;
  decision: PolicyDecision;
  name: string;
  version: string;
}

export interface PolicyCheckResult {
  allowed: boolean;
  formatVersion: 1;
  packages: PolicyCheckPackage[];
  policy: NipmodPolicy;
  summary: {
    allow: number;
    block: number;
    total: number;
  };
}

const PolicyProfileSchema = z.enum(["developer-default", "strict-ci", "research-permissive"]);
const PackageIdSchema = z.string().regex(/^pkg:did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/);
const SemverSchema = z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);

const PolicySchema = z.strictObject({
  formatVersion: z.literal(1),
  profile: PolicyProfileSchema,
  rules: z.strictObject({
    blockUnknownPermissions: z.boolean(),
    blockedPermissions: z.strictObject({
      exec: z.boolean(),
      mcpTools: z.boolean().optional(),
      postinstall: z.boolean(),
      secrets: z.boolean()
    }),
    minimumTrustScore: z.number().int().min(0).max(100),
    requireVerified: z.boolean()
  }),
  type: z.literal("dev.nipmod.policy.v1")
});

const PolicyPermissionSchema = z.strictObject({
  env: z.array(z.string()),
  exec: z.strictObject({
    allowed: z.boolean()
  }),
  filesystem: z.array(z.string()),
  mcpTools: z.array(z.string()),
  network: z.array(z.string()),
  postinstall: z.strictObject({
    allowed: z.boolean()
  }),
  secrets: z.array(z.string())
});

const PolicyLockfilePackageSchema = z.strictObject({
  canonical: PackageIdSchema,
  name: z.string().min(1),
  permissions: PolicyPermissionSchema,
  version: SemverSchema
}).passthrough();

const PolicyLockfileSchema = z.strictObject({
  formatVersion: z.union([z.literal(1), z.literal(2)]),
  generatedBy: z.string().min(1),
  packages: z.record(z.string(), PolicyLockfilePackageSchema)
}).passthrough();

export type NipmodPolicy = z.infer<typeof PolicySchema>;
type PolicyLockfilePackage = z.infer<typeof PolicyLockfilePackageSchema>;

export function defaultPolicy(profile: PolicyProfile = "developer-default"): NipmodPolicy {
  switch (profile) {
    case "developer-default":
      return {
        formatVersion: 1,
        profile,
        rules: {
          blockUnknownPermissions: true,
          blockedPermissions: {
            exec: true,
            mcpTools: true,
            postinstall: true,
            secrets: true
          },
          minimumTrustScore: 100,
          requireVerified: true
        },
        type: "dev.nipmod.policy.v1"
      };
    case "strict-ci":
      return {
        ...defaultPolicy("developer-default"),
        profile: "strict-ci"
      };
    case "research-permissive":
      return {
        formatVersion: 1,
        profile,
        rules: {
          blockUnknownPermissions: true,
          blockedPermissions: {
            exec: true,
            mcpTools: true,
            postinstall: true,
            secrets: true
          },
          minimumTrustScore: 60,
          requireVerified: false
        },
        type: "dev.nipmod.policy.v1"
      };
  }
}

export function parsePolicyProfile(value: string | undefined): PolicyProfile {
  if (!value) {
    return "developer-default";
  }
  return PolicyProfileSchema.parse(value);
}

export async function readPolicyFile(path: string): Promise<NipmodPolicy> {
  return parsePolicy(JSON.parse(await readFile(path, "utf8")) as unknown);
}

export function parsePolicy(value: unknown): NipmodPolicy {
  return PolicySchema.parse(value);
}

export function evaluateTrustReportPolicy(report: TrustReport, policy: NipmodPolicy = defaultPolicy()): PolicyDecision {
  const subject = `${report.canonical}@${report.version}`;
  const rules = [
    ruleResult({
      actual: report.verdict,
      expected: "verified",
      field: "verdict",
      passed: !policy.rules.requireVerified || report.verdict === "verified",
      ruleId: "require-verified"
    }),
    ruleResult({
      actual: report.trust.score,
      expected: `>=${policy.rules.minimumTrustScore}`,
      field: "trust.score",
      passed: report.trust.score >= policy.rules.minimumTrustScore,
      ruleId: "minimum-trust-score"
    }),
    ruleResult({
      actual: report.permissions.summary,
      expected: "known permissions",
      field: "permissions",
      passed: !policy.rules.blockUnknownPermissions || report.permissions.summary !== "permissions unknown",
      ruleId: "known-permissions"
    }),
    ruleResult({
      actual: report.permissions.exec,
      expected: false,
      field: "permissions.exec",
      passed: !policy.rules.blockedPermissions.exec || !report.permissions.exec,
      ruleId: "block-exec"
    }),
    ruleResult({
      actual: report.permissions.postinstall,
      expected: false,
      field: "permissions.postinstall",
      passed: !policy.rules.blockedPermissions.postinstall || !report.permissions.postinstall,
      ruleId: "block-postinstall"
    }),
    ruleResult({
      actual: report.permissions.counts.secrets,
      expected: 0,
      field: "permissions.secrets",
      passed: !policy.rules.blockedPermissions.secrets || report.permissions.counts.secrets === 0,
      ruleId: "block-secrets"
    }),
    ruleResult({
      actual: report.permissions.counts.mcpTools,
      expected: 0,
      field: "permissions.mcpTools",
      passed: !blockedMcpTools(policy) || report.permissions.counts.mcpTools === 0,
      ruleId: "block-mcp-tools"
    }),
    ruleResult({
      actual: unknownPatternCount(report),
      expected: 0,
      field: "permissions.patterns",
      passed: !policy.rules.blockUnknownPermissions || unknownPatternCount(report) === 0,
      ruleId: "require-permission-patterns"
    }),
    ruleResult({
      actual: report.quarantine?.active ?? false,
      expected: false,
      field: "quarantine.active",
      passed: report.quarantine?.active !== true,
      ruleId: "block-quarantine"
    })
  ];
  return decisionFromRules(subject, policy.profile, rules);
}

export async function checkInstalledPolicy(projectDir: string, policy: NipmodPolicy = defaultPolicy()): Promise<PolicyCheckResult> {
  const text = await readOptionalFile(join(projectDir, "nipmod.lock.json"));
  if (!text) {
    return checkPolicyPackages({}, policy);
  }
  const lockfile = PolicyLockfileSchema.parse(JSON.parse(text) as unknown);
  return checkPolicyPackages(lockfile.packages, policy);
}

export function checkLockfilePolicy(lockfile: Lockfile, policy: NipmodPolicy = defaultPolicy()): PolicyCheckResult {
  return checkPolicyPackages(lockfile.packages, policy);
}

function checkPolicyPackages(
  lockfilePackages: Record<string, PolicyLockfilePackage>,
  policy: NipmodPolicy = defaultPolicy()
): PolicyCheckResult {
  const packages = Object.entries(lockfilePackages).map(([key, pkg]) => {
    const expectedKey = `${pkg.canonical}@${pkg.version}`;
    const permissionDecision = evaluatePermissionPolicy(pkg, policy);
    const keyRule = ruleResult({
      actual: key,
      expected: expectedKey,
      field: "lockfile.key",
      passed: key === expectedKey,
      ruleId: "lockfile-key"
    });
    const decision = decisionFromRules(expectedKey, policy.profile, [keyRule, ...permissionDecision.rules]);
    return {
      canonical: pkg.canonical,
      decision,
      name: pkg.name,
      version: pkg.version
    };
  });
  const summary = {
    allow: packages.filter((pkg) => pkg.decision.allowed).length,
    block: packages.filter((pkg) => !pkg.decision.allowed).length,
    total: packages.length
  };
  return {
    allowed: summary.block === 0,
    formatVersion: 1,
    packages,
    policy,
    summary
  };
}

function evaluatePermissionPolicy(pkg: PolicyLockfilePackage, policy: NipmodPolicy): PolicyDecision {
  const rules = [
    ruleResult({
      actual: pkg.permissions.exec.allowed,
      expected: false,
      field: "permissions.exec",
      passed: !policy.rules.blockedPermissions.exec || !pkg.permissions.exec.allowed,
      ruleId: "block-exec"
    }),
    ruleResult({
      actual: pkg.permissions.postinstall.allowed,
      expected: false,
      field: "permissions.postinstall",
      passed: !policy.rules.blockedPermissions.postinstall || !pkg.permissions.postinstall.allowed,
      ruleId: "block-postinstall"
    }),
    ruleResult({
      actual: pkg.permissions.secrets.length,
      expected: 0,
      field: "permissions.secrets",
      passed: !policy.rules.blockedPermissions.secrets || pkg.permissions.secrets.length === 0,
      ruleId: "block-secrets"
    }),
    ruleResult({
      actual: pkg.permissions.mcpTools.length,
      expected: 0,
      field: "permissions.mcpTools",
      passed: !blockedMcpTools(policy) || pkg.permissions.mcpTools.length === 0,
      ruleId: "block-mcp-tools"
    })
  ];
  rules.push(...permissionScopeRules("filesystem", pkg.permissions.filesystem, policy));
  rules.push(...permissionScopeRules("network", pkg.permissions.network, policy));
  rules.push(...permissionScopeRules("env", pkg.permissions.env, policy));
  rules.push(...permissionScopeRules("mcpTools", pkg.permissions.mcpTools, policy));
  rules.push(...permissionScopeRules("secrets", pkg.permissions.secrets, policy));
  return decisionFromRules(`${pkg.canonical}@${pkg.version}`, policy.profile, rules);
}

function blockedMcpTools(policy: NipmodPolicy): boolean {
  return policy.rules.blockedPermissions.mcpTools ?? true;
}

function unknownPatternCount(report: TrustReport): number {
  return (
    report.permissions.counts.env +
    report.permissions.counts.filesystem +
    report.permissions.counts.mcpTools +
    report.permissions.counts.network +
    report.permissions.counts.secrets
  );
}

function permissionScopeRules(
  kind: PermissionScopeKind,
  values: readonly string[],
  policy: NipmodPolicy
): PolicyRuleResult[] {
  if (!policy.rules.blockUnknownPermissions) {
    return [];
  }
  return values
    .map((value, index) => {
      const issue = permissionScopeIssue(kind, value);
      if (!issue) {
        return null;
      }
      return ruleResult({
        actual: "unsafe permission scope",
        expected: "safe permission scope",
        field: `permissions.${kind}.${index}`,
        passed: false,
        ruleId: ruleIdForScopeIssue(kind, issue)
      });
    })
    .filter((rule): rule is PolicyRuleResult => rule !== null);
}

function ruleIdForScopeIssue(kind: PermissionScopeKind, issue: PermissionScopeIssue): string {
  switch (issue.code) {
    case "filesystem-wildcard":
      return "block-filesystem-wildcard";
    case "filesystem-write":
      return "block-filesystem-write";
    case "network-wildcard":
      return "block-network-wildcard";
    case "env-secret-like":
      return "block-env-secret-like";
    case "mcp-wildcard":
      return "block-mcp-wildcard";
    case "secrets-not-supported":
      return "block-secrets";
    default:
      return `block-${kind}-unknown-pattern`;
  }
}

function ruleResult(options: {
  actual: unknown;
  expected: unknown;
  field: string;
  passed: boolean;
  ruleId: string;
}): PolicyRuleResult {
  return {
    actual: options.actual,
    expected: options.expected,
    field: options.field,
    ruleId: options.ruleId,
    status: options.passed ? "pass" : "fail"
  };
}

function decisionFromRules(subject: string, profile: PolicyProfile, rules: PolicyRuleResult[]): PolicyDecision {
  const failed = rules.filter((rule) => rule.status === "fail");
  return {
    allowed: failed.length === 0,
    formatVersion: 1,
    profile,
    reasons: failed.map((rule) => reasonForRule(profile, rule)),
    rules,
    subject
  };
}

function reasonForRule(profile: PolicyProfile, rule: PolicyRuleResult): string {
  switch (rule.ruleId) {
    case "require-verified":
      return `package must be verified by ${profile}`;
    case "minimum-trust-score":
      return `trust score is below ${profile} minimum`;
    case "known-permissions":
      return `permissions are unknown under ${profile}`;
    case "block-exec":
      return `permission exec is blocked by ${profile}`;
    case "block-postinstall":
      return `permission postinstall is blocked by ${profile}`;
    case "block-secrets":
      return `permission secrets is blocked by ${profile}`;
    case "block-mcp-tools":
      return `permission mcpTools is blocked by ${profile}`;
    case "require-permission-patterns":
      return `permission pattern details are required by ${profile}`;
    case "block-filesystem-wildcard":
      return `permission filesystem wildcard is blocked by ${profile}`;
    case "block-filesystem-write":
      return `permission filesystem write is blocked by ${profile}`;
    case "block-network-wildcard":
      return `permission network wildcard is blocked by ${profile}`;
    case "block-env-secret-like":
      return `permission env secret-like variable is blocked by ${profile}`;
    case "block-mcp-wildcard":
      return `permission mcpTools wildcard is blocked by ${profile}`;
    case "block-quarantine":
      return `quarantined packages are blocked by ${profile}`;
    case "lockfile-key":
      return `lockfile package key must match package identity under ${profile}`;
    default:
      return `${rule.field} violates ${profile}`;
  }
}
