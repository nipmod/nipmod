#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const outPath = resolve(process.argv[2] ?? join(root, "review-packet.md"));

const commit = git(["rev-parse", "HEAD"]);
const status = git(["status", "--short"]);
const security = await readText("SECURITY.md");
const independentReview = await readText("docs/independent-review.md");
const adoption = await readText("docs/adoption.md");
const multiSource = await readText("docs/multi-source-registry.md");

const packet = `# nipmod Independent Review Packet

Generated: ${new Date().toISOString()}
Commit: ${commit}
Workspace dirty: ${status ? "yes" : "no"}

## Public Targets

- Website: https://nipmod.com
- Source: https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod
- Security: https://nipmod.com/security
- security.txt: https://nipmod.com/.well-known/security.txt
- Registry: https://nipmod.com/registry/packages.json
- Discovery: https://nipmod.com/.well-known/nipmod.json

## Required Commands

\`\`\`bash
node tools/verify-all.mjs --prod
node tools/prod-load-smoke.mjs --profile launch
node tools/supply-chain-check.mjs
pnpm --dir site test:e2e
nipmod search policy --registries https://nipmod.com/registry/packages.json,https://mirror.example/packages.json
\`\`\`

## Security Policy

${security}

## Review Template

${independentReview}

## Adoption Criteria

${adoption}

## Multi Source Registry Notes

${multiSource}
`;

await writeFile(outPath, packet);
console.log(JSON.stringify({ ok: true, commit, outPath, type: "dev.nipmod.review-packet.v1" }, null, 2));

async function readText(path) {
  return readFile(join(root, path), "utf8");
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
