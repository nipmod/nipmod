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
  "ARCHITECTURE.md",
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
  "docs/product/positioning.md",
  "docs/security/threat-model.md",
  "docs/security/data-retention.md",
  "docs/security/package-metadata-is-untrusted.md",
  "docs/api/search-inspect-install-plan.md",
  "docs/archive/package-intelligence-lifecycle.md",
  "docs/comparison/README.md",
  "docs/github-excellence.md",
  "docs/release-process.md",
  "docs/decisions/README.md",
  "docs/decisions/0001-api-first-package-network.md",
  "docs/decisions/0002-external-source-ownership.md",
  "docs/decisions/0003-durable-archive-gating.md",
  "docs/specs/public-api.md",
  "docs/specs/source-resolvers.md",
  "docs/specs/source-crawling.md",
  "docs/specs/trust-signals.md",
  "docs/specs/archive-records.md",
  "docs/package-intelligence-schema.sql",
  "docs/api-usage-schema.sql",
  "docs/api-rate-limit-schema.sql",
  "supabase/migrations/20260522073000_package_intelligence_archive.sql",
  "supabase/migrations/20260522151945_api_usage_events.sql",
  "supabase/migrations/20260523084500_api_rate_limit_buckets.sql",
  "docs/security/supply-chain.md",
  "docs/launch/api-beta.md",
  "docs/launch/api-beta-post.md",
  "docs/archive/seed-v1.md",
  "examples/http-api/README.md",
  "examples/http-api/search.ts",
  "examples/http-api/agent-flow.ts",
  "examples/agent-workflow/README.md",
  "examples/agent-workflow/codex.md",
  "examples/agent-workflow/claude-code.md",
  "examples/agent-workflow/mcp-host.md",
  "tools/seed-package-intelligence.ts",
  "tools/api-contract-canary.ts",
  "tools/api-contract-canary.test.ts",
  "tools/archive-depth-canary.ts",
  "tools/archive-depth-canary.test.ts",
  "tools/api-usage-canary.ts",
  "tools/rate-limit-canary.ts",
  "tools/rate-limit-canary.test.ts",
  "tools/install-plan-canary.ts",
  "tools/install-plan-canary.test.ts",
  "tools/source-depth-canary.ts",
  "tools/source-crawler-candidate-audit.ts",
  "tools/source-crawler-candidate-audit.test.ts",
  "tools/release-metadata.ts",
  "tools/release-metadata.test.ts",
  "docs/github-mirror.md",
  ".github/workflows/ci.yml",
  ".github/workflows/archive-drift-review.yml",
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
check("readme:positioning", () => readme.includes("The package intelligence layer for AI agents."));
check("readme:registry-boundary", () => readme.includes("Nipmod does not replace package registries."));
check("readme:core-flow", () => readme.includes("Search supported sources.") && readme.includes("Generate an install plan."));
check("readme:hosted-api", () => readme.includes("API beta access requires a free beta key."));
check("readme:api-search-example", () => readme.includes("https://nipmod.com/api/search?q=http%20client"));
check("readme:no-telegram-example", () => !readme.includes("telegram%20bot") && !readme.includes("node-telegram-bot-api"));
check("readme:no-stale-safe-mode", () => !readme.includes("durable archive env vars") && !readme.includes("Resolver safe mode"));
check("readme:no-duplicate-github-mirror", () => !readme.includes("GitHub mirror"));
check("readme:telegram", () => readme.includes("| Telegram | https://t.me/nipmod |"));
check("readme:npm-token-link", () => readme.includes("| $NPM on Base | https://token.nipmod.com |"));
check("readme:security", () => readme.includes("Security: `SECURITY.md`"));
check("readme:governance", () => readme.includes("Governance: [`GOVERNANCE.md`](GOVERNANCE.md)"));
check("readme:api-spec", () => readme.includes("docs/specs/public-api.md"));
check("readme:architecture", () => readme.includes("ARCHITECTURE.md"));
check("readme:safety-boundary", () => readme.includes("Hosted API") && readme.includes("Search score"));
check("readme:source-crawling-spec", () => readme.includes("docs/specs/source-crawling.md"));
check("readme:api-launch-kit", () => readme.includes("docs/launch/api-beta.md"));
check("readme:no-banned-launch-copy", () => !/the goal is simple|this is exactly|next step is simple/i.test(readme));

const architecture = read("ARCHITECTURE.md");
check("architecture:layers", () => architecture.includes("Resolver") && architecture.includes("Normalizer") && architecture.includes("Trust Engine") && architecture.includes("Policy Engine") && architecture.includes("Install Plan"));
check("architecture:hosted-boundary", () => architecture.includes("Hosted API routes are read-only"));

const positioning = read("docs/product/positioning.md");
check("positioning:core-message", () => positioning.includes("Nipmod does not replace package registries. Nipmod makes existing package ecosystems readable and safer for AI agents."));
check("positioning:not-new-registry", () => positioning.includes("not a replacement for npm, PyPI, Hugging Face, GitHub or MCP registries"));

const lifecycle = read("docs/archive/package-intelligence-lifecycle.md");
check("lifecycle:states", () => ["`ephemeral`", "`indexed`", "`confirmed_use`", "`verified`", "`quarantined`", "`blocked`"].every((state) => lifecycle.includes(state)));
check("lifecycle:search-ephemeral", () => lifecycle.includes("Search does not persist durable verified records."));

const threatModel = read("docs/security/threat-model.md");
check("threat-model:metadata-untrusted", () => threatModel.includes("Package metadata remains untrusted") || threatModel.includes("Treat metadata as untrusted data"));
check("threat-model:install-plan-boundary", () => threatModel.includes("Install plans are plans. They do not install."));

