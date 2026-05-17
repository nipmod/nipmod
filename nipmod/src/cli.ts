#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditProject, type AuditProjectOptions, type AuditResult } from "./audit.js";
import { packProject, verifyBundle } from "./bundle.js";
import { ciProject, type CiPolicyProfile, type CiResult } from "./ci.js";
import {
  DEFAULT_GITLAWB_NODE,
  createPublishDryRunPlan,
  doctorGitlawb,
  fetchGitlawbBundle,
  parseRemoteSpecifier,
  publishGitlawbPackage,
  type DoctorGitlawbResult,
  type PublishGitlawbPackageOptions
} from "./gitlawb.js";
import { generateIdentity, type Identity } from "./identity.js";
import { digestFromIntegrity } from "./integrity.js";
import {
  checkInstalledPolicy,
  defaultPolicy,
  evaluateTrustReportPolicy,
  parsePolicyProfile,
  readPolicyFile,
  type NipmodPolicy
} from "./policy.js";
import {
  createRegistryInstallPlan,
  executeInstallPlan,
  formatInstallPlan,
  resolveAddInstallPlan,
  type RegistryTrustOptions
} from "./install-plan.js";
import { installBundlePackage, installFilePackage, listInstalledPackages, uninstallPackage } from "./install.js";
import { validateManifest, type Manifest } from "./protocol.js";
import { DEFAULT_REGISTRY_URL, searchRegistries, searchRegistry, type RegistrySearchResult } from "./registry.js";
import { startSetupServer } from "./setup-web.js";
import { serveNipmodMcpStdio } from "./mcp-server.js";
import {
  inspectBundleFile,
  inspectRegistryPackage,
  type TrustReport,
  type TrustReportVerdict
} from "./trust-report.js";

interface CliResult {
  ok: boolean;
  data?: unknown;
  exitCode?: number;
}

const CLI_COMMANDS = [
  "init",
  "pack",
  "package",
  "publish",
  "manifest",
  "verify",
  "install",
  "add",
  "ls",
  "uninstall",
  "doctor",
  "audit",
  "ci",
  "inspect",
  "search",
  "policy",
  "mcp",
  "setup-cloudflare"
] as const;

const CLI_EXIT_CODES = [
  { code: 0, meaning: "ok" },
  { code: 1, meaning: "usage or unexpected error" },
  { code: 7, meaning: "trust or advisory block" },
  { code: 12, meaning: "preflight not ready" }
] as const;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const rest = args.slice(1);
  const wantsJson = command !== "mcp" && hasFlag(rest, "--json");

  try {
    const result = await runCommand(command, rest);
    if (wantsJson) {
      process.stdout.write(`${JSON.stringify(result)}\n`);
      process.exitCode = result.exitCode;
      return;
    }

    if (result.data && typeof result.data === "object" && "message" in result.data) {
      process.stdout.write(`${String(result.data.message)}\n`);
    }
    process.exitCode = result.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    if (wantsJson) {
      process.stdout.write(`${JSON.stringify({ ok: false, error: { message }, exitCode: 1 })}\n`);
      process.exitCode = 1;
      return;
    }
    process.stderr.write(`nipmod: ${message}\n`);
    process.exitCode = 1;
  }
}

async function runCommand(command: string | undefined, args: string[]): Promise<CliResult> {
  switch (command) {
    case undefined:
    case "help":
    case "--help":
    case "-h":
      return helpCommand();
    case "init":
      return initCommand(args);
    case "pack":
      return packCommand(args);
    case "package":
      return packageCommand(args);
    case "publish":
      return publishCommand(args);
    case "manifest":
      return manifestCommand(args);
    case "verify":
      return verifyCommand(args);
    case "install":
      return installCommand(args);
    case "add":
      return addCommand(args);
    case "ls":
      return listCommand(args);
    case "uninstall":
      return uninstallCommand(args);
    case "doctor":
      return doctorCommand(args);
    case "audit":
      return auditCommand(args);
    case "ci":
      return ciCommand(args);
    case "inspect":
      return inspectCommand(args);
    case "search":
      return searchCommand(args);
    case "policy":
      return policyCommand(args);
    case "mcp":
      return mcpCommand(args);
    case "setup-cloudflare":
      return setupCloudflareCommand(args);
    default:
      throw new Error(`usage: nipmod <${CLI_COMMANDS.join("|")}>`);
  }
}

async function helpCommand(): Promise<CliResult> {
  const message = [
    "usage: nipmod <command>",
    "",
    `commands: ${CLI_COMMANDS.join(", ")}`,
    "",
    "exit codes:",
    ...CLI_EXIT_CODES.map((item) => `${item.code} ${item.meaning}`)
  ].join("\n");

  return {
    ok: true,
    data: {
      message,
      commands: [...CLI_COMMANDS],
      exitCodes: [...CLI_EXIT_CODES]
    }
  };
}

