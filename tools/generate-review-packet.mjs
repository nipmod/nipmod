#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const outPath = resolve(firstPositional(process.argv.slice(2)) ?? join(root, "review-packet.md"));
const evidenceDir = valueFlag(process.argv.slice(2), "--evidence-dir");
const requiredEvidence = [
  ["verify-all-prod", "node tools/verify-all.mjs --prod", "verify-all-prod.txt"],
  ["prod-load-smoke", "node tools/prod-load-smoke.mjs --profile launch", "prod-load-smoke.txt"],
  ["prod-synthetic-monitor", "node tools/prod-synthetic-monitor.mjs", "prod-synthetic-monitor.txt"],
  ["restore-drill", "node tools/restore-drill.mjs", "restore-drill.txt"],
  ["supply-chain-check", "node tools/supply-chain-check.mjs", "supply-chain-check.txt"],
  ["browser-e2e", "pnpm --dir site test:e2e", "browser-e2e.txt"],
  ["public-proof-loop", "node tools/public-proof-loop.mjs --registry https://nipmod.com/registry/packages.json", "public-proof-loop.json"]
];

const commit = git(["rev-parse", "HEAD"]);
const status = git(["status", "--short"]);
const security = await readText("SECURITY.md");
const independentReview = await readText("docs/independent-review.md");
const adoption = await readText("docs/adoption.md");
const adoptionReadiness = await readText("docs/adoption-readiness.md");
const auditReadiness = await readText("docs/audit-readiness.md");
const catalogDepth = await readText("docs/catalog-depth.md");
const externalEvidenceLedger = await readText("docs/external-evidence-ledger.md");
const externalProofTracks = await readText("docs/external-proof-tracks.md");
const multiSource = await readText("docs/multi-source-registry.md");
const trustModel = await readText("docs/trust-model.md");
const evidenceAttachments = evidenceDir ? await loadEvidenceAttachments(evidenceDir) : null;

const packet = `# nipmod Independent Review Packet

Generated: ${new Date().toISOString()}
Commit: ${commit}
Workspace dirty: ${status ? "yes" : "no"}
Evidence directory: ${evidenceDir ? resolve(evidenceDir) : "not attached"}

## Public Targets

- Website: https://nipmod.com
- Source: https://gitlawb.com/node/repos/z6Mkwbud/nipmod
- Bankr token: https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3
- Security: https://nipmod.com/security
- security.txt: https://nipmod.com/.well-known/security.txt
- Registry: https://nipmod.com/registry/packages.json
- Discovery: https://nipmod.com/.well-known/nipmod.json
- Public review packet: https://nipmod.com/review/packet.json
- Public evidence manifest: https://nipmod.com/review/evidence-manifest.json

## Required Commands

\`\`\`bash
node tools/verify-all.mjs --prod
node tools/prod-load-smoke.mjs --profile launch
node tools/prod-synthetic-monitor.mjs
node tools/restore-drill.mjs
node tools/supply-chain-check.mjs
pnpm --dir site test:e2e
node tools/public-proof-loop.mjs --registry https://nipmod.com/registry/packages.json
nipmod search policy --registries https://nipmod.com/registry/packages.json,https://mirror.example/packages.json
\`\`\`

## Required Evidence Checklist

${requiredEvidence.map(([id, command, file]) => `- ${id}: \`${command}\` -> \`${file}\``).join("\n")}

${evidenceAttachments ? `## Attached Evidence\n\n${evidenceAttachments}` : "Attach an evidence directory with `--evidence-dir` to embed command outputs in this packet."}

## Security Policy

${security}

## Audit Readiness

${auditReadiness}

## Catalog Depth

${catalogDepth}

## Trust Model

${trustModel}

## Review Template

${independentReview}

## Adoption Criteria

${adoption}

## Adoption Readiness

${adoptionReadiness}

## External Evidence Ledger

${externalEvidenceLedger}

## External Proof Tracks

${externalProofTracks}

## Multi Source Registry Notes

${multiSource}
`;

await writeFile(outPath, packet);
console.log(JSON.stringify({ ok: true, commit, outPath, type: "dev.nipmod.review-packet.v1" }, null, 2));

async function readText(path) {
  return readFile(join(root, path), "utf8");
}

async function loadEvidenceAttachments(dir) {
  const resolvedDir = resolve(dir);
  const sections = [];
  for (const [id, command, file] of requiredEvidence) {
    const text = await readFile(join(resolvedDir, file), "utf8");
    sections.push(`### ${id}\n\nCommand: \`${command}\`\n\n\`\`\`text\n${text.trim()}\n\`\`\``);
  }
  return sections.join("\n\n");
}

function git(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

function firstPositional(args) {
  return args.find((arg) => !arg.startsWith("--"));
}

function valueFlag(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}
