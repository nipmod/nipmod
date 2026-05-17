#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditProject, type AuditProjectOptions, type AuditResult } from "./audit.js";
import { packProject, verifyBundle } from "./bundle.js";
import { ciProject, type CiPolicyProfile, type CiResult } from "./ci.js";
import { explainPackage, type ExplainReport } from "./explain.js";
import {
  DEFAULT_GITLAWB_NODE,
  createPublishDryRunPlan,
  doctorGitlawb,
  fetchGitlawbBundle,
  parseRemoteSpecifier,
  publishGitlawbLifecycleEvent,
  publishGitlawbPackage,
  type DoctorGitlawbResult,
  type PublishGitlawbLifecycleEventResult,
  type PublishGitlawbPackageOptions
} from "./gitlawb.js";
import { generateIdentity, type Identity } from "./identity.js";
import { digestFromIntegrity } from "./integrity.js";
import { signLifecycleEvent } from "./lifecycle.js";
import {
  checkLockfilePolicy,
  checkInstalledPolicy,
  defaultPolicy,
  evaluateTrustReportPolicy,
  parsePolicyProfile,
  readPolicyFile,
  type NipmodPolicy,
  type PolicyCheckResult
} from "./policy.js";
import {
  executeInstallPlan,
  formatInstallPlan,
  InstallPolicyBlockedError,
  resolveAddInstallPlan,
  type RegistryTrustOptions
} from "./install-plan.js";
import {
  installBundlePackage,
  installFilePackage,
  installLockfilePackages,
  listInstalledPackages,
  uninstallPackage,
  type InstallLockfileResult
} from "./install.js";
import { type LifecycleAction, type SignedLifecycleEvent, validateManifest, type Manifest } from "./protocol.js";
import { checkOutdatedPackages, type OutdatedPackage, type OutdatedReport } from "./outdated.js";
import { generateSbom, type AgentSbom } from "./sbom.js";
import {
  DEFAULT_REGISTRY_URL,
  searchRegistries,
  searchRegistry,
  viewRegistriesPackages,
  viewRegistryPackages,
  type RegistrySearchPackage,
  type RegistrySearchResult
} from "./registry.js";
import { startSetupServer } from "./setup-web.js";
import { serveNipmodMcpStdio } from "./mcp-server.js";
import { createUpdatePlan, executeUpdatePlan, type UpdatePlan } from "./update.js";
import { NIPMOD_VERSION } from "./version.js";
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
  "dist-tag",
  "deprecate",
  "yank",
  "manifest",
  "verify",
  "install",
  "add",
  "ls",
  "uninstall",
  "outdated",
  "update",
  "explain",
  "sbom",
  "doctor",
  "audit",
  "ci",
  "inspect",
  "search",
  "view",
  "policy",
  "mcp",
  "version",
  "setup-cloudflare"
] as const;