async function initCommand(args: string[]): Promise<CliResult> {
  const name = requireFlagValue(args, "--name");
  const dir = requireFlagValue(args, "--dir");
  const packageSlug = unscopedName(name);
  const identity = generateIdentity();
  const did = identity.did;
  const manifest: Manifest = {
    formatVersion: 1,
    name,
    canonical: `pkg:${did}/${packageSlug}`,
    version: "0.1.0",
    type: "skill",
    description: `${name} agent package`,
    license: "MIT",
    exports: {
      ".": {
        skill: "./SKILL.md"
      }
    },
    files: ["README.md", "SKILL.md", "nipmod.json"],
    permissions: {
      filesystem: [],
      network: [],
      mcpTools: [],
      env: [],
      secrets: [],
      exec: {
        allowed: false
      },
      postinstall: {
        allowed: false
      }
    },
    publish: {
      signingKey: did,
      provenance: "local"
    }
  };

  await mkdir(dir, { recursive: true });
  await mkdir(join(dir, ".nipmod"), { recursive: true });
  await writeFile(join(dir, "README.md"), `# ${name}\n\nAgent package scaffolded by nipmod.\n`);
  await writeFile(join(dir, "SKILL.md"), `# ${name}\n\nReusable agent skill package.\n`);
  await writeFile(join(dir, "nipmod.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(dir, ".gitignore"), ".nipmod/identity.json\n");
  await writeFile(join(dir, ".nipmod", "identity.json"), `${JSON.stringify(identity, null, 2)}\n`, {
    mode: 0o600
  });

  return {
    ok: true,
    data: {
      message: `initialized ${name}`,
      dir
    }
  };
}

async function packCommand(args: string[]): Promise<CliResult> {
  const projectDir = firstPositional(args);
  const outDir = optionalFlagValue(args, "--out") ?? projectDir;
  const identity = await readLocalIdentity(projectDir, optionalFlagValue(args, "--identity") ?? undefined);
  const packed = await packProject(projectDir, {
    signingPrivateKeyPem: identity.privateKeyPem
  });
  const filename = `${filenameSafePackageName(packed.manifest.name)}-${packed.manifest.version}.nipmod`;
  const path = join(outDir, filename);

  await mkdir(outDir, { recursive: true });
  await writeFile(path, packed.bytes);

  return {
    ok: true,
    data: {
      message: `packed ${packed.manifest.name}`,
      path,
      digest: packed.digest
    }
  };
}

async function packageCommand(args: string[]): Promise<CliResult> {
  const input = firstPositional(args);
  const repo = parseGitlawbRepoInput(input);
  const dir = optionalFlagValue(args, "--dir") ?? repo.repoName;
  const version = optionalFlagValue(args, "--version") ?? "0.1.0";
  const packageType = packageDraftType(optionalFlagValue(args, "--type") ?? "tool-bundle");
  const manifest: Manifest = {
    formatVersion: 1,
    name: repo.repoName,
    canonical: `pkg:${repo.ownerDid}/${repo.repoName}`,
    version,
    type: packageType,
    description: `${repo.repoName} package draft from Gitlawb source`,
    license: "NOASSERTION",
    exports: {
      ".": {
        source: "./README.md"
      }
    },
    files: ["README.md", "nipmod.json"],
    permissions: {
      filesystem: [],
      network: [],
      mcpTools: [],
      env: [],
      secrets: [],
      exec: {
        allowed: false
      },
      postinstall: {
        allowed: false
      }
    },
    publish: {
      signingKey: repo.ownerDid,
      provenance: repo.source
    }
  };
  const validated = validateManifest(manifest);

  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "README.md"),
    [
      `# ${repo.repoName}`,
      "",
      `Gitlawb source: ${repo.source}`,
      "",
      "This is an unsigned nipmod package draft. The repo owner must claim it with the matching DID identity before publish.",
      ""
    ].join("\n")
  );
  await writeFile(join(dir, "nipmod.json"), `${JSON.stringify(validated, null, 2)}\n`);

  const claimCommand = `nipmod publish ${dir} --dry-run`;
  return {
    ok: true,
    data: {
      message: `created package draft ${validated.canonical}`,
      claimCommand,
      draft: {
        canonical: validated.canonical,
        dir,
        manifestPath: join(dir, "nipmod.json"),
        repo: repo.repoName,
        source: repo.source,
        version: validated.version
      },
      nextCommands: [`nipmod manifest validate --dir ${dir}`, claimCommand]
    }
  };
}

async function verifyCommand(args: string[]): Promise<CliResult> {
  const path = firstPositional(args);
  const expectedDigest = digestFromIntegrity(requireFlagValue(args, "--integrity"));
  const bytes = await readFile(path);
  const bundle = verifyBundle(bytes, expectedDigest, { requireSignature: true });

  return {
    ok: true,
    data: {
      message: `verified ${bundle.manifest.name}`,
      package: bundle.manifest.canonical,
      version: bundle.manifest.version
    }
  };
}

async function publishCommand(args: string[]): Promise<CliResult> {
  const projectDir = firstPositional(args);
  const helperPath = optionalFlagValue(args, "--helper");
  const identityPath = optionalFlagValue(args, "--identity");
  if (hasFlag(args, "--dry-run")) {
    const plan = await createPublishDryRunPlan({
      projectDir,
      nodeUrl: configuredNodeUrl(args),
      ...(helperPath ? { helperPath } : {}),
      ...(identityPath ? { identityPath } : {})
    });
    return {
      ok: plan.ready,
      data: {
        message: formatPublishDryRunPlan(plan),
        plan
      },
      exitCode: plan.ready ? 0 : 12
    };
  }
  const options: PublishGitlawbPackageOptions = {
    projectDir,
    nodeUrl: configuredNodeUrl(args)
  };
  if (helperPath) {
    options.helperPath = helperPath;
  }
  if (identityPath) {
    options.identityPath = identityPath;
  }

  const result = await publishGitlawbPackage(options);
  return {
    ok: true,
    data: {
      message: `published ${result.package}@${result.version}`,
      package: result.package,
      version: result.version,
      digest: result.digest,
      resolved: result.resolved,
      sourceCommit: result.sourceCommit,
      registryCandidate: result.registryCandidate
    }
  };
}

