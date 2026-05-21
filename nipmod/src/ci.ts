import { auditProject, type AuditPackageResult, type AuditProjectOptions, type AuditResult } from "./audit.js";

export type CiPolicyProfile = "strict-ci";

export interface CiViolation {
  canonical: string;
  findings: string[];
  status: Exclude<AuditPackageResult["status"], "ok">;
  version: string;
}

export interface CiResult {
  audit: AuditResult;
  policyProfile: CiPolicyProfile;
  ready: boolean;
  violations: CiViolation[];
}

export interface CiProjectOptions extends AuditProjectOptions {
  policyProfile?: CiPolicyProfile;
}

export async function ciProject(projectDir: string, options: CiProjectOptions = {}): Promise<CiResult> {
  const audit = await auditProject(projectDir, options);
  const policyProfile = options.policyProfile ?? "strict-ci";
  const violations = audit.packages.flatMap((pkg) => ciViolations(pkg));

  return {
    audit,
    policyProfile,
    ready: violations.length === 0,
    violations
  };
}

function ciViolations(pkg: AuditPackageResult): CiViolation[] {
  if (pkg.status === "ok") {
    return [];
  }

  return [
    {
      canonical: pkg.canonical,
      findings: pkg.findings,
      status: pkg.status,
      version: pkg.version
    }
  ];
}