const CLI_EXIT_CODES = [
  { code: 0, meaning: "ok" },
  { code: 1, meaning: "usage or unexpected error" },
  { code: 7, meaning: "trust or advisory block" },
  { code: 11, meaning: "install policy block" },
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
    case "--version":
    case "-v":
    case "version":
      return versionCommand();
    case "init":
      return initCommand(args);
    case "pack":
      return packCommand(args);
    case "package":
      return packageCommand(args);
    case "publish":
      return publishCommand(args);
    case "dist-tag":
      return distTagCommand(args);
    case "deprecate":
      return deprecateCommand(args);
    case "yank":
      return yankCommand(args);
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
    case "outdated":
      return outdatedCommand(args);
    case "update":
      return updateCommand(args);
    case "explain":
      return explainCommand(args);
    case "sbom":
      return sbomCommand(args);
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
    case "view":
      return viewCommand(args);
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

async function versionCommand(): Promise<CliResult> {
  return {
    ok: true,
    data: {
      message: NIPMOD_VERSION,
      version: NIPMOD_VERSION
    }
  };
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

async function distTagCommand(args: string[]): Promise<CliResult> {
  const subcommand = args[0];
  const rest = args.slice(1);
  switch (subcommand) {
    case "add": {
      const [specifier, tag] = positionalArgs(rest);
      if (!specifier || !tag) {
        throw new Error("usage: nipmod dist-tag add pkg:<publisher>/<name>@<version> <tag>");
      }
      const spec = parseRemoteSpecifier(specifier);
      return lifecycleCommand(rest, {
        action: {
          kind: "dist-tag.set",
          tag,
          version: spec.version
        },
        package: spec.canonical
      });
    }
    case "rm": {
      const [canonical, tag] = positionalArgs(rest);
      if (!canonical || !tag) {
        throw new Error("usage: nipmod dist-tag rm pkg:<publisher>/<name> <tag>");
      }
      return lifecycleCommand(rest, {
        action: {
          kind: "dist-tag.remove",
          tag
        },
        package: canonical
      });
    }
    default:
      throw new Error("usage: nipmod dist-tag add pkg:<publisher>/<name>@<version> <tag>");
  }
}

async function deprecateCommand(args: string[]): Promise<CliResult> {
  const [specifier, reason] = positionalArgs(args);
  if (!specifier || !reason) {
    throw new Error("usage: nipmod deprecate pkg:<publisher>/<name>@<version> <reason>");
  }
  const spec = parseRemoteSpecifier(specifier);
  return lifecycleCommand(args, {
    action: {
      kind: "deprecate",
      version: spec.version,
      reason
    },
    package: spec.canonical
  });
}

async function yankCommand(args: string[]): Promise<CliResult> {
  const [specifier, reason] = positionalArgs(args);
  if (!specifier || !reason) {
    throw new Error("usage: nipmod yank pkg:<publisher>/<name>@<version> <reason>");
  }
  const spec = parseRemoteSpecifier(specifier);
  return lifecycleCommand(args, {
    action: {
      kind: "yank",
      version: spec.version,
      reason
    },
    package: spec.canonical
  });
}

async function lifecycleCommand(
  args: string[],
  input: {
    action: LifecycleAction;
    package: string;
  }
): Promise<CliResult> {
  const projectDir = optionalFlagValue(args, "--dir") ?? process.cwd();
  const helperPath = optionalFlagValue(args, "--helper");
  const identityPath = optionalFlagValue(args, "--identity");
  const outPath = optionalFlagValue(args, "--out");
  const result = hasFlag(args, "--dry-run")
    ? await createLifecycleDryRunResult({
        ...input,
        projectDir,
        ...(identityPath ? { identityPath } : {})
      })
    : await publishGitlawbLifecycleEvent({
        ...input,
        projectDir,
        nodeUrl: configuredNodeUrl(args),
        ...(helperPath ? { helperPath } : {}),
        ...(identityPath ? { identityPath } : {})
      });
  if (outPath) {
    await writeFile(outPath, `${JSON.stringify(result.event, null, 2)}\n`, { mode: 0o600 });
  }

  return {
    ok: true,
    data: {
      message: formatLifecycleResult(result),
      ...result
    }
  };
}

async function createLifecycleDryRunResult(options: {
  action: LifecycleAction;
  identityPath?: string;
  package: string;
  projectDir: string;
}): Promise<PublishGitlawbLifecycleEventResult> {
  const identity = await readLocalIdentity(options.projectDir, options.identityPath);
  const spec = parseLifecyclePackage(options.package);
  if (spec.ownerDid !== identity.did) {
    throw new Error("local identity must match package canonical owner");
  }
  const event = signLifecycleEvent(
    {
      type: "dev.nipmod.lifecycle.v1",
      formatVersion: 1,
      package: options.package,
      publisher: identity.did,
      source: {
        type: "gitlawb",
        repo: `gitlawb://${identity.did}/${spec.repoName}`
      },
      publishedAt: new Date().toISOString(),
      action: options.action
    },
    identity
  );

  return {
    action: options.action,
    event,
    eventPath: "",
    package: options.package,
    repoName: spec.repoName,
    sourceRepo: `gitlawb://${identity.did}/${spec.repoName}`
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
  assertKnownInstallFlags(args);
  const spec = optionalFirstPositional(args);
  const dir = optionalFlagValue(args, "--dir") ?? process.cwd();
  if (spec && hasFlag(args, "--offline")) {
    throw new Error("install with a package specifier does not accept --offline");
  }
  if (hasFlag(args, "--plan") || hasFlag(args, "--dry-run")) {
    if (!spec) {
      throw new Error("install --plan requires a package specifier");
    }
    if (hasFlag(args, "--dry-run") && (optionalFlagValue(args, "--integrity") || isLocalInstallSpecifier(spec))) {
      throw new Error("install --dry-run only supports registry packages");
    }
    const plan = await resolveAddInstallPlan({
      ...registryTrustFlags(args, "install --plan"),
      action: "install",
      policy: await optionalPolicyFromFlags(args),
      projectDir: dir,
      query: spec
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
  if (!spec) {
    return installLockfileCommand(args, dir);
  }

  const integrity = optionalFlagValue(args, "--integrity");
  if (!integrity && !isLocalInstallSpecifier(spec)) {
    return registryInstallCommand({
      args,
      commandName: "install",
      dir,
      query: spec,
      successMessage: "installed package"
    });
  }
  if (!integrity) {
    throw new Error("missing --integrity");
  }
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

async function installLockfileCommand(args: string[], dir: string): Promise<CliResult> {
  assertLockfileInstallFlags(args);
  const policy = await optionalPolicyFromFlags(args);
  let policyCheck: PolicyCheckResult | undefined;
  let result: InstallLockfileResult;
  try {
    const installOptions: Parameters<typeof installLockfilePackages>[1] = {
      allowNetwork: !hasFlag(args, "--offline")
    };
    if (policy) {
      installOptions.validateLockfile = (lockfile) => {
        const check = checkLockfilePolicy(lockfile, policy);
        policyCheck = check;
        if (!check.allowed) {
          throw new PolicyBlockError(check);
        }
      };
    }
    result = await installLockfilePackages(dir, installOptions);
  } catch (error) {
    if (error instanceof PolicyBlockError) {
      const blockedCheck = error.policyCheck;
      return {
        ok: false,
        data: {
          message: formatPolicyCheck(blockedCheck),
          policyCheck: blockedCheck
        },
        exitCode: 11
      };
    }
    throw error;
  }
  if (policyCheck && !policyCheck.allowed) {
    return {
      ok: false,
      data: {
        message: formatPolicyCheck(policyCheck),
        policyCheck
      },
      exitCode: 11
    };
  }

  return {
    ok: true,
    data: {
      message: formatLockfileInstall(result),
      ...(policyCheck ? { policyCheck } : {}),
      ...result
    }
  };
}

class PolicyBlockError extends Error {
  constructor(readonly policyCheck: PolicyCheckResult) {
    super("install policy blocked");
  }
}

async function addCommand(args: string[]): Promise<CliResult> {
  assertRegistryMutationFlags(args, "add");
  const query = firstPositional(args);
  const dir = optionalFlagValue(args, "--dir") ?? process.cwd();
  return registryInstallCommand({
    args,
    commandName: "add",
    dir,
    query,
    successMessage: "added package"
  });
}

async function registryInstallCommand(options: {
  args: string[];
  commandName: string;
  dir: string;
  query: string;
  successMessage: string;
}): Promise<CliResult> {
  const policy = await optionalPolicyFromFlags(options.args);
  const plan = await resolveAddInstallPlan({
    action: options.commandName === "install" ? "install" : "add",
    ...registryTrustFlags(options.args, options.commandName),
    policy,
    projectDir: options.dir,
    query: options.query
  });
  if (hasFlag(options.args, "--plan") || hasFlag(options.args, "--dry-run")) {
    return {
      ok: plan.readyToInstall,
      data: {
        message: formatInstallPlan(plan),
        plan
      },
      exitCode: installPlanExitCode(plan)
    };
  }
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

  let result: Awaited<ReturnType<typeof executeInstallPlan>>;
  try {
    result = await executeInstallPlan(plan, {
      nodeUrl: configuredNodeUrl(options.args),
      policy,
      projectDir: options.dir
    });
  } catch (error) {
    if (error instanceof InstallPolicyBlockedError) {
      return {
        ok: false,
        data: {
          message: formatPolicyDecision(error.policyDecision),
          policyDecision: error.policyDecision
        },
        exitCode: 11
      };
    }
    throw error;
  }
  return {
    ok: true,
    data: {
      message: result.lockfileChanged ? options.successMessage : "package already installed",
      ...(plan.graph ? { graphPackageCount: plan.graph.packageCount } : {}),
      integrity: plan.integrity,
      lockfileChanged: result.lockfileChanged,
      package: plan.package.canonical,
      resolved: plan.resolved,
      version: plan.package.version
    }
  };
}

function isLocalInstallSpecifier(spec: string): boolean {
  return (
    spec.startsWith("file:") ||
    spec.startsWith(".") ||
    spec.startsWith("/") ||
    spec.startsWith("~") ||
    /^[A-Za-z]:[\\/]/.test(spec) ||
    spec.endsWith(".nipmod")
  );
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

async function outdatedCommand(args: string[]): Promise<CliResult> {
  const dir = optionalFlagValue(args, "--dir") ?? process.cwd();
  const registryUrls = registrySearchUrls(args);
  const report = await checkOutdatedPackages({
    includeQuarantined: hasFlag(args, "--include-quarantined"),
    projectDir: dir,
    registryUrls: registryUrls.length > 0 ? registryUrls : [DEFAULT_REGISTRY_URL]
  });
  return {
    ok: true,
    data: {
      message: formatOutdated(report),
      ...report
    }
  };
}

async function updateCommand(args: string[]): Promise<CliResult> {
  const query = optionalFirstPositional(args) ?? undefined;
  const dir = optionalFlagValue(args, "--dir") ?? process.cwd();
  const policy = await optionalPolicyFromFlags(args);
  const plan = await createUpdatePlan({
    ...registryTrustFlags(args, "update"),
    policy,
    projectDir: dir,
    ...(query ? { query } : {})
  });
  if (hasFlag(args, "--plan")) {
    return {
      ok: plan.readyToUpdate,
      data: {
        message: formatUpdatePlan(plan),
        plan
      },
      exitCode: plan.readyToUpdate ? 0 : updatePlanExitCode(plan)
    };
  }
  if (!plan.readyToUpdate) {
    return {
      ok: false,
      data: {
        message: formatUpdatePlan(plan),
        plan
      },
      exitCode: updatePlanExitCode(plan)
    };
  }

  let result: Awaited<ReturnType<typeof executeUpdatePlan>>;
  try {
    result = await executeUpdatePlan(plan, {
      nodeUrl: configuredNodeUrl(args),
      policy,
      projectDir: dir
    });
  } catch (error) {
    if (error instanceof InstallPolicyBlockedError) {
      return {
        ok: false,
        data: {
          message: formatPolicyDecision(error.policyDecision),
          policyDecision: error.policyDecision
        },
        exitCode: 11
      };
    }
    throw error;
  }

  return {
    ok: true,
    data: {
      message: formatUpdateResult(result),
      ...result
    }
  };
}

async function explainCommand(args: string[]): Promise<CliResult> {
  const query = positionalArg(args, "explain");
  const dir = optionalFlagValue(args, "--dir") ?? process.cwd();
  const report = await explainPackage(query, dir);
  return {
    ok: true,
    data: {
      message: formatExplain(report),
      ...report
    }
  };
}

async function sbomCommand(args: string[]): Promise<CliResult> {
  const dir = optionalFlagValue(args, "--dir") ?? process.cwd();
  const sbom = await generateSbom(dir);
  return {
    ok: true,
    data: {
      message: formatSbom(sbom),
      ...sbom
    }
  };
}

async function doctorCommand(args: string[]): Promise<CliResult> {
  const doctor = await doctorGitlawb({
    nodeUrl: configuredNodeUrl(args),
    registryUrl: registryUrlFromFlagsOrEnv(args) ?? DEFAULT_REGISTRY_URL,
    offline: hasFlag(args, "--offline")
  });

  return {
    ok: doctor.ready,
    data: {
      message: formatDoctor(doctor),
      ready: doctor.ready,
      nodeUrl: doctor.nodeUrl,
      checks: doctor.checks,
      installCommand: doctor.installCommand
    },
    exitCode: doctor.ready ? 0 : 12
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
  const registryUrl = registryUrlFromFlagsOrEnv(args);
  const allowedLogIds = optionalFlagValues(args, "--log-id");
  const allowedWitnesses = optionalFlagValues(args, "--witness");
  assertCustomTrustRoots(args, "inspect", ["--log-id", "--witness"]);
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
  if (report.deprecation?.active) {
    lines.push(`deprecated: ${report.deprecation.reason}`);
  }
  if (report.yank?.active) {
    lines.push(`yanked: ${report.yank.reason}`);
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
  const result =
    registryUrls.length > 1
      ? await searchRegistries({
          includeQuarantined: hasFlag(args, "--include-quarantined"),
          includeYanked: hasFlag(args, "--include-yanked"),
          limit: searchLimit(args),
          query,
          registryUrls
        })
      : await searchRegistry({
          includeQuarantined: hasFlag(args, "--include-quarantined"),
          includeYanked: hasFlag(args, "--include-yanked"),
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

async function viewCommand(args: string[]): Promise<CliResult> {
  const rawTarget = firstPositional(args);
  const registryUrls = registrySearchUrls(args);
  const target = parseViewTarget(rawTarget);
  const result =
    registryUrls.length > 1
      ? await viewRegistriesPackages({
          includeQuarantined: hasFlag(args, "--include-quarantined"),
          includeYanked: hasFlag(args, "--include-yanked"),
          query: target.query,
          registryUrls
        })
      : await viewRegistryPackages({
          includeQuarantined: hasFlag(args, "--include-quarantined"),
          includeYanked: hasFlag(args, "--include-yanked"),
          query: target.query,
          registryUrl: registryUrls[0] ?? DEFAULT_REGISTRY_URL
        });
  const pkg = selectViewPackage(rawTarget, target, result.packages);

  return {
    ok: true,
    data: {
      message: formatView(pkg),
      package: pkg
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
  return [
    ...new Set([
      ...splitRegistryList(process.env.NIPMOD_REGISTRY_URL ?? ""),
      ...splitRegistryList(process.env.NIPMOD_REGISTRY_URLS ?? "")
    ])
  ];
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
    if (pkg.deprecated && pkg.deprecationReason) {
      lines.push(`    deprecated: ${pkg.deprecationReason}`);
    }
    if (pkg.install) {
      lines.push(`    install: ${pkg.install}`);
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

function parseViewTarget(rawTarget: string): { query: string; tag?: string; version?: string } {
  const match = /^(.*)@((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)|[a-z][a-z0-9._-]{0,31})$/.exec(rawTarget);
  if (!match || !match[1]) {
    return { query: rawTarget };
  }
  const spec = requireMatch(match[2], "view version");
  return /^\d+\.\d+\.\d+$/.test(spec)
    ? { query: requireMatch(match[1], "view target"), version: spec }
    : { query: requireMatch(match[1], "view target"), tag: spec };
}

function selectViewPackage(
  rawTarget: string,
  target: { query: string; tag?: string; version?: string },
  packages: readonly RegistrySearchPackage[]
): RegistrySearchPackage {
  const matches = packages.filter((pkg) => {
    const targetMatches = pkg.name === target.query || pkg.canonical === target.query;
    return targetMatches && (!target.version || pkg.version === target.version) && (!target.tag || pkg.distTags?.[target.tag] === pkg.version);
  });
  if (matches.length === 0) {
    throw new Error(`no exact package found for ${rawTarget}; run nipmod search ${quotedSearchQuery(target.query)}`);
  }

  const canonicals = new Set(matches.map((pkg) => pkg.canonical));
  if (canonicals.size > 1) {
    throw new Error(`ambiguous package name ${target.query}; run nipmod view pkg:<publisher>/<name>@<version>`);
  }
  const latestTagged = !target.version && !target.tag ? matches.find((pkg) => pkg.distTags?.latest === pkg.version) : undefined;
  return latestTagged ?? [...matches].sort(comparePackageVersionsDesc)[0]!;
}

function comparePackageVersionsDesc(left: RegistrySearchPackage, right: RegistrySearchPackage): number {
  return compareSemverDesc(left.version, right.version);
}

function compareSemverDesc(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const diff = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function formatView(pkg: RegistrySearchPackage): string {
  const lines = [`nipmod view ${pkg.name}@${pkg.version}`, ""];
  lines.push(`id: ${pkg.canonical}`);
  lines.push(`kind: ${pkg.type}`);
  lines.push(`trust: ${pkg.trust}`);
  lines.push(`permissions: ${pkg.permissionSummary}`);
  lines.push(`source: ${pkg.sourceRegistry}`);
  if (pkg.description) {
    lines.push(`description: ${pkg.description}`);
  }
  if (pkg.deprecated && pkg.deprecationReason) {
    lines.push(`deprecated: ${pkg.deprecationReason}`);
  }
  if (pkg.compatibilityReceipts.length > 0) {
    lines.push(`compatibility: ${pkg.compatibilityReceipts.join(", ")}`);
  }
  const installCommand = pkg.canonicalInstall ?? pkg.install;
  if (installCommand) {
    lines.push("", `install: ${installCommand}`);
  } else if (pkg.installBlockedReason) {
    lines.push("", `blocked: ${pkg.installBlockedReason}`);
  }
  appendDependencyBlock(lines, "dependencies", pkg.dependencies);
  appendDependencyBlock(lines, "peer dependencies", pkg.peerDependencies);
  appendDependencyBlock(lines, "optional dependencies", pkg.optionalDependencies);
  appendDependencyBlock(lines, "dev dependencies", pkg.devDependencies);
  lines.push("", "Agents: use --json for structured metadata.");
  return lines.join("\n");
}

function appendDependencyBlock(lines: string[], label: string, dependencies: Record<string, string> | undefined): void {
  const entries = Object.entries(dependencies ?? {}).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) {
    return;
  }
  lines.push("", `${label}:`);
  for (const [name, range] of entries) {
    lines.push(`  ${name}: ${range}`);
  }
}

function formatOutdated(report: OutdatedReport): string {
  if (report.outdated.length === 0) {
    return "all installed packages are current";
  }
  const lines = [
    `nipmod outdated - ${report.outdated.length} package${report.outdated.length === 1 ? "" : "s"}`,
    "",
    [
      padCell("Package", 28),
      padCell("Current", 8),
      padCell("Wanted", 8),
      padCell("Latest", 8),
      padCell("Spec", 12),
      "Status"
    ].join(" ")
  ];
  for (const pkg of report.outdated) {
    lines.push(formatOutdatedPackage(pkg));
  }
  lines.push("", "Agents: use --json for structured output.");
  return lines.join("\n");
}

function formatOutdatedPackage(pkg: OutdatedPackage): string {
  return [
    padCell(pkg.name, 28),
    padCell(pkg.current, 8),
    padCell(pkg.wanted ?? "-", 8),
    padCell(pkg.latest ?? "-", 8),
    padCell(pkg.spec, 12),
    pkg.status
  ].join(" ");
}

function formatUpdatePlan(plan: UpdatePlan): string {
  const lines = [`nipmod update plan ${plan.readyToUpdate ? "ready" : "blocked"}`];
  lines.push(`updates: ${plan.summary.updates}`);
  lines.push(`unchanged: ${plan.summary.unchanged}`);
  lines.push(`skipped: ${plan.summary.skipped}`);
  for (const update of plan.updates) {
    lines.push(
      `${update.status}: ${update.name} ${update.current ?? "missing"} -> ${update.wanted} latest ${update.latest ?? "unknown"} (${update.root.kind}.${update.root.name}@${update.root.spec})`
    );
    if (!update.plan.readyToInstall) {
      for (const finding of update.plan.trustReport.findings) {
        lines.push(`finding: ${finding}`);
      }
      for (const reason of update.plan.policyDecision?.reasons ?? []) {
        lines.push(`policy finding: ${reason}`);
      }
    }
  }
  for (const item of plan.unchanged) {
    lines.push(`current: ${item.name}@${item.current} (${item.root.kind}.${item.root.name}@${item.root.spec})`);
  }
  for (const item of plan.skipped) {
    lines.push(`skipped: ${item.name}: ${item.reason}`);
  }
  return lines.join("\n");
}

function formatUpdateResult(result: Awaited<ReturnType<typeof executeUpdatePlan>>): string {
  const lines = [`updated ${result.updated} package${result.updated === 1 ? "" : "s"}`];
  lines.push(`lockfile: ${result.lockfileChanged ? "updated" : "unchanged"}`);
  lines.push(`pruned: ${result.prunedPackageCount}`);
  return lines.join("\n");
}

function formatLockfileInstall(result: InstallLockfileResult): string {
  if (result.packageCount === 0) {
    return "no packages in lockfile";
  }
  const lines = [
    `verified ${result.packageCount} package${result.packageCount === 1 ? "" : "s"} from lockfile`,
    `restored: ${result.restored}`,
    `fetched: ${result.fetched}`,
    `lockfile: ${result.lockfileChanged ? "updated" : "unchanged"}`
  ];
  return lines.join("\n");
}

function formatExplain(report: ExplainReport): string {
  const lines = [`nipmod explain: ${report.summary.packageCount} package${report.summary.packageCount === 1 ? "" : "s"}`];
  if (report.matches.length === 0) {
    lines.push(`not installed: ${report.query}`);
    return lines.join("\n");
  }
  for (const pkg of report.matches) {
    lines.push("", `${pkg.name}@${pkg.version}`, `id: ${pkg.canonical}`);
    for (const reason of pkg.rootReasons) {
      lines.push(`root: ${reason.dependencyKind}.${reason.dependencyName}@${reason.spec}`);
    }
    for (const dependent of pkg.dependents) {
      lines.push(`required by ${dependent.name}@${dependent.version} via ${dependent.dependencyKind}.${dependent.dependencyName}`);
    }
    for (const path of pkg.paths) {
      lines.push(`path: ${path.nodes.map((node) => `${node.name}@${node.version}`).join(" > ")}`);
    }
    if (pkg.pathsTruncated) {
      lines.push("paths: truncated");
    }
    if (pkg.orphan) {
      lines.push("orphan: no root or dependent path in lockfile");
    }
  }
  return lines.join("\n");
}

function formatSbom(sbom: AgentSbom): string {
  const lines = [
    `nipmod sbom: ${sbom.summary.packageCount} package${sbom.summary.packageCount === 1 ? "" : "s"}`,
    `dependency edges: ${sbom.summary.dependencyEdges}`,
    [
      "permissions:",
      `network ${sbom.summary.permissions.network}`,
      `filesystem ${sbom.summary.permissions.filesystem}`,
      `env ${sbom.summary.permissions.env}`,
      `mcp ${sbom.summary.permissions.mcpTools}`,
      `secrets ${sbom.summary.permissions.secrets}`,
      `exec ${sbom.summary.permissions.exec}`,
      `postinstall ${sbom.summary.permissions.postinstall}`
    ].join(" ")
  ];
  for (const pkg of sbom.packages) {
    const dependencyCount = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].reduce(
      (total, kind) => total + pkg.dependencies[kind as keyof typeof pkg.dependencies].length,
      0
    );
    lines.push(
      "",
      `${pkg.name}@${pkg.version}`,
      `id: ${pkg.canonical}`,
      `manifest: ${pkg.manifestStatus}`,
      `dependencies: ${dependencyCount}`
    );
  }
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

function updatePlanExitCode(plan: UpdatePlan): number {
  if (plan.readyToUpdate) {
    return 0;
  }
  return plan.updates.some((update) => update.plan.policyDecision && !update.plan.policyDecision.allowed) ? 11 : 7;
}

function formatPolicyDecision(decision: { allowed: boolean; profile: string; reasons: string[]; subject: string }): string {
  const lines = [`nipmod policy ${decision.allowed ? "allowed" : "blocked"} ${decision.subject} (${decision.profile})`];
  for (const reason of decision.reasons) {
    lines.push(`finding: ${reason}`);
  }
  return lines.join("\n");
}

function formatPolicyCheck(result: PolicyCheckResult): string {
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

function assertLockfileInstallFlags(args: readonly string[]): void {
  if (hasFlag(args, "--offline") && hasFlag(args, "--online")) {
    throw new Error("install cannot use both --offline and --online");
  }
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value?.startsWith("--")) {
      continue;
    }
    if (LOCKFILE_INSTALL_BOOLEAN_FLAGS.has(value)) {
      continue;
    }
    if (LOCKFILE_INSTALL_VALUE_FLAGS.has(value)) {
      index += 1;
      continue;
    }
    throw new Error(`install without a package specifier does not accept ${value}`);
  }
}

function assertKnownInstallFlags(args: readonly string[]): void {
  assertKnownFlags(args, "install", INSTALL_BOOLEAN_FLAGS, INSTALL_VALUE_FLAGS);
}

function assertRegistryMutationFlags(args: readonly string[], commandName: string): void {
  assertKnownFlags(args, commandName, REGISTRY_MUTATION_BOOLEAN_FLAGS, REGISTRY_MUTATION_VALUE_FLAGS);
}

function assertKnownFlags(
  args: readonly string[],
  commandName: string,
  booleanFlags: ReadonlySet<string>,
  valueFlags: ReadonlySet<string>
): void {
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value?.startsWith("--")) {
      continue;
    }
    if (booleanFlags.has(value)) {
      continue;
    }
    if (valueFlags.has(value)) {
      const flagValue = args[index + 1];
      if (!flagValue || flagValue.startsWith("--")) {
        throw new Error(`missing value for ${value}`);
      }
      index += 1;
      continue;
    }
    throw new Error(`${commandName} does not accept ${value}`);
  }
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

function positionalArg(args: readonly string[], commandName: string): string {
  const value = optionalFirstPositional(args);
  if (!value) {
    throw new Error(`usage: nipmod ${commandName} <package>`);
  }
  return value;
}

function registryTrustFlags(args: readonly string[], commandName: string): RegistryTrustOptions {
  const registryUrl = registryUrlFromFlagsOrEnv(args);
  const allowedLogIds = optionalFlagValues(args, "--log-id");
  const allowedWitnesses = optionalFlagValues(args, "--witness");
  assertCustomTrustRoots(args, commandName, ["--log-id", "--witness"]);
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

function registryUrlFromFlagsOrEnv(args: readonly string[]): string | undefined {
  return optionalFlagValue(args, "--registry") ?? splitRegistryList(process.env.NIPMOD_REGISTRY_URL ?? "")[0];
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
    lines.push("", "Install is ready. Publish needs the Gitlawb helper:", `  ${helper.detail ?? doctor.installCommand}`);
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

function formatLifecycleResult(result: Pick<PublishGitlawbLifecycleEventResult, "action" | "eventPath" | "package">): string {
  const suffix = result.eventPath ? `\nevent: ${result.eventPath}` : "\ndry-run: no remote write";
  switch (result.action.kind) {
    case "dist-tag.set":
      return `dist-tag ${result.action.tag} -> ${result.package}@${result.action.version}${suffix}`;
    case "dist-tag.remove":
      return `removed dist-tag ${result.action.tag} from ${result.package}${suffix}`;
    case "deprecate":
      return `deprecated ${result.package}@${result.action.version}: ${result.action.reason}${suffix}`;
    case "yank":
      return `yanked ${result.package}@${result.action.version}: ${result.action.reason}${suffix}`;
  }
}

function parseLifecyclePackage(canonical: string): { ownerDid: string; repoName: string } {
  const match = /^pkg:(did:key:z[A-Za-z0-9]+)\/([a-z0-9][a-z0-9._-]*)$/.exec(canonical);
  if (!match) {
    throw new Error("remote package id must be pkg:did:key:<owner>/<name>");
  }
  const repoName = requireMatch(match[2], "repo");
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(repoName)) {
    throw new Error("Gitlawb repo names currently allow only lowercase letters, numbers, hyphens, and underscores");
  }
  return {
    ownerDid: requireMatch(match[1], "owner"),
    repoName
  };
}

function firstPositional(args: readonly string[]): string {
  const value = optionalFirstPositional(args);
  if (value) {
    return value;
  }

  throw new Error("missing positional argument");
}

function positionalArgs(args: readonly string[]): string[] {
  const values: string[] = [];
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
    values.push(value);
  }
  return values;
}

function optionalFirstPositional(args: readonly string[]): string | null {
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

  return null;
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

const LOCKFILE_INSTALL_BOOLEAN_FLAGS = new Set(["--json", "--offline", "--online"]);
const LOCKFILE_INSTALL_VALUE_FLAGS = new Set(["--dir", "--policy", "--profile"]);
const INSTALL_BOOLEAN_FLAGS = new Set(["--allow-custom-roots", "--dry-run", "--json", "--offline", "--online", "--plan"]);
const INSTALL_VALUE_FLAGS = new Set(["--dir", "--integrity", "--log-id", "--node", "--policy", "--profile", "--registry", "--witness"]);
const REGISTRY_MUTATION_BOOLEAN_FLAGS = new Set(["--allow-custom-roots", "--dry-run", "--json", "--plan"]);
const REGISTRY_MUTATION_VALUE_FLAGS = new Set(["--dir", "--log-id", "--node", "--policy", "--profile", "--registry", "--witness"]);

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