async function manifestCommand(args: string[]): Promise<CliResult> {
  const subcommand = args[0];
  const rest = args.slice(1);
  switch (subcommand) {
    case "validate":
      return manifestValidateCommand(rest);
    default:
      throw new Error("usage: nipmod manifest validate --dir <package>");
  }
}

async function manifestValidateCommand(args: string[]): Promise<CliResult> {
  const dir = optionalFlagValue(args, "--dir") ?? process.cwd();
  const manifest = validateManifest(JSON.parse(await readFile(join(dir, "nipmod.json"), "utf8")));
  return {
    ok: true,
    data: {
      message: `manifest valid ${manifest.name}@${manifest.version}`,
      manifest
    }
  };
}

async function installCommand(args: string[]): Promise<CliResult> {
  const spec = firstPositional(args);
  const dir = optionalFlagValue(args, "--dir") ?? process.cwd();
  if (hasFlag(args, "--plan")) {
    const plan = await createRegistryInstallPlan({
      ...registryTrustFlags(args, "install --plan"),
      action: "install",
      policy: await optionalPolicyFromFlags(args),
      projectDir: dir,
      specifier: spec
    });
    return {
      ok: plan.readyToInstall,
      data: {
        message: formatInstallPlan(plan),
        plan
      },
      exitCode: plan.readyToInstall ? 0 : installPlanExitCode(plan)
    };
  }

  const integrity = requireFlagValue(args, "--integrity");
  if (spec.startsWith("pkg:")) {
    const expected = parseRemoteSpecifier(spec);
    const remote = await fetchGitlawbBundle({
      nodeUrl: configuredNodeUrl(args),
      spec: expected
    });
    const result = await installBundlePackage(remote.bytes, remote.resolved, dir, {
      integrity,
      expected: {
        canonical: expected.canonical,
        version: expected.version
      }
    });
    return {
      ok: true,
      data: {
        message: result.lockfileChanged ? "installed package" : "package already installed",
        lockfileChanged: result.lockfileChanged
      }
    };
  }

  const result = await installFilePackage(parseFileSpecifier(spec), dir, { integrity });
  return {
    ok: true,
    data: {
      message: result.lockfileChanged ? "installed package" : "package already installed",
      lockfileChanged: result.lockfileChanged
    }
  };
}

async function addCommand(args: string[]): Promise<CliResult> {
  const query = firstPositional(args);
  const dir = optionalFlagValue(args, "--dir") ?? process.cwd();
  const plan = await resolveAddInstallPlan({
    ...registryTrustFlags(args, "add"),
    policy: await optionalPolicyFromFlags(args),
    projectDir: dir,
    query
  });
  if (!plan.readyToInstall) {
    return {
      ok: false,
      data: {
        message: formatInstallPlan(plan),
        plan
      },
      exitCode: installPlanExitCode(plan)
    };
  }

  const result = await executeInstallPlan(plan, {
    nodeUrl: configuredNodeUrl(args),
    projectDir: dir
  });
  return {
    ok: true,
    data: {
      message: result.lockfileChanged ? "added package" : "package already installed",
      ...(plan.graph ? { graphPackageCount: plan.graph.packageCount } : {}),
      integrity: plan.integrity,
      lockfileChanged: result.lockfileChanged,
      package: plan.package.canonical,
      resolved: plan.resolved,
      version: plan.package.version
    }
  };
}

async function listCommand(args: string[]): Promise<CliResult> {
  const dir = optionalFlagValue(args, "--dir") ?? process.cwd();
  const packages = await listInstalledPackages(dir);
  const lines = packages.length > 0 ? packages.map((pkg) => `${pkg.name}@${pkg.version} ${pkg.canonical}`) : ["no packages installed"];
  return {
    ok: true,
    data: {
      message: lines.join("\n"),
      packages
    }
  };
}

async function uninstallCommand(args: string[]): Promise<CliResult> {
  const query = firstPositional(args);
  const dir = optionalFlagValue(args, "--dir") ?? process.cwd();
  const result = await uninstallPackage(query, dir);
  return {
    ok: true,
    data: {
      message: result.removed ? `uninstalled ${query}` : `package not installed: ${query}`,
      ...result
    }
  };
}

async function doctorCommand(args: string[]): Promise<CliResult> {
  const doctor = await doctorGitlawb({
    nodeUrl: configuredNodeUrl(args),
    offline: hasFlag(args, "--offline")
  });

  return {
    ok: true,
    data: {
      message: formatDoctor(doctor),
      ready: doctor.ready,
      nodeUrl: doctor.nodeUrl,
      checks: doctor.checks,
      installCommand: doctor.installCommand
    }
  };
}

