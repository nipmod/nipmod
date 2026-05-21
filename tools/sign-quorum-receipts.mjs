#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertQuorumReceiptIndexMatchesPackages,
  buildQuorumReceiptIndex,
  ensureQuorumSignerSet,
  quorumPolicyDocument,
  writeQuorumPublicFiles
} from "./quorum-signing.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_REGISTRY_PATH = join(ROOT, "site", "app", "registry-data.json");
const DEFAULT_OUTPUT_DIR = join(ROOT, "site", "public", "quorum");
const DEFAULT_KEY_DIR = join(ROOT, ".nipmod");

const args = parseArgs(process.argv.slice(2));
const registryPath = resolve(args.registry ?? DEFAULT_REGISTRY_PATH);
const outputDir = resolve(args.output ?? DEFAULT_OUTPUT_DIR);
const keyDir = resolve(args.keyDir ?? DEFAULT_KEY_DIR);
const generatedAt = args.generatedAt ?? new Date().toISOString();

const registry = JSON.parse(await readFile(registryPath, "utf8"));
if (!Array.isArray(registry.packages) || registry.packages.length === 0) {
  throw new Error("registry has no packages to sign");
}

const packages = registry.packages
  .filter((pkg) => !isInternalArtifact(pkg))
  .sort((left, right) => `${left.canonical}@${left.version}`.localeCompare(`${right.canonical}@${right.version}`));
if (packages.length === 0) {
  throw new Error("registry has no public packages to sign");
}
for (const pkg of packages) {
  if (pkg.trust?.level !== "verified" || pkg.trust?.score !== 100) {
    throw new Error(`${pkg.canonical}@${pkg.version} is not verified/100`);
  }
}

const { privateKeys, signersDocument } = await ensureQuorumSignerSet({ generatedAt, keyDir });
const policyDocument = quorumPolicyDocument(generatedAt);
const receiptIndex = buildQuorumReceiptIndex({ generatedAt, packages, privateKeys, signersDocument });
assertQuorumReceiptIndexMatchesPackages(packages, receiptIndex);
await writeQuorumPublicFiles({
  outputDir,
  policyDocument,
  receiptIndex,
  signersDocument
});

process.stdout.write(
  `${JSON.stringify(
    {
      generatedAt,
      ok: true,
      packages: packages.length,
      policy: policyDocument.id,
      receipts: `${outputDir}/receipts.json`,
      signers: signersDocument.signers.map((signer) => ({
        id: signer.id,
        publicKeySpkiSha256: signer.publicKeySpkiSha256,
        role: signer.role
      })),
      type: "dev.nipmod.quorum-signing-run.v1"
    },
    null,
    2
  )}\n`
);

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--registry") {
      parsed.registry = values[index + 1];
      index += 1;
    } else if (value === "--output") {
      parsed.output = values[index + 1];
      index += 1;
    } else if (value === "--key-dir") {
      parsed.keyDir = values[index + 1];
      index += 1;
    } else if (value === "--generated-at") {
      parsed.generatedAt = values[index + 1];
      index += 1;
    } else {
      throw new Error(`unknown option: ${value}`);
    }
  }
  return parsed;
}

function isInternalArtifact(pkg) {
  return [pkg?.name, pkg?.canonical, pkg?.description, pkg?.repo]
    .filter((value) => typeof value === "string")
    .some((value) => value.toLowerCase().includes("probe"));
}
