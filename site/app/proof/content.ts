import registryData from "../registry-data.json";
import type { RegistryIndex } from "../../lib/registry";

const registry = registryData as RegistryIndex;
const verified = registry.packages.filter((pkg) => pkg.trust.level === "verified" && pkg.trust.score === 100);
const treeHead = registry.transparencyLog?.treeHead;
const proofPackageName = "gitlawb-release-review";
const proofPackage = registry.packages.find((pkg) => pkg.name === proofPackageName);
const proofSubject = proofPackage ? `${proofPackage.canonical}@${proofPackage.version}` : proofPackageName;

export const proofContent = {
  headline: "Proof you can run",
  lead: "A public package installs cleanly, audits cleanly and unsafe package manifests fail before release.",
  packageName: proofPackageName,
  registry: {
    count: registry.packages.length,
    rootHash: treeHead?.rootHash ?? "missing",
    treeSize: treeHead?.treeSize ?? 0,
    trust: verified.length === registry.packages.length ? "verified/100" : "review required"
  },
  safeCommands: [
    `nipmod inspect ${proofSubject} --online`,
    `nipmod install ${proofPackageName} --online`,
    "nipmod audit --online",
    "nipmod ci --online"
  ],
  transcript: "/proof/transcript.json",
  blockedCases: [
    {
      blockedBy: "manifest schema",
      expected: "postinstall.allowed must be false",
      label: "postinstall"
    },
    {
      blockedBy: "manifest schema",
      expected: "exec.allowed must be false",
      label: "exec"
    },
    {
      blockedBy: "permission grammar",
      expected: "network wildcards are not allowed",
      label: "broad network"
    },
    {
      blockedBy: "permission grammar",
      expected: "secret like environment variables are rejected",
      label: "secret env"
    },
    {
      blockedBy: "permission grammar",
      expected: "secrets permissions are unsupported in v1",
      label: "secret scope"
    },
    {
      blockedBy: "permission grammar",
      expected: "filesystem write scopes are rejected",
      label: "write path"
    },
    {
      blockedBy: "safe text schema",
      expected: "prompt-injection metadata is rejected",
      label: "prompt injection metadata"
    }
  ]
} as const;
