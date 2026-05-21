import type { RegistryPackage } from "./registry";

export interface PackageQuality {
  checks: Array<{ label: string; ok: boolean }>;
  label: "Excellent" | "Good" | "Review";
  score: number;
}

export interface PackageAuditSummary {
  command: string;
  items: Array<{ label: string; value: string }>;
  status: "Ready" | "Review";
}

const agentTypes = new Set(["adapter", "agent-profile", "eval-pack", "mcp-server", "policy-pack", "skill", "tool-bundle", "workflow-pack"]);

export function packageQuality(pkg: RegistryPackage): PackageQuality {
  const verifiedTrust = pkg.trust.level === "verified" && pkg.trust.score >= 100;
  const quietPermissions = hasQuietPermissions(pkg);
  const sourceLinked = Boolean(pkg.sourceRepo && pkg.sourceCommit && pkg.sourceTag);
  const noActiveAdvisory = !hasActiveAdvisory(pkg);
  const agentTyped = agentTypes.has(pkg.type);

  const score =
    trustPoints(pkg) +
    (quietPermissions ? 20 : 0) +
    (sourceLinked ? 15 : 0) +
    (noActiveAdvisory ? 15 : 0) +
    (agentTyped ? 10 : 0);

  return {
    checks: [
      { label: "Verified trust", ok: verifiedTrust },
      { label: "Quiet permissions", ok: quietPermissions },
      { label: "Source linked", ok: sourceLinked },
      { label: "No active advisory", ok: noActiveAdvisory },
      { label: "Agent typed", ok: agentTyped }
    ],
    label: score >= 90 ? "Excellent" : score >= 70 ? "Good" : "Review",
    score
  };
}

export function packageQualityStats(packages: readonly RegistryPackage[]): Array<{ label: string; value: string }> {
  const qualities = packages.map(packageQuality);
  const average = qualities.length > 0 ? Math.round(qualities.reduce((sum, item) => sum + item.score, 0) / qualities.length) : 0;
  return [
    { label: "Quality avg", value: String(average) },
    { label: "Excellent", value: String(qualities.filter((item) => item.label === "Excellent").length) },
    { label: "Needs review", value: String(qualities.filter((item) => item.label === "Review").length) }
  ];
}

export function trendingPackages(packages: readonly RegistryPackage[], limit = 6): RegistryPackage[] {
  return [...packages]
    .sort((left, right) => trendScore(right) - trendScore(left) || right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name))
    .slice(0, limit);
}

export function newPackages(packages: readonly RegistryPackage[], limit = 6): RegistryPackage[] {
  return [...packages].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name)).slice(0, limit);
}

export function auditSummaryForPackage(pkg: RegistryPackage): PackageAuditSummary {
  const quality = packageQuality(pkg);
  const status = quality.score >= 90 && pkg.trust.level === "verified" && !hasActiveAdvisory(pkg) ? "Ready" : "Review";
  const spec = `${pkg.canonical}@${pkg.version}`;
  return {
    command: `nipmod inspect ${spec} --json\nnipmod install --plan ${spec} --json`,
    items: [
      { label: "Trust", value: `${pkg.trust.level}/${pkg.trust.score}` },
      { label: "Quality", value: `${quality.score}/100` },
      { label: "Permissions", value: hasQuietPermissions(pkg) ? "quiet" : "requested" },
      { label: "Advisory", value: hasActiveAdvisory(pkg) ? "active" : "clear" }
    ],
    status
  };
}

function trustPoints(pkg: RegistryPackage): number {
  if (pkg.trust.level === "verified" && pkg.trust.score >= 100) return 40;
  if (pkg.trust.score >= 80) return 35;
  if (pkg.trust.score >= 50) return 25;
  if (pkg.trust.score > 0) return 10;
  return 0;
}

function trendScore(pkg: RegistryPackage): number {
  return packageQuality(pkg).score + pkg.stars * 12;
}

function hasQuietPermissions(pkg: RegistryPackage): boolean {
  return (
    pkg.permissions.env === 0 &&
    pkg.permissions.filesystem === 0 &&
    pkg.permissions.mcpTools === 0 &&
    pkg.permissions.network === 0 &&
    pkg.permissions.secrets === 0 &&
    !pkg.permissions.exec &&
    !pkg.permissions.postinstall
  );
}

function hasActiveAdvisory(pkg: RegistryPackage): boolean {
  return activeQuarantine(pkg) !== null || activeYank(pkg) !== null;
}

function activeQuarantine(pkg: RegistryPackage): NonNullable<RegistryPackage["quarantine"]> | null {
  const quarantine = pkg.quarantine;
  if (!quarantine || quarantine.status !== "active" || quarantine.active === false) {
    return null;
  }
  if (quarantine.package !== pkg.canonical || quarantine.version !== pkg.version) {
    return null;
  }
  if (quarantine.artifactSha256 && quarantine.artifactSha256 !== pkg.digest) {
    return null;
  }
  if (quarantine.severity !== "high" && quarantine.severity !== "critical") {
    return null;
  }
  return quarantine;
}

function activeYank(pkg: RegistryPackage): NonNullable<RegistryPackage["yanked"]> | null {
  const yank = pkg.yanked;
  if (!yank || yank.active === false) {
    return null;
  }
  if (yank.package !== pkg.canonical || yank.version !== pkg.version) {
    return null;
  }
  return yank;
}
