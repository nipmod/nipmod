#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const requiredFiles = [
  ".editorconfig",
  ".node-version",
  "package.json",
  "pnpm-workspace.yaml",
  ".gitattributes",
  "README.md",
  "LICENSE",
  "CITATION.cff",
  "GOVERNANCE.md",
  "MAINTAINERS.md",
  "ROADMAP.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "TRADEMARKS.md",
  "SUPPORT.md",
  "docs/README.md",
  "docs/github-excellence.md",
  "docs/release-process.md",
  "docs/decisions/README.md",
  "docs/decisions/0001-api-first-package-network.md",
  "docs/decisions/0002-external-source-ownership.md",
  "docs/decisions/0003-durable-archive-gating.md",
  "docs/specs/public-api.md",
  "docs/specs/source-resolvers.md",
  "docs/specs/trust-signals.md",
  "docs/specs/archive-records.md",
  "docs/package-intelligence-schema.sql",
  "docs/api-usage-schema.sql",
  "supabase/migrations/20260522073000_package_intelligence_archive.sql",
  "supabase/migrations/20260522151945_api_usage_events.sql",
  "docs/security/supply-chain.md",
  "docs/launch/api-beta.md",
  "examples/http-api/README.md",
  "examples/http-api/search.ts",
  "examples/http-api/agent-flow.ts",
  "examples/agent-workflow/README.md",
  "examples/agent-workflow/codex.md",
  "examples/agent-workflow/claude-code.md",
  "examples/agent-workflow/mcp-host.md",
  "tools/seed-package-intelligence.ts",
  "docs/github-mirror.md",
  ".github/workflows/ci.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/dependency-review.yml",
  ".github/workflows/scorecard.yml",
  ".github/dependabot.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/api_bug.yml",
  ".github/ISSUE_TEMPLATE/source_request.yml",
  ".github/ISSUE_TEMPLATE/package_risk.yml",
  "site/.npmrc"
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
check(
  "readme:npm-token-link",
  () => readme.includes("| $NPM on Base | https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3 |")
);
check("readme:security", () => readme.includes("Security: `SECURITY.md`"));
check("readme:governance", () => readme.includes("Governance: [`GOVERNANCE.md`](GOVERNANCE.md)"));
check("readme:api-spec", () => readme.includes("docs/specs/public-api.md"));
check("readme:api-launch-kit", () => readme.includes("docs/launch/api-beta.md"));
check("readme:no-banned-launch-copy", () => !/the goal is simple|this is exactly|next step is simple/i.test(readme));

const trustSignals = read("docs/specs/trust-signals.md");
check("trust-signals:external-thresholds", () => trustSignals.includes("`75-100` | `recommended` | `low`"));
check("trust-signals:verified-score", () => trustSignals.includes("Bundle signature verified | `20`"));
check("trust-signals:ranking", () => trustSignals.includes("exact name/display match bonus 18"));
check("trust-signals:ranking-v2", () => trustSignals.includes("source reliability bonus") && trustSignals.includes("install command risk penalty"));
check("trust-signals:agent-boundary", () => trustSignals.includes("Package descriptions, README text, model cards and registry metadata are untrusted data."));

const agentWorkflow = read("examples/agent-workflow/README.md");
const codexExample = read("examples/agent-workflow/codex.md");
const claudeExample = read("examples/agent-workflow/claude-code.md");
const mcpExample = read("examples/agent-workflow/mcp-host.md");
check("agent-example:readme-flow", () => agentWorkflow.includes("GET https://nipmod.com/api/search?q=<task>"));
check("agent-example:codex", () => codexExample.includes("GET https://nipmod.com/api/install-plan"));
check("agent-example:claude-code", () => claudeExample.includes("Do not install until I approve the plan."));
check("agent-example:trust-factors", () => agentWorkflow.includes("trust factors") && codexExample.includes("trust factors"));
check("agent-example:mcp-external", () => mcpExample.includes("nipmod.external_install_plan") && mcpExample.includes("nipmod.resolve"));

const apiBetaLaunch = read("docs/launch/api-beta.md");
check("launch-kit:api-beta", () => apiBetaLaunch.includes("Trust Engine v2") && apiBetaLaunch.includes("Production monitor passes before posting."));
check("launch-kit:operator-seed", () => apiBetaLaunch.includes("pnpm archive:seed") && apiBetaLaunch.includes("NIPMOD_ARCHIVE_WRITE_TOKEN"));

const gitattributes = read(".gitattributes");
check("linguist:public-html-generated", () => gitattributes.includes("site/public/*.html linguist-generated=true"));
check(
  "linguist:release-artifacts-generated",
  () =>
    gitattributes.includes(
      "site/public/releases/** linguist-generated=true linguist-vendored=true linguist-detectable=false"
    )
);
const gitignore = read(".gitignore");
check("gitignore:release-archives-ignored", () => gitignore.includes("site/public/releases/*.tgz"));
check("gitignore:release-sidecars-trackable", () => gitignore.includes("!site/public/releases/*.tgz.sha256"));
const siteNpmrc = read("site/.npmrc");
check("site-npmrc:sharp-build-policy", () => siteNpmrc.includes("only-built-dependencies[]=sharp"));

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

const forbiddenReleaseArchives = tracked
  .split("\n")
  .filter(Boolean)
  .filter((file) => /^site\/public\/releases\/nipmod-[^/]+\.tgz$/.test(file));
check("git:no-tracked-release-archives", () => forbiddenReleaseArchives.length === 0, { forbiddenReleaseArchives });

const forbiddenJavascriptTooling = tracked
  .split("\n")
  .filter(Boolean)
  .filter((file) => /^(tools|site\/scripts)\/.*\.(cjs|js|mjs)$/.test(file));
check("git:no-javascript-tooling", () => forbiddenJavascriptTooling.length === 0, { forbiddenJavascriptTooling });

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
  .filter((file) => /\.(cff|css|md|mdx|txt|tsx?|jsx?|json|ya?ml)$/i.test(file))
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
