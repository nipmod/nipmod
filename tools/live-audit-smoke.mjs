import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_REGISTRY_URL = "https://nipmod.com/registry/packages.json";
const DID_KEY_PATTERN = /^did:key:z[A-Za-z0-9]+$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

export async function writeAuditSmokeLockfile({ appDir, fetchFn = fetch, registryUrl = DEFAULT_REGISTRY_URL }) {
  const registry = await fetchRegistry(registryUrl, fetchFn);
  const pkg = registry.packages.find(isVerifiedAuditPackage);
  if (!pkg) {
    throw new Error("live registry has no verified package for audit smoke");
  }

  const subject = `${pkg.canonical}@${pkg.version}`;
  await mkdir(appDir, { recursive: true });
  await writeFile(
    join(appDir, "nipmod.lock.json"),
    `${JSON.stringify(
      {
        formatVersion: 1,
        generatedBy: "nipmod-prod-smoke",
        packages: {
          [subject]: {
            canonical: pkg.canonical,
            files: ["SKILL.md"],
            integrity: `sha256-${pkg.digest}`,
            manifestDigest: "0".repeat(64),
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
      },
      null,
      2
    )}\n`
  );
  return subject;
}

async function fetchRegistry(url, fetchFn) {
  const response = await fetchFn(url, { redirect: "error" });
  if (!response.ok) {
    throw new Error(`failed to fetch live registry: ${response.status}`);
  }
  const payload = await response.json();
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.packages)) {
    throw new Error("live registry payload is invalid");
  }
  return payload;
}

function isVerifiedAuditPackage(pkg) {
  return (
    pkg &&
    typeof pkg === "object" &&
    typeof pkg.canonical === "string" &&
    pkg.canonical.startsWith("pkg:") &&
    typeof pkg.version === "string" &&
    typeof pkg.name === "string" &&
    typeof pkg.resolved === "string" &&
    DID_KEY_PATTERN.test(pkg.publisher) &&
    DIGEST_PATTERN.test(pkg.digest) &&
    pkg.trust?.level === "verified" &&
    pkg.trust?.score === 100
  );
}
