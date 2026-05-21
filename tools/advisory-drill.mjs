#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { readAdvisoryPublicKeyInfo, signAdvisoryFeed } from "./advisory-signing.mjs";

const root = resolve(import.meta.dirname, "..");
const DEFAULT_REGISTRY_SOURCE = "https://nipmod.com/registry/packages.json";
const DEFAULT_PRIVATE_KEY_PATH = join(root, ".nipmod", "advisory-signing-private-key.pem");
const DEFAULT_PUBLIC_KEY_PATH = join(root, "tools", "advisory-signing-public-key.json");
const DEFAULT_ADVISORY_ID = "NIPMOD-2026-9001";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function runAdvisoryDrill(options = {}) {
  const outputDir = options.outputDir ?? (await mkdtemp(join(tmpdir(), "nipmod-advisory-drill-")));
  await mkdir(outputDir, { recursive: true });

  const registry = await readRegistry(options.registrySource ?? DEFAULT_REGISTRY_SOURCE, options.fetchFn ?? fetch);
  const target = selectTargetPackage(registry, options.target);
  const advisory = buildQuarantineAdvisory(target, {
    id: options.advisoryId ?? DEFAULT_ADVISORY_ID,
    now: options.now ?? new Date(),
    severity: options.severity ?? "high",
    title: options.title ?? "Quarantine dry-run advisory",
    ttlDays: options.ttlDays ?? 7
  });
  const drillRegistry = registryWithQuarantinedTarget(registry, target, advisory);
  const paths = await writeDrillFiles({
    advisory,
    advisoryPrivateKeyPath: options.advisoryPrivateKeyPath ?? DEFAULT_PRIVATE_KEY_PATH,
    advisoryPublicKeyPath: options.advisoryPublicKeyPath ?? DEFAULT_PUBLIC_KEY_PATH,
    outputDir,
    registry: drillRegistry,
    target
  });
  const publicKey = await readAdvisoryPublicKeyInfo(paths.advisoryPublicKeyPath);
  const commonArgs = [
    "--dir",
    paths.appDir,
    "--registry",
    pathToFileURL(paths.registryPath).href,
    "--advisories",
    pathToFileURL(paths.advisoriesPath).href,
    "--advisories-signature",
    pathToFileURL(paths.advisoriesSignaturePath).href,
    "--advisory-key",
    publicKey.publicKeySpkiBase64,
    "--advisory-key-sha256",
    publicKey.publicKeySpkiSha256,
    "--log-id",
    registry.transparencyLog.treeHead.logId,
    "--witness",
    firstWitness(registry),
    "--allow-custom-roots",
    "--json"
  ];

  const audit = await runNipmodJson(["audit", ...commonArgs], [6], options);
  const ci = await runNipmodJson(["ci", ...commonArgs], [8], options);
  const inspect = await runNipmodJson(
    [
      "inspect",
      `${target.canonical}@${target.version}`,
      "--registry",
      pathToFileURL(paths.registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      drillRegistry.transparencyLog.treeHead.logId,
      "--witness",
      firstWitness(drillRegistry),
      "--json"
    ],
    [7],
    options
  );
  const installPlan = await runNipmodJson(
    [
      "install",
      `${target.canonical}@${target.version}`,
      "--plan",
      "--registry",
      pathToFileURL(paths.registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      drillRegistry.transparencyLog.treeHead.logId,
      "--witness",
      firstWitness(drillRegistry),
      "--dir",
      paths.appDir,
      "--json"
    ],
    [7],
    options
  );
  const auditPackage = audit.data?.packages?.[0];
  const ciViolation = ci.data?.violations?.[0];

  return {
    advisory,
    audit: {
      exitCode: audit.exitCode,
      findings: auditPackage?.findings ?? [],
      ready: audit.data?.ready,
      summary: audit.data?.summary
    },
    ci: {
      exitCode: ci.exitCode,
      findings: ciViolation?.findings ?? [],
      ready: ci.data?.ready,
      violations: ci.data?.violations ?? []
    },
    inspect: {
      exitCode: inspect.exitCode,
      findings: inspect.data?.report?.findings ?? [],
      readyToInstall: inspect.data?.report?.readyToInstall
    },
    installPlan: {
      exitCode: installPlan.exitCode,
      findings: installPlan.data?.plan?.trustReport?.findings ?? [],
      readyToInstall: installPlan.data?.plan?.readyToInstall
    },
    mode: "dry-run",
    outputDir,
    target: packageSummary(target)
  };
}

function registryWithQuarantinedTarget(registry, target, advisory) {
  return {
    ...registry,
    packages: registry.packages.map((pkg) => {
      if (pkg.canonical !== target.canonical || pkg.version !== target.version) {
        return pkg;
      }
      return {
        ...pkg,
        quarantine: {
          active: true,
          advisoryId: advisory.id,
          artifactSha256: target.digest,
          package: target.canonical,
          publishedAt: advisory.feed.generatedAt,
          reason: advisory.title,
          severity: advisory.severity,
          status: "active",
          type: "dev.nipmod.quarantine.v1",
          version: target.version
        }
      };
    })
  };
}

export function buildQuarantineAdvisory(pkg, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const generatedAt = new Date(now.getTime() - 60_000).toISOString();
  const expiresAt = new Date(now.getTime() + (options.ttlDays ?? 7) * ONE_DAY_MS).toISOString();
  return {
    feed: {
      advisories: [
        {
          id: options.id ?? DEFAULT_ADVISORY_ID,
          package: pkg.canonical,
          severity: options.severity ?? "high",
          status: "active",
          title: options.title ?? "Quarantine dry-run advisory",
          versions: [pkg.version]
        }
      ],
      expiresAt,
      formatVersion: 1,
      generatedAt,
      type: "dev.nipmod.advisories.v1"
    },
    id: options.id ?? DEFAULT_ADVISORY_ID,
    package: pkg.canonical,
    severity: options.severity ?? "high",
    title: options.title ?? "Quarantine dry-run advisory",
    version: pkg.version
  };
}

async function writeDrillFiles({
  advisory,
  advisoryPrivateKeyPath,
  advisoryPublicKeyPath,
  outputDir,
  registry,
  target
}) {
  const appDir = join(outputDir, "app");
  const registryPath = join(outputDir, "registry.json");
  const advisoriesPath = join(outputDir, "advisories.json");
  const advisoriesSignaturePath = `${advisoriesPath}.sig`;
  await mkdir(appDir, { recursive: true });
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  await writeFile(advisoriesPath, `${JSON.stringify(advisory.feed, null, 2)}\n`);
  const signature = await signAdvisoryFeed({
    feedPath: advisoriesPath,
    privateKeyPath: advisoryPrivateKeyPath,
    publicKeyInfo: await readAdvisoryPublicKeyInfo(advisoryPublicKeyPath)
  });
  await writeFile(advisoriesSignaturePath, `${JSON.stringify(signature, null, 2)}\n`);
  await writeFile(join(appDir, "nipmod.lock.json"), `${JSON.stringify(lockfileForPackage(target), null, 2)}\n`);

  return {
    advisoryPublicKeyPath,
    advisoriesPath,
    advisoriesSignaturePath,
    appDir,
    registryPath
  };
}

function lockfileForPackage(pkg) {
  return {
    formatVersion: 1,
    generatedBy: "nipmod-advisory-drill",
    packages: {
      [`${pkg.canonical}@${pkg.version}`]: {
        canonical: pkg.canonical,
        files: ["SKILL.md"],
        integrity: `sha256-${pkg.digest}`,
        manifestDigest: pkg.manifestDigest ?? "0".repeat(64),
        name: pkg.name,
        permissions: {
          env: [],
          exec: { allowed: false },
          filesystem: [],
          mcpTools: [],
          network: [],
          postinstall: { allowed: false },
          secrets: []
        },
        publisher: pkg.publisher,
        resolved: pkg.resolved,
        version: pkg.version
      }
    }
  };
}

async function readRegistry(source, fetchFn) {
  const url = new URL(source);
  if (url.protocol === "file:") {
    return JSON.parse(await readFile(url, "utf8"));
  }
  if (url.protocol !== "https:" && !["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    throw new Error("registry source must be https, localhost or file");
  }
  const response = await fetchFn(url.href, { redirect: "error" });
  if (!response.ok) {
    throw new Error(`failed to fetch registry: ${response.status}`);
  }
  return response.json();
}

function selectTargetPackage(registry, target) {
  if (!registry || typeof registry !== "object" || !Array.isArray(registry.packages)) {
    throw new Error("registry payload is invalid");
  }
  const packages = registry.packages.filter(
    (pkg) => pkg?.trust?.level === "verified" && pkg.trust?.score === 100 && typeof pkg.canonical === "string"
  );
  const selected = target
    ? packages.find((pkg) =>
        [pkg.name, pkg.repo, pkg.canonical, `${pkg.canonical}@${pkg.version}`].filter(Boolean).includes(target)
      )
    : packages[0];
  if (!selected) {
    throw new Error(target ? `target package not found or not verified: ${target}` : "registry has no verified package");
  }
  if (!registry.transparencyLog?.treeHead?.logId || !firstWitness(registry)) {
    throw new Error("registry is missing transparency or witness pins");
  }
  return selected;
}

function firstWitness(registry) {
  return registry.transparencyLog?.witnesses?.[0]?.witness;
}

function packageSummary(pkg) {
  return {
    canonical: pkg.canonical,
    digest: pkg.digest,
    name: pkg.name,
    publisher: pkg.publisher,
    version: pkg.version
  };
}

async function runNipmodJson(args, expectedExitCodes, options) {
  if (options.runCommand) {
    return options.runCommand(args, expectedExitCodes);
  }

  const result = await spawnCollect("pnpm", ["--dir", "nipmod", "exec", "tsx", "src/cli.ts", ...args], {
    cwd: root
  });
  if (!expectedExitCodes.includes(result.exitCode)) {
    throw new Error(`nipmod ${args[0]} expected exit ${expectedExitCodes.join("/")} but got ${result.exitCode}`);
  }

  const parsed = parseJsonLine(`${result.stdout}\n${result.stderr}`);
  if (parsed.exitCode !== result.exitCode) {
    throw new Error(`nipmod ${args[0]} JSON exit code mismatch`);
  }
  return parsed;
}

function spawnCollect(command, args, options) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolvePromise({
        exitCode,
        stderr,
        stdout
      });
    });
  });
}

function parseJsonLine(output) {
  const jsonLine = output
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith("{") && line.trim().endsWith("}"));
  if (!jsonLine) {
    throw new Error("nipmod command did not return JSON");
  }
  return JSON.parse(jsonLine);
}

function parseArgs(args) {
  return {
    advisoryId: valueFlag(args, "--id"),
    advisoryPrivateKeyPath: valueFlag(args, "--private-key") ?? DEFAULT_PRIVATE_KEY_PATH,
    advisoryPublicKeyPath: valueFlag(args, "--public-key") ?? DEFAULT_PUBLIC_KEY_PATH,
    outputDir: valueFlag(args, "--out"),
    quiet: args.includes("--quiet"),
    registrySource: valueFlag(args, "--registry") ?? DEFAULT_REGISTRY_SOURCE,
    target: valueFlag(args, "--target")
  };
}

function valueFlag(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runAdvisoryDrill(parseArgs(process.argv.slice(2)))
    .then((result) => {
      if (!process.argv.includes("--quiet")) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(
        JSON.stringify({
          advisory: result.advisory.id,
          auditExitCode: result.audit.exitCode,
          ciExitCode: result.ci.exitCode,
          mode: result.mode,
          outputDir: result.outputDir,
          target: result.target.name
        })
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