async function auditCommand(args: string[]): Promise<CliResult> {
  assertCustomTrustRoots(args, "audit");
  const { dir, options } = auditProjectOptionsFromFlags(args, "audit");
  const result = await auditProject(dir, options);
  const policyCheck = hasPolicyFlags(args) ? await checkInstalledPolicy(dir, await policyFromFlags(args)) : undefined;

  return {
    ok: result.ready,
    data: {
      message: formatAudit(result),
      ...result,
      ...(policyCheck ? { policyCheck } : {})
    },
    exitCode: result.ready ? 0 : 6
  };
}

async function ciCommand(args: string[]): Promise<CliResult> {
  assertCustomTrustRoots(args, "ci");
  const { dir, options } = auditProjectOptionsFromFlags(args, "ci");
  const policyProfile = ciPolicyProfile(args);
  const result = await ciProject(dir, {
    ...options,
    policyProfile
  });
  const policyCheck = await checkInstalledPolicy(dir, defaultPolicy(policyProfile));
  const ready = result.ready && policyCheck.allowed;

  return {
    ok: ready,
    data: {
      message: policyCheck.allowed ? formatCi(result) : `${formatCi({ ...result, ready })}\n${formatPolicyCheck(policyCheck)}`,
      ...result,
      ready,
      policyCheck
    },
    exitCode: ready ? 0 : 8
  };
}

function assertCustomTrustRoots(
  args: readonly string[],
  commandName: string,
  flags: readonly string[] = ["--advisory-key", "--advisory-key-sha256", "--log-id", "--witness"]
): void {
  const hasCustomRootFlag = flags.some((flag) => hasFlag(args, flag));
  if (hasCustomRootFlag && !hasFlag(args, "--allow-custom-roots")) {
    throw new Error(`${commandName} custom trust roots require --allow-custom-roots`);
  }
}

function auditProjectOptionsFromFlags(
  args: readonly string[],
  commandName: "audit" | "ci"
): { dir: string; options: AuditProjectOptions } {
  const dir = optionalFlagValue(args, "--dir") ?? process.cwd();
  const registryUrl = optionalFlagValue(args, "--registry");
  const advisoriesUrl = optionalFlagValue(args, "--advisories");
  const advisoriesSignatureUrl = optionalFlagValue(args, "--advisories-signature");
  const advisoryPublicKeySpkiBase64 = optionalFlagValue(args, "--advisory-key");
  const advisoryPublicKeySpkiSha256 = optionalFlagValue(args, "--advisory-key-sha256");
  const allowedLogIds = optionalFlagValues(args, "--log-id");
  const allowedWitnesses = optionalFlagValues(args, "--witness");
  if ((!registryUrl || !advisoriesUrl) && !hasFlag(args, "--online")) {
    throw new Error(`${commandName} network access requires --online or both --registry and --advisories`);
  }
  if ((allowedLogIds.length > 0 && allowedWitnesses.length === 0) || (allowedWitnesses.length > 0 && allowedLogIds.length === 0)) {
    throw new Error(`${commandName} transparency pins require both --log-id and --witness`);
  }
  if (
    (advisoryPublicKeySpkiBase64 && !advisoryPublicKeySpkiSha256) ||
    (advisoryPublicKeySpkiSha256 && !advisoryPublicKeySpkiBase64)
  ) {
    throw new Error(`${commandName} advisory key pins require both --advisory-key and --advisory-key-sha256`);
  }
  const options: AuditProjectOptions = {};
  const discoveryUrl = optionalFlagValue(args, "--discovery");
  if (advisoriesUrl) {
    options.advisoriesUrl = advisoriesUrl;
  }
  if (advisoriesSignatureUrl) {
    options.advisoriesSignatureUrl = advisoriesSignatureUrl;
  }
  if (advisoryPublicKeySpkiBase64) {
    options.advisoryPublicKeySpkiBase64 = advisoryPublicKeySpkiBase64;
  }
  if (advisoryPublicKeySpkiSha256) {
    options.advisoryPublicKeySpkiSha256 = advisoryPublicKeySpkiSha256;
  }
  if (discoveryUrl) {
    options.discoveryUrl = discoveryUrl;
  }
  if (registryUrl) {
    options.registryUrl = registryUrl;
  }
  if (allowedLogIds.length > 0) {
    options.allowedLogIds = allowedLogIds;
  }
  if (allowedWitnesses.length > 0) {
    options.allowedWitnesses = allowedWitnesses;
  }

  return { dir, options };
}

function ciPolicyProfile(args: readonly string[]): CiPolicyProfile {
  const profile = optionalFlagValue(args, "--profile") ?? "strict-ci";
  if (profile !== "strict-ci") {
    throw new Error("ci --profile must be strict-ci");
  }
  return profile;
}

function formatAudit(audit: AuditResult): string {
  const lines = [`nipmod audit ${audit.ready ? "passed" : "failed"}`];
  lines.push(`OK ${audit.summary.ok} WARN ${audit.summary.warn} FAIL ${audit.summary.fail}`);
  for (const pkg of audit.packages) {
    lines.push(`${pkg.status.toUpperCase()} ${pkg.canonical}@${pkg.version}: ${pkg.findings.join("; ") || "verified"}`);
  }
  return lines.join("\n");
}