const dataRetention = read("docs/security/data-retention.md");
check("data-retention:no-sensitive-fields", () => dataRetention.includes("raw API keys") && dataRetention.includes("raw IP addresses") && dataRetention.includes("raw search queries"));

const apiFlowDoc = read("docs/api/search-inspect-install-plan.md");
check("api-flow:three-calls", () => apiFlowDoc.includes("/api/search") && apiFlowDoc.includes("/api/inspect") && apiFlowDoc.includes("/api/install-plan"));
check("api-flow:no-exec", () => apiFlowDoc.includes("The hosted API never executes the command."));

const publicApiSpec = read("docs/specs/public-api.md");
const archiveDriftWorkflow = read(".github/workflows/archive-drift-review.yml");
const prodMonitorWorkflow = read(".github/workflows/prod-monitor.yml");
const packageJson = read("package.json");
check("public-api:rate-limit-canary", () => publicApiSpec.includes("pnpm rate-limit:canary"));
check("public-api:contract-canary", () => publicApiSpec.includes("pnpm api:contract"));
check("public-api:archive-depth-canary", () => publicApiSpec.includes("pnpm archive:canary"));
check("public-api:archive-drift-review", () => publicApiSpec.includes("pnpm archive:drift"));
check("public-api:scheduled-archive-drift-review", () => archiveDriftWorkflow.includes("archive:drift") && archiveDriftWorkflow.includes("archive-drift-review.json"));
check("public-api:scheduled-github-source-token", () => archiveDriftWorkflow.includes("NIPMOD_GITHUB_TOKEN") && archiveDriftWorkflow.includes("github.token"));
check(
  "public-api:scheduled-canary-secret",
  () =>
    publicApiSpec.includes("NIPMOD_CANARY_API_KEY") &&
    archiveDriftWorkflow.includes("NIPMOD_CANARY_API_KEY") &&
    prodMonitorWorkflow.includes("NIPMOD_CANARY_API_KEY")
);
check("public-api:install-plan-canary", () => publicApiSpec.includes("pnpm install-plan:canary"));
check(
  "public-api:production-excellence-live-gate",
  () => packageJson.includes('"excellence:live"') && prodMonitorWorkflow.includes("pnpm excellence:live -- --base-url https://nipmod.com")
);

const apiKeyRequiredRoutes = [
  "site/app/api/admin/keys/route.ts",
  "site/app/api/admin/summary/route.ts",
  "site/app/api/archive/confirm/route.ts",
  "site/app/api/archive/prepare/route.ts",
  "site/app/api/archive/search/route.ts",
  "site/app/api/archive/status/route.ts",
  "site/app/api/inspect/route.ts",
  "site/app/api/install-plan/route.ts",
  "site/app/api/mcp/route.ts",
  "site/app/api/openapi/route.ts",
  "site/app/api/search/route.ts",
  "site/app/api/sources/health/route.ts",
  "site/app/api/stats/route.ts",
  "site/app/api/usage/stats/route.ts"
];
for (const routeFile of apiKeyRequiredRoutes) {
  const routeSource = read(routeFile);
  check(`api-key-boundary:${routeFile}`, () => routeSource.includes("requireApiKey: true"));
}
const resolveRoute = read("site/app/api/resolve/route.ts");
check("api-key-boundary:resolve-reuses-search", () => resolveRoute.includes('from "../search/route"'));
const betaKeyRoute = read("site/app/api/keys/beta/route.ts");
check(
  "api-key-boundary:self-serve-beta-public-only",
  () => betaKeyRoute.includes("issueSelfServeBetaApiKey") && !betaKeyRoute.includes("requireApiKey: true")
);
const monitorRoute = read("site/app/api/monitor/route.ts");
check(
  "api-key-boundary:monitor-secret",
  () => monitorRoute.includes("CRON_SECRET") && monitorRoute.includes("NIPMOD_MONITOR_SECRET") && monitorRoute.includes("Bearer")
);
const alertSink = read("site/lib/alert-sink.ts");
check("api-key-boundary:alert-sink-token", () => alertSink.includes("alert sink not configured") && alertSink.includes("Bearer"));

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
const apiBetaPost = read("docs/launch/api-beta-post.md");
check("launch-post:scoped-copy", () => apiBetaPost.includes("Hosted API calls never install or write locally.") && apiBetaPost.includes("Free API beta, key-required and rate limited."));
const seedV1 = read("docs/archive/seed-v1.md");
check("seed-v1:source-scope", () => seedV1.includes("not a bulk mirror") && seedV1.includes("verified ownership claim"));
check("seed-v1:operator-command", () => seedV1.includes("pnpm archive:seed") && seedV1.includes("--env-file-path"));

const sourceCrawling = read("docs/specs/source-crawling.md");
check("source-crawling:api-first", () => sourceCrawling.includes("Prefer official APIs."));
check("source-crawling:robots-terms", () => sourceCrawling.includes("robots") && sourceCrawling.includes("terms"));
check("source-crawling:candidate-crawlee", () => sourceCrawling.includes("`apify/crawlee`") && sourceCrawling.includes("Preferred future crawler worker candidate"));
check("source-crawling:candidate-agpl-boundary", () => sourceCrawling.includes("`firecrawl/firecrawl`") && sourceCrawling.includes("AGPL"));
check("source-crawling:audit-command", () => sourceCrawling.includes("pnpm crawler:audit"));

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
check("gitignore:release-sbom-trackable", () => !gitignore.includes("site/public/releases/*.sbom.json"));
check("gitignore:release-provenance-trackable", () => !gitignore.includes("site/public/releases/*.provenance.json"));
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
