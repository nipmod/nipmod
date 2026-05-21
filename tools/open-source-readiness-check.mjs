#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const requiredFiles = [
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "TRADEMARKS.md",
  "docs/github-mirror.md",
  ".github/workflows/ci.yml",
  ".github/dependabot.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml"
];

const checks = [];

for (const file of requiredFiles) {
  check(`required:${file}`, () => existsSync(join(root, file)));
}

const readme = read("README.md");
check("readme:canonical-gitlawb", () => readme.includes("Canonical source: `gitlawb://did:key:"));
check("readme:github-mirror", () => readme.includes("| GitHub mirror | https://github.com/nipmod/nipmod |"));
check("readme:telegram", () => readme.includes("| Telegram | https://t.me/nipmod |"));
check("readme:security", () => readme.includes("Security: `SECURITY.md`"));

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