function formatCi(result: CiResult): string {
  const lines = [`nipmod ci ${result.ready ? "passed" : "failed"} (${result.policyProfile})`];
  lines.push(`OK ${result.audit.summary.ok} WARN ${result.audit.summary.warn} FAIL ${result.audit.summary.fail}`);
  if (result.audit.summary.warn > 0) {
    lines.push("strict-ci blocks warnings");
  }
  for (const violation of result.violations) {
    lines.push(
      `${violation.status.toUpperCase()} ${violation.canonical}@${violation.version}: ${
        violation.findings.join("; ") || "policy violation"
      }`
    );
  }
  return lines.join("\n");
}

async function inspectCommand(args: string[]): Promise<CliResult> {
  const specifier = firstPositional(args);
  const report = specifier.startsWith("file:")
    ? await inspectBundleFile(inspectBundleFileOptions(specifier, args))
    : await inspectRegistryCommand(specifier, args);
  const policy = hasPolicyFlags(args) ? await policyFromFlags(args) : undefined;
  const policyDecision = policy ? evaluateTrustReportPolicy(report, policy) : undefined;

  return {
    ok: report.verdict !== "failed",
    data: {
      message: policyDecision ? `${formatTrustReport(report)}\n${formatPolicyDecision(policyDecision)}` : formatTrustReport(report),
      ...(policy ? { policy } : {}),
      ...(policyDecision ? { policyDecision } : {}),
      report
    },
    exitCode: report.verdict === "failed" ? 7 : 0
  };
}

function inspectBundleFileOptions(specifier: string, args: readonly string[]): { integrity?: string; path: string; subject: string } {
  const options: { integrity?: string; path: string; subject: string } = {
    path: parseFileSpecifier(specifier),
    subject: specifier
  };
  const integrity = optionalFlagValue(args, "--integrity");
  if (integrity) {
    options.integrity = integrity;
  }
  return options;
}

async function inspectRegistryCommand(specifier: string, args: string[]): Promise<TrustReport> {
  const registryUrl = optionalFlagValue(args, "--registry");
  const allowedLogIds = optionalFlagValues(args, "--log-id");
  const allowedWitnesses = optionalFlagValues(args, "--witness");
  assertCustomTrustRoots(args, "inspect", ["--log-id", "--witness"]);
  if (!registryUrl && !hasFlag(args, "--online")) {
    throw new Error("inspect network access requires --online or --registry");
  }
  if ((allowedLogIds.length > 0 && allowedWitnesses.length === 0) || (allowedWitnesses.length > 0 && allowedLogIds.length === 0)) {
    throw new Error("inspect transparency pins require both --log-id and --witness");
  }

  const options: {
    allowedLogIds?: readonly string[];
    allowedWitnesses?: readonly string[];
    registryUrl: string;
    specifier: string;
  } = {
    registryUrl: registryUrl ?? DEFAULT_REGISTRY_URL,
    specifier
  };
  if (allowedLogIds.length > 0) {
    options.allowedLogIds = allowedLogIds;
  }
  if (allowedWitnesses.length > 0) {
    options.allowedWitnesses = allowedWitnesses;
  }
  return inspectRegistryPackage(options);
}

function formatTrustReport(report: TrustReport): string {
  const lines = [`nipmod inspect ${formatVerdict(report.verdict)} ${report.canonical}@${report.version}`];
  lines.push(`trust: ${report.trust.level}/${report.trust.score}`);
  lines.push(`digest: ${report.integrity}`);
  lines.push(`publisher: ${report.publisher}`);
  lines.push(`permissions: ${report.permissions.summary}`);
  if (report.compatibilityReceipts && report.compatibilityReceipts.length > 0) {
    lines.push(`compatibility: ${report.compatibilityReceipts.map((receipt) => receipt.label).join(", ")}`);
  }
  for (const check of report.evidence) {
    lines.push(`${check.status.toUpperCase()} ${check.label}: ${check.detail}`);
  }
  if (report.findings.length > 0) {
    lines.push(`findings: ${report.findings.join("; ")}`);
  }
  if (report.installCommand) {
    lines.push(`install: ${report.installCommand}`);
  }
  return lines.join("\n");
}

function formatVerdict(verdict: TrustReportVerdict): string {
  switch (verdict) {
    case "verified":
      return "verified";
    case "signed-local":
      return "signed-local";
    case "failed":
      return "failed";
  }
}

async function searchCommand(args: string[]): Promise<CliResult> {
  const query = firstPositional(args);
  const registryUrls = registrySearchUrls(args);
  if (registryUrls.length === 0 && !hasFlag(args, "--online")) {
    throw new Error("search network access requires --online, --registry or --registries");
  }
  const result =
    registryUrls.length > 1
      ? await searchRegistries({
          includeQuarantined: hasFlag(args, "--include-quarantined"),
          limit: searchLimit(args),
          query,
          registryUrls
        })
      : await searchRegistry({
          includeQuarantined: hasFlag(args, "--include-quarantined"),
          limit: searchLimit(args),
          query,
          registryUrl: registryUrls[0] ?? DEFAULT_REGISTRY_URL
        });

  return {
    ok: true,
    data: {
      message: formatSearch(result, { details: hasFlag(args, "--details") }),
      ...result
    }
  };
}

