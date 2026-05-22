#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const requiredFiles = [
  ".gitattributes",
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "TRADEMARKS.md",
  "SUPPORT.md",
  "docs/README.md",
  "docs/github-mirror.md",
  ".github/workflows/ci.yml",
  ".github/dependabot.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml"
];

const checks = [];

for (const file of requiredFiles) {
  check(`required:${file}`, () => existsSync(join(root, file)));
}

const readme = read("README.md");
check("readme:positioning", () => readme.includes("One package API for agents."));
check("readme:hosted-api", () => readme.includes("Public beta access does not require an API key."));
check("readme:api-search-example", () => readme.includes("https://nipmod.com/api/search?q=http%20client"));
check("readme:no-telegram-example", () => !readme.includes("telegram%20bot") && !readme.includes("node-telegram-bot-api"));
check("readme:no-stale-safe-mode", () => !readme.includes("durable archive env vars") && !readme.includes("Resolver safe mode"));
check("readme:no-duplicate-github-mirror", () => !readme.includes("GitHub mirror"));
check("readme:telegram", () => readme.includes("| Telegram | https://t.me/nipmod |"));
check("readme:security", () => readme.includes("Security: `SECURITY.md`"));
check("readme:no-banned-launch-copy", () => !/the goal is simple|this is exactly|next step is simple/i.test(readme));

const gitattributes = read(".gitattributes");
check("linguist:public-html-generated", () => gitattributes.includes("site/public/*.html linguist-generated=true"));
check("linguist:release-artifacts-generated", () => gitattributes.includes("site/public/releases/** linguist-generated=true"));

const trademarks = read("TRADEMARKS.md");
check("trademarks:no-affiliation", () => trademarks.includes("not affiliated with, endorsed by or sponsored by"));
check("trademarks:descriptive-use", () => trademarks.includes("descriptive references"));

const tracked = git(["ls-files"]);
const forbiddenTracked = tracked
  .split("\n")
  .filter(Boolean)
  .filter((file) =>
    /(^|\/)(\.env|\.env\.|.*private-key.*|.*token.*|.*identity.*\.json|.*\.pem$|\.nipmod\/|\.playwright-mcp\/)/i.test(file)
  );
check("git:no-tracked-secrets-or-local-state", () => forbiddenTracked.length === 0, { forbiddenTracked });

const forbiddenGenerated = tracked
  .split("\n")
  .filter(Boolean)
  .filter((file) => /(^|\/)(node_modules|\.next|\.vercel)\//.test(file) || file === "site/public/claude-original.html");
check("git:no-tracked-build-output", () => forbiddenGenerated.length === 0, { forbiddenGenerated });

const forbiddenPublicArtifacts = tracked
  .split("\n")
  .filter(Boolean)
  .filter((file) =>
    /(^|\/)(CLAUDE\.md|\.claude\/|.*handoff.*|.*scratch.*|.*private-prompt.*)/i.test(file)
  );
check("git:no-public-assistant-artifacts", () => forbiddenPublicArtifacts.length === 0, { forbiddenPublicArtifacts });

const publicTextFiles = tracked
  .split("\n")
  .filter(Boolean)
  .filter((file) => /\.(css|md|mdx|txt|tsx?|jsx?|json|ya?ml)$/i.test(file))
  .filter((file) => !/(^|\/)(node_modules|dist|\.next|\.vercel)\//.test(file));
const internalCopyMarkers = [
  "Claude editorial" + " redesign",
  "Website Redesign" + " Handoff",
  "Strategy Operating" + " System"
];
const forbiddenPublicText = [];
for (const file of publicTextFiles) {
  const text = read(file);
  if (internalCopyMarkers.some((marker) => text.toLowerCase().includes(marker.toLowerCase()))) {
    forbiddenPublicText.push(file);
  }
}
check("git:no-internal-public-copy", () => forbiddenPublicText.length === 0, { forbiddenPublicText });

const result = {
  checkedAt: new Date().toISOString(),
  checks,
  formatVersion: 1,
  ok: checks.every((item) => item.status === "pass"),
  type: "dev.nipmod.open-source-readiness.v1"
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
  process.exitCode = 1;
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function check(name, fn, data = undefined) {
  const pass = Boolean(fn());
  checks.push({
    ...(data === undefined ? {} : { data }),
    name,
    status: pass ? "pass" : "fail"
  });
}

function git(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
}
