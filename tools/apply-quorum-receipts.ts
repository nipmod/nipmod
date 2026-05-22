#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertQuorumReceiptIndexMatchesPackages,
  loadQuorumReceiptIndex,
  quorumPolicySummary,
  quorumStatusForPackage
} from "./quorum-signing.ts";
import { writePackageDocuments } from "./build-package-index.ts";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SITE_REGISTRY_PATH = join(ROOT, "site", "app", "registry-data.json");
const PUBLIC_REGISTRY_PATH = join(ROOT, "site", "public", "registry", "packages.json");
const PUBLIC_QUORUM_RECEIPTS_PATH = join(ROOT, "site", "public", "quorum", "receipts.json");

const args = parseArgs(process.argv.slice(2));
const siteRegistryPath = resolve(args.siteRegistry ?? SITE_REGISTRY_PATH);
const publicRegistryPath = resolve(args.publicRegistry ?? PUBLIC_REGISTRY_PATH);
const receiptsPath = resolve(args.receipts ?? PUBLIC_QUORUM_RECEIPTS_PATH);

const [siteRegistry, publicRegistry, receipts] = await Promise.all([
  readJson(siteRegistryPath),
  readJson(publicRegistryPath),
  loadQuorumReceiptIndex(receiptsPath)
]);

if (JSON.stringify(stripGeneratedQuorum(siteRegistry)) !== JSON.stringify(stripGeneratedQuorum(publicRegistry))) {
  throw new Error("site and public registries are not in sync before quorum apply");
}

const index = applyQuorum(siteRegistry, receipts);
assertQuorumReceiptIndexMatchesPackages(index.packages, receipts);

const payload = `${JSON.stringify(index, null, 2)}\n`;
await writeFile(siteRegistryPath, payload);
await writeFile(publicRegistryPath, payload);
await writePackageDocuments(index);

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      packages: index.packages.length,
      policy: index.quorumPolicy.id,
      registry: publicRegistryPath,
      type: "dev.nipmod.quorum-apply-run.v1"
    },
    null,
    2
  )}\n`
);

function applyQuorum(index, receipts) {
  return {
    ...index,
    packages: index.packages.map((pkg) => ({
      ...pkg,
      quorum: quorumStatusForPackage(pkg, receipts)
    })),
    quorumPolicy: quorumPolicySummary(receipts)
  };
}

function stripGeneratedQuorum(index) {
  return {
    ...index,
    packages: (index.packages ?? []).map((pkg) => {
      const { quorum, ...rest } = pkg;
      return rest;
    }),
    quorumPolicy: undefined
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--site-registry") {
      parsed.siteRegistry = values[index + 1];
      index += 1;
    } else if (value === "--public-registry") {
      parsed.publicRegistry = values[index + 1];
      index += 1;
    } else if (value === "--receipts") {
      parsed.receipts = values[index + 1];
      index += 1;
    } else {
      throw new Error(`unknown option: ${value}`);
    }
  }
  return parsed;
}