function registrySearchUrls(args: readonly string[]): string[] {
  const explicit = [
    ...optionalFlagValues(args, "--registry"),
    ...optionalFlagValues(args, "--registries").flatMap(splitRegistryList)
  ];
  if (explicit.length > 0) {
    return [...new Set(explicit)];
  }
  return splitRegistryList(process.env.NIPMOD_REGISTRY_URLS ?? "");
}

function splitRegistryList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function policyCommand(args: string[]): Promise<CliResult> {
  const subcommand = args[0];
  const rest = args.slice(1);
  switch (subcommand) {
    case "init":
      return policyInitCommand(rest);
    case "check":
      return policyCheckCommand(rest);
    case "explain":
      return policyExplainCommand(rest);
    default:
      throw new Error("usage: nipmod policy <init|check|explain>");
  }
}

async function policyInitCommand(args: string[]): Promise<CliResult> {
  const dir = optionalFlagValue(args, "--dir") ?? process.cwd();
  const policy = defaultPolicy(parsePolicyProfile(optionalFlagValue(args, "--profile") ?? undefined));
  const path = join(dir, "nipmod.policy.json");
  await mkdir(dir, { recursive: true });
  await writeFile(path, `${JSON.stringify(policy, null, 2)}\n`);
  return {
    ok: true,
    data: {
      message: `initialized policy ${policy.profile}`,
      path,
      policy
    }
  };
}

async function policyExplainCommand(args: string[]): Promise<CliResult> {
  const specifier = firstPositional(args);
  const policy = await policyFromFlags(args);
  const report = specifier.startsWith("file:")
    ? await inspectBundleFile(inspectBundleFileOptions(specifier, args))
    : await inspectRegistryCommand(specifier, args);
  const policyDecision = evaluateTrustReportPolicy(report, policy);
  return {
    ok: policyDecision.allowed,
    data: {
      message: formatPolicyDecision(policyDecision),
      policy,
      policyDecision,
      report
    },
    exitCode: policyDecision.allowed ? 0 : 11
  };
}

async function policyCheckCommand(args: string[]): Promise<CliResult> {
  const dir = optionalFlagValue(args, "--dir") ?? process.cwd();
  const policy = await policyFromFlags(args);
  const result = await checkInstalledPolicy(dir, policy);
  return {
    ok: result.allowed,
    data: {
      message: formatPolicyCheck(result),
      ...result
    },
    exitCode: result.allowed ? 0 : 11
  };
}

function formatSearch(result: RegistrySearchResult, options: { details: boolean } = { details: false }): string {
  if (result.total === 0) {
    return `No packages found for "${result.query}"`;
  }
  const lines = [`nipmod search ${quotedSearchQuery(result.query)} - ${result.total} package${result.total === 1 ? "" : "s"}`, ""];
  lines.push(
    [
      "No.",
      padCell("Package", 28),
      padCell("Version", 8),
      padCell("Trust", 12),
      padCell("Kind", 13),
      "Permissions"
    ].join(" ")
  );
  for (const [index, pkg] of result.packages.entries()) {
    lines.push(
      [
        `${String(index + 1).padStart(2)}.`,
        padCell(pkg.name, 28),
        padCell(pkg.version, 8),
        padCell(pkg.trust, 12),
        padCell(pkg.type, 13),
        pkg.permissionSummary
      ].join(" ")
    );
    if (pkg.description) {
      lines.push(`    ${clipCell(pkg.description, 96)}`);
    }
    if (pkg.install) {
      lines.push(`    add: ${pkg.install}`);
      if (pkg.nameAmbiguous && pkg.canonicalInstall) {
        lines.push(`    security: ${pkg.canonicalInstall}`);
      }
    } else if (pkg.installBlockedReason) {
      lines.push(`    blocked: ${pkg.installBlockedReason}`);
    }
    if (options.details) {
      lines.push(`    id: ${pkg.canonical}`);
      lines.push(`    source: ${pkg.sourceRegistry}`);
    }
  }
  lines.push("", "Agents: use --json or nipmod mcp for structured output.");
  return lines.join("\n");
}

function quotedSearchQuery(query: string): string {
  return `"${query.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function padCell(value: string, width: number): string {
  return clipCell(value, width).padEnd(width, " ");
}

function clipCell(value: string, width: number): string {
  if (value.length <= width) {
    return value;
  }
  if (width <= 3) {
    return value.slice(0, width);
  }
  return `${value.slice(0, width - 3)}...`;
}

async function policyFromFlags(args: readonly string[]): Promise<NipmodPolicy> {
  const path = optionalFlagValue(args, "--policy");
  if (path) {
    return readPolicyFile(path);
  }
  return defaultPolicy(parsePolicyProfile(optionalFlagValue(args, "--profile") ?? undefined));
}

async function optionalPolicyFromFlags(args: readonly string[]): Promise<NipmodPolicy | undefined> {
  if (!hasPolicyFlags(args)) {
    return undefined;
  }
  return policyFromFlags(args);
}

function hasPolicyFlags(args: readonly string[]): boolean {
  return hasFlag(args, "--policy") || hasFlag(args, "--profile");
}

function installPlanExitCode(plan: { policyDecision?: { allowed: boolean } | undefined; readyToInstall: boolean }): number {
  if (plan.readyToInstall) {
    return 0;
  }
  return plan.policyDecision && !plan.policyDecision.allowed ? 11 : 7;
}

function formatPolicyDecision(decision: { allowed: boolean; profile: string; reasons: string[]; subject: string }): string {
  const lines = [`nipmod policy ${decision.allowed ? "allowed" : "blocked"} ${decision.subject} (${decision.profile})`];
  for (const reason of decision.reasons) {
    lines.push(`finding: ${reason}`);
  }
  return lines.join("\n");
}

function formatPolicyCheck(result: Awaited<ReturnType<typeof checkInstalledPolicy>>): string {
  const lines = [`nipmod policy check ${result.allowed ? "passed" : "blocked"} (${result.policy.profile})`];
  lines.push(`ALLOW ${result.summary.allow} BLOCK ${result.summary.block} TOTAL ${result.summary.total}`);
  for (const pkg of result.packages) {
    lines.push(`${pkg.decision.allowed ? "ALLOW" : "BLOCK"} ${pkg.canonical}@${pkg.version}`);
    for (const reason of pkg.decision.reasons) {
      lines.push(`finding: ${reason}`);
    }
  }
  return lines.join("\n");
}

function searchLimit(args: readonly string[]): number {
  const rawLimit = optionalFlagValue(args, "--limit") ?? "20";
  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("--limit must be an integer from 1 to 100");
  }
  return limit;
}

async function setupCloudflareCommand(args: string[]): Promise<CliResult> {
  const port = Number(optionalFlagValue(args, "--port") ?? "8788");
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("invalid --port");
  }

  const envPath = optionalFlagValue(args, "--env") ?? join(process.cwd(), ".env.local");
  const setup = await startSetupServer({ envPath, port });
  process.stdout.write(`Cloudflare setup: ${setup.url}\n`);
  process.stdout.write(`Secrets file: ${setup.envPath}\n`);
  await new Promise(() => {});
  return { ok: true };
}

async function mcpCommand(args: string[]): Promise<CliResult> {
  const subcommand = args[0];
  if (subcommand !== "serve" || args.length !== 1) {
    throw new Error("usage: nipmod mcp serve");
  }
  await serveNipmodMcpStdio({
    stderr: process.stderr,
    stdin: process.stdin,
    stdout: process.stdout
  });
  return { ok: true };
}

function requireFlagValue(args: readonly string[], flag: string): string {
  const value = optionalFlagValue(args, flag);
  if (!value) {
    throw new Error(`missing ${flag}`);
  }

  return value;
}

function optionalFlagValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`missing value for ${flag}`);
  }

  return value;
}

function optionalFlagValues(args: readonly string[], flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) {
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`missing value for ${flag}`);
    }
    values.push(value);
  }
  return values;
}

function hasFlag(args: readonly string[], flag: string): boolean {
  return args.includes(flag);
}

function registryTrustFlags(args: readonly string[], commandName: string): RegistryTrustOptions {
  const registryUrl = optionalFlagValue(args, "--registry");
  const allowedLogIds = optionalFlagValues(args, "--log-id");
  const allowedWitnesses = optionalFlagValues(args, "--witness");
  assertCustomTrustRoots(args, commandName, ["--log-id", "--witness"]);
  if (!registryUrl && !hasFlag(args, "--online")) {
    throw new Error(`${commandName} network access requires --online or --registry`);
  }
  if ((allowedLogIds.length > 0 && allowedWitnesses.length === 0) || (allowedWitnesses.length > 0 && allowedLogIds.length === 0)) {
    throw new Error(`${commandName} transparency pins require both --log-id and --witness`);
  }
  const options: RegistryTrustOptions = {};
  if (registryUrl) {
    options.registryUrl = registryUrl;
  }
  if (allowedLogIds.length > 0) {
    options.allowedLogIds = allowedLogIds;
  }
  if (allowedWitnesses.length > 0) {
    options.allowedWitnesses = allowedWitnesses;
  }
  return options;
}

function configuredNodeUrl(args: readonly string[]): string {
  return optionalFlagValue(args, "--node") ?? process.env.NIPMOD_NODE ?? process.env.GITLAWB_NODE ?? DEFAULT_GITLAWB_NODE;
}

function formatDoctor(doctor: DoctorGitlawbResult): string {
  const lines = [`nipmod ${doctor.ready ? "ready" : "needs setup"}`, ""];
  for (const check of doctor.checks) {
    lines.push(`${padCell(check.status.toUpperCase(), 4)} ${padCell(doctorCheckLabel(check), 16)} ${check.message}`);
    if (check.id !== "gitlawb-helper" && check.status !== "ok" && check.detail) {
      lines.push(`     ${check.detail}`);
    }
  }

  const helper = doctor.checks.find((check) => check.id === "gitlawb-helper");
  if (helper?.status === "warn") {
    lines.push("", "install and add are ready. Publish later:", `  ${helper.detail ?? doctor.installCommand}`);
  }

  return lines.join("\n");
}

function doctorCheckLabel(check: DoctorGitlawbResult["checks"][number]): string {
  return check.id === "gitlawb-helper" ? "Publish helper" : check.label;
}

function formatPublishDryRunPlan(plan: Awaited<ReturnType<typeof createPublishDryRunPlan>>): string {
  const lines = [`nipmod publish dry-run ${plan.ready ? "passed" : "blocked"}`];
  lines.push(`package: ${plan.package}@${plan.version}`);
  lines.push(`digest: sha256-${plan.digest}`);
  lines.push(`manifest: sha256-${plan.manifestDigest}`);
  lines.push(`repo: ${plan.sourceRepo}`);
  lines.push(`tag: ${plan.sourceTag}`);
  lines.push(`registry candidate: ${plan.registryCandidate.package}@${plan.registryCandidate.version}`);
  lines.push(`helper: ${plan.helper.ok ? plan.helper.message : "missing"}`);
  lines.push(`git: ${plan.git.ok ? `found at ${plan.git.path}` : "missing"}`);
  lines.push(`version: ${plan.versionCheck.status} (${plan.versionCheck.message})`);
  return lines.join("\n");
}

function firstPositional(args: readonly string[]): string {
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value) {
      continue;
    }
    if (value.startsWith("--")) {
      if (flagTakesValue(value)) {
        index += 1;
      }
      continue;
    }
    return value;
  }

  throw new Error("missing positional argument");
}

function flagTakesValue(flag: string): boolean {
  return VALUE_FLAGS.has(flag);
}

const VALUE_FLAGS = new Set([
  "--advisories",
  "--advisories-signature",
  "--advisory-key",
  "--advisory-key-sha256",
  "--dir",
  "--discovery",
  "--env",
  "--helper",
  "--identity",
  "--integrity",
  "--limit",
  "--log-id",
  "--name",
  "--node",
  "--out",
  "--policy",
  "--port",
  "--profile",
  "--registry",
  "--registries",
  "--type",
  "--version",
  "--witness"
]);

const PACKAGE_DRAFT_TYPES = new Set<Manifest["type"]>([
  "skill",
  "mcp-server",
  "tool-bundle",
  "agent-profile",
  "workflow-pack",
  "eval-pack",
  "policy-pack",
  "adapter"
]);

function packageDraftType(value: string): Manifest["type"] {
  if (PACKAGE_DRAFT_TYPES.has(value as Manifest["type"])) {
    return value as Manifest["type"];
  }

  throw new Error("--type must be skill, mcp-server, tool-bundle, agent-profile, workflow-pack, eval-pack, policy-pack, or adapter");
}

function parseGitlawbRepoInput(input: string): { ownerDid: string; ownerSegment: string; repoName: string; source: string } {
  const trimmed = input.trim().replace(/\.git$/, "");
  const direct = /^gitlawb:\/\/(did:key:z[A-Za-z0-9]+|z[A-Za-z0-9]+)\/([a-z0-9][a-z0-9_-]*)$/.exec(trimmed);
  if (direct) {
    return gitlawbRepoFromParts(requireMatch(direct[1], "owner"), requireMatch(direct[2], "repo"));
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("package input must be a gitlawb:// repo or Gitlawb web URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Gitlawb web URL must be a clean https URL");
  }
  const segments = url.pathname.split("/").filter(Boolean);
  const [owner, repo] =
    segments[0] === "node" && segments[1] === "repos" ? [segments[2], segments[3]] : [segments[0], segments[1]];
  return gitlawbRepoFromParts(requireMatch(owner, "owner"), requireMatch(repo, "repo"));
}

function requireMatch(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Gitlawb repo URL is missing ${label}`);
  }

  return value;
}

function gitlawbRepoFromParts(owner: string, repo: string): { ownerDid: string; ownerSegment: string; repoName: string; source: string } {
  const ownerDid = owner.startsWith("did:key:") ? owner : `did:key:${owner}`;
  if (!/^did:key:z[A-Za-z0-9]+$/.test(ownerDid)) {
    throw new Error("Gitlawb owner must be did:key or z-base DID segment");
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(repo)) {
    throw new Error("Gitlawb repo names currently allow only lowercase letters, numbers, hyphens, and underscores");
  }

  return {
    ownerDid,
    ownerSegment: ownerDid.slice(ownerDid.lastIndexOf(":") + 1),
    repoName: repo,
    source: `gitlawb://${ownerDid}/${repo}`
  };
}

function unscopedName(name: string): string {
  return name.split("/").at(-1) ?? name;
}

function filenameSafePackageName(name: string): string {
  return name.replace(/^@/, "").replace(/[^a-zA-Z0-9._-]+/g, "-");
}

async function readLocalIdentity(projectDir: string, path?: string): Promise<Identity> {
  const identityPath = path ?? join(projectDir, ".nipmod", "identity.json");
  const identity = JSON.parse(await readFile(identityPath, "utf8")) as Partial<Identity>;
  if (!identity.did || !identity.privateKeyPem || !identity.publicKeyPem) {
    throw new Error("local identity is incomplete");
  }

  return {
    did: identity.did,
    privateKeyPem: identity.privateKeyPem,
    publicKeyPem: identity.publicKeyPem
  };
}

function parseFileSpecifier(spec: string): string {
  if (!/^file:(?:\/\/|\/)/.test(spec)) {
    throw new Error("only absolute file: URLs are supported");
  }

  const url = new URL(spec);
  if (url.protocol !== "file:") {
    throw new Error("only file: installs are supported");
  }

  if (url.host && url.host !== "localhost") {
    throw new Error("file URL host is not supported");
  }

  return fileURLToPath(url);
}

await main();
