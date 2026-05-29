#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canaryAuthHeaders, readCanaryApiKey } from "./canary-auth.ts";

type BenchmarkProvider =
  | "deps.dev"
  | "native-registry"
  | "nipmod"
  | "openssf-scorecard"
  | "osv"
  | "raw-agent"
  | "snyk"
  | "socket";

type BenchmarkSource = "github" | "huggingface-dataset" | "huggingface-model" | "mcp" | "npm" | "pypi";
type CategoryKey = "agent-readiness" | "execution-preflight" | "security-evidence" | "source-resolution";
type ObservationStatus = "pass" | "warn" | "fail" | "skip";
type Dimension =
  | "advisory"
  | "agent_json"
  | "identity"
  | "install_plan"
  | "machine_readable"
  | "metadata"
  | "multi_source"
  | "package_behavior"
  | "prompt_boundary"
  | "provenance"
  | "read_only"
  | "repo_posture"
  | "search"
  | "source_depth"
  | "version";

interface CompetitiveBenchmarkOptions {
  baseUrl?: string;
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
  includeLive?: boolean;
  timeoutMs?: number;
}

interface BenchmarkCase {
  ecosystem?: "npm" | "PyPI";
  expectedPackage?: string;
  expectedVulnerability?: boolean;
  id: string;
  name: string;
  purl?: string;
  query?: string;
  repo?: string;
  source: BenchmarkSource;
  version?: string;
}

interface ProviderObservation {
  caseId: string;
  dimensions: Partial<Record<Dimension, boolean>>;
  durationMs: number;
  evidence: string[];
  limitation?: string;
  provider: BenchmarkProvider;
  score: number;
  status: ObservationStatus;
}

interface ProviderSummary {
  applicable: number;
  coveragePct: number;
  depthScore: number;
  fail: number;
  medianLatencyMs: number | null;
  pass: number;
  provider: BenchmarkProvider;
  score: number;
  skip: number;
  sourceCoveragePct: number;
  warn: number;
}

interface CategoryDefinition {
  description: string;
  dimensions: string;
  key: CategoryKey;
  title: string;
  weights: Partial<Record<Dimension, number>>;
}

const DEFAULT_BASE_URL = "https://nipmod.com";
const USER_AGENT = "nipmod-competitive-benchmark/1.0 (+https://nipmod.com)";
const CREDENTIAL_FILES = [
  resolve(homedir(), ".config/nipmod/competitor-benchmark.env")
];

const CASES: BenchmarkCase[] = [
  {
    ecosystem: "npm",
    expectedPackage: "zod",
    id: "npm-schema-zod",
    name: "TypeScript schema validation",
    purl: "pkg:npm/zod@3.25.76",
    query: "schema validation",
    source: "npm",
    version: "3.25.76"
  },
  {
    ecosystem: "npm",
    expectedPackage: "lodash",
    expectedVulnerability: true,
    id: "npm-vulnerable-lodash",
    name: "Known vulnerable npm package",
    purl: "pkg:npm/lodash@4.17.20",
    query: "lodash utility library",
    source: "npm",
    version: "4.17.20"
  },
  {
    ecosystem: "PyPI",
    expectedPackage: "requests",
    id: "pypi-http-requests",
    name: "Python HTTP client",
    purl: "pkg:pypi/requests@2.32.5",
    query: "python http client",
    source: "pypi",
    version: "2.32.5"
  },
  {
    ecosystem: "PyPI",
    expectedPackage: "pydantic",
    id: "pypi-schema-pydantic",
    name: "Python schema validation",
    purl: "pkg:pypi/pydantic@2.11.0",
    query: "python schema validation",
    source: "pypi",
    version: "2.11.0"
  },
  {
    expectedPackage: "sentence-transformers/all-MiniLM-L6-v2",
    id: "hf-embedding-model",
    name: "Embedding model",
    query: "semantic search embeddings model",
    source: "huggingface-model"
  },
  {
    expectedPackage: "rajpurkar/squad",
    id: "hf-dataset-squad",
    name: "Question answering dataset",
    query: "question answering dataset",
    source: "huggingface-dataset"
  },
  {
    expectedPackage: "ac.tandem/docs-mcp",
    id: "mcp-docs-server",
    name: "MCP docs server",
    query: "tandem docs mcp server",
    source: "mcp"
  },
  {
    expectedPackage: "vercel/next.js",
    id: "github-nextjs",
    name: "GitHub repository security posture",
    query: "next.js github repo",
    repo: "vercel/next.js",
    source: "github"
  }
];

const DIMENSION_WEIGHTS: Record<Dimension, number> = {
  advisory: 12,
  agent_json: 9,
  identity: 8,
  install_plan: 14,
  machine_readable: 8,
  metadata: 8,
  multi_source: 5,
  package_behavior: 10,
  prompt_boundary: 10,
  provenance: 8,
  read_only: 10,
  repo_posture: 8,
  search: 8,
  source_depth: 12,
  version: 6
};

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    description: "Can the system resolve the right upstream object and return enough source context before an agent moves toward install?",
    dimensions: "search, identity, version, metadata, source depth, multi-source scope",
    key: "source-resolution",
    title: "Source resolution",
    weights: {
      identity: 18,
      metadata: 14,
      multi_source: 16,
      search: 18,
      source_depth: 22,
      version: 12
    }
  },
  {
    description: "Can the system return security evidence beyond a name match: advisories, provenance, repository posture and package behavior?",
    dimensions: "advisories, provenance, repository posture, package behavior",
    key: "security-evidence",
    title: "Security evidence",
    weights: {
      advisory: 24,
      metadata: 8,
      package_behavior: 24,
      provenance: 20,
      repo_posture: 18,
      version: 6
    }
  },
  {
    description: "Can the system describe what would run, keep hosted checks read-only and expose the execution boundary before workspace writes?",
    dimensions: "install plan, read-only boundary, package behavior, prompt boundary",
    key: "execution-preflight",
    title: "Execution preflight",
    weights: {
      agent_json: 8,
      install_plan: 32,
      package_behavior: 14,
      prompt_boundary: 18,
      read_only: 28
    }
  },
  {
    description: "Can an agent consume the result as an action-ready decision object, not just a generic API response or human page?",
    dimensions: "agent decision JSON, install boundary, source evidence, machine output",
    key: "agent-readiness",
    title: "Agent readiness",
    weights: {
      agent_json: 34,
      identity: 4,
      install_plan: 22,
      machine_readable: 6,
      prompt_boundary: 14,
      read_only: 12,
      source_depth: 8
    }
  }
];

export async function runCompetitiveBenchmark(options: CompetitiveBenchmarkOptions = {}) {
  const startedAt = Date.now();
  const fetchFn = options.fetchFn ?? fetch;
  const env = {
    ...(await readCredentialEnv()),
    ...process.env,
    ...options.env
  };
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const observations: ProviderObservation[] = [];

  observations.push(...rawAgentBaseline(CASES));
  observations.push(...(await nativeRegistryTrack(CASES, fetchFn, options.timeoutMs)));
  observations.push(...(await osvTrack(CASES, fetchFn, options.timeoutMs)));
  observations.push(...(await depsDevTrack(CASES, fetchFn, options.timeoutMs)));
  observations.push(...(await socketTrack(CASES, env, fetchFn, options.timeoutMs)));
  observations.push(...(await snykTrack(CASES, env, fetchFn, options.timeoutMs)));
  observations.push(...(await scorecardTrack(CASES, fetchFn, options.timeoutMs)));

  if (options.includeLive !== false) {
    observations.push(...(await nipmodTrack(CASES, baseUrl, env, fetchFn, options.timeoutMs)));
  }

  const categoryBreakdown = buildCategoryBreakdown(observations);
  const summaries = summarizeProviders(observations, categoryBreakdown);
  const matrix = buildMatrix(observations);
  const report = {
    articleDraft: articleDraft(summaries),
    cases: CASES.map(({ ecosystem, expectedPackage, expectedVulnerability, id, name, source }) => ({
      ecosystem,
      expectedPackage,
      expectedVulnerability: Boolean(expectedVulnerability),
      id,
      name,
      source
    })),
    categoryBreakdown,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    formatVersion: 1,
    headlineFindings: headlineFindings(summaries, observations),
    matrix,
    methodology: {
      caseSelectionPolicy: [
        "Cases must represent a real pre-install agent decision, not a synthetic point chosen only for Nipmod.",
        "At least one case must cover each Nipmod public source surface before a public snapshot is treated as current.",
        "Specialized tools are scored only on the dimensions they expose, with unsupported sources shown as scope limits.",
        "Any direct competitor claim must be supported by the current JSON and must not include excluded CLI, SCM, firewall or paid platform products."
      ],
      claimBoundary: [
        "This is an agent package-intelligence benchmark, not a malware-free guarantee.",
        "Scores measure whether a system returns useful pre-install decision evidence for agents.",
        "Direct competitor names are separated by dimension because OSV, deps.dev, Socket, Snyk, Scorecard and native registries do different jobs.",
        "The main score is coverage-adjusted across the full agent preflight case set. Specialized evidence feeds keep their applicable depth score separately.",
        "No paid inference calls, package installs, repository clones, artifact unpacking or workspace writes are performed."
      ],
      categories: CATEGORY_DEFINITIONS.map(({ key, title, dimensions, description, weights }) => ({
        description,
        dimensions,
        key,
        title,
        weights
      })),
      dimensions: DIMENSION_WEIGHTS,
      sources: [
        "Nipmod live API search, inspect and install-plan",
        "Native npm, PyPI, GitHub, Hugging Face and MCP public metadata",
        "OSV vulnerability API",
        "deps.dev package metadata and advisory API",
        "Socket PURL API when a token is configured",
        "Snyk REST API when a token and plan allow package endpoints",
        "OpenSSF Scorecard public API"
      ],
      reviewerStatus: "product benchmark with explicit scope limits; not an independent academic security benchmark"
    },
    observations,
    publishableClaims: publishableClaims(summaries, observations),
    summaries,
    type: "dev.nipmod.competitive-benchmark.v1"
  };
  return report;
}

function rawAgentBaseline(cases: BenchmarkCase[]): ProviderObservation[] {
  return cases.map((testCase) =>
    observation("raw-agent", testCase.id, "warn", 0, ["Baseline: direct agent install/pull flow has no independent preflight evidence layer."], {
      agent_json: false,
      identity: false,
      install_plan: false,
      machine_readable: false,
      package_behavior: false,
      prompt_boundary: false,
      read_only: false,
      search: Boolean(testCase.query)
    }, "Represents no dedicated package-intelligence layer.")
  );
}

async function nipmodTrack(
  cases: BenchmarkCase[],
  baseUrl: string,
  env: Record<string, string | undefined>,
  fetchFn: typeof fetch,
  timeoutMs?: number
): Promise<ProviderObservation[]> {
  const observations: ProviderObservation[] = [];
  let apiKey = env.NIPMOD_BENCHMARK_API_KEY ?? env.NIPMOD_CANARY_API_KEY ?? env.NIPMOD_API_KEY ?? "";
  try {
    if (!apiKey) {
      apiKey = await readCanaryApiKey({
        baseUrl,
        fetchFn,
        label: "competitive-benchmark",
        userAgent: USER_AGENT
      });
    }
  } catch (error) {
    return cases.map((testCase) =>
      observation("nipmod", testCase.id, "fail", 0, [errorMessage(error)], {}, "Could not issue or read a Nipmod benchmark API key.")
    );
  }

  for (const testCase of cases) {
    const started = Date.now();
    try {
      const headers = {
        accept: "application/json",
        ...canaryAuthHeaders(apiKey),
        "user-agent": USER_AGENT
      };
      let searchPayload: UnknownRecord | null = null;
      const searchEvidence: string[] = [];
      if (testCase.query) {
        try {
          const searchUrl = `${baseUrl}/api/search?q=${encodeURIComponent(testCase.query)}&sources=${encodeURIComponent(toNipmodSource(testCase.source))}&limit=5`;
          searchPayload = await fetchJson(searchUrl, { headers }, fetchFn, timeoutMs);
        } catch (error) {
          searchEvidence.push(`search warning ${errorMessage(error)}`);
        }
      }
      const name = testCase.expectedPackage;
      if (!name) {
        throw new Error("case has no expected package");
      }
      const inspectUrl = `${baseUrl}/api/inspect?source=${encodeURIComponent(toNipmodSource(testCase.source))}&name=${encodeURIComponent(name)}`;
      const inspectPayload = await fetchJson(inspectUrl, { headers }, fetchFn, timeoutMs);
      const planUrl = `${baseUrl}/api/install-plan?source=${encodeURIComponent(toNipmodSource(testCase.source))}&name=${encodeURIComponent(name)}`;
      const planPayload = await fetchJson(planUrl, { headers }, fetchFn, timeoutMs);

      const record = (inspectPayload.record ?? inspectPayload.package ?? inspectPayload) as UnknownRecord;
      const plan = (planPayload.plan ?? {}) as UnknownRecord;
      const safety = (planPayload.safety ?? {}) as UnknownRecord;
      const evidence = [
        `search total ${numberOrNull(searchPayload?.total) ?? "n/a"}`,
        ...searchEvidence,
        `trust score ${numberOrNull((record.trust as UnknownRecord | undefined)?.score) ?? "n/a"}`,
        `source evidence ${numberOrNull((record.sourceEvidence as UnknownRecord | undefined)?.depthScore) ?? "n/a"}`,
        `install writes ${Array.isArray(plan.writes) ? plan.writes.length : "n/a"}`,
        `blocked ${String(Boolean(safety.blocked))}`
      ];
      const status: ObservationStatus = searchEvidence.length > 0 ? "warn" : "pass";
      observations.push(
        observation("nipmod", testCase.id, status, Date.now() - started, evidence, {
          advisory: Boolean((record.trust as UnknownRecord | undefined)?.signals),
          agent_json: Boolean((record.agentRecommendation as UnknownRecord | undefined)?.workspaceWriteAllowed === false),
          identity: Boolean(record.id && record.originalUrl),
          install_plan: Array.isArray(plan.writes),
          machine_readable: true,
          metadata: Boolean(record.description || record.license),
          multi_source: true,
          package_behavior: Boolean(record.artifactIntelligence || (record.trust as UnknownRecord | undefined)?.warnings),
          prompt_boundary: Boolean(record.sourceEvidence),
          provenance: Boolean(record.sourceEvidence),
          repo_posture: testCase.source === "github" && Boolean(record.sourceEvidence),
          read_only: Array.isArray(plan.writes) && plan.writes.length === 0,
          search: Boolean(searchPayload?.type),
          source_depth: numberOrNull((record.sourceEvidence as UnknownRecord | undefined)?.depthScore) !== null,
          version: Boolean(record.version)
        })
      );
    } catch (error) {
      observations.push(observation("nipmod", testCase.id, "fail", Date.now() - started, [errorMessage(error)], {}));
    }
  }
  return observations;
}

async function nativeRegistryTrack(cases: BenchmarkCase[], fetchFn: typeof fetch, timeoutMs?: number): Promise<ProviderObservation[]> {
  const observations: ProviderObservation[] = [];
  for (const testCase of cases) {
    const started = Date.now();
    try {
      if (testCase.source === "npm") {
        const name = testCase.expectedPackage ?? "";
        const search = testCase.query
          ? await fetchJson(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(testCase.query)}&size=5`, {}, fetchFn, timeoutMs)
          : null;
        const metadata = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {}, fetchFn, timeoutMs);
        observations.push(
          observation("native-registry", testCase.id, "pass", Date.now() - started, [
            `npm search objects ${Array.isArray(search?.objects) ? search.objects.length : "n/a"}`,
            `versions ${Object.keys((metadata.versions as UnknownRecord | undefined) ?? {}).length}`
          ], {
            identity: Boolean(metadata.name),
            machine_readable: true,
            metadata: Boolean(metadata.description || metadata.license),
            search: Boolean(search),
            version: Boolean((metadata["dist-tags"] as UnknownRecord | undefined)?.latest)
          })
        );
      } else if (testCase.source === "pypi") {
        const name = testCase.expectedPackage ?? "";
        const metadata = await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, {}, fetchFn, timeoutMs);
        const info = (metadata.info ?? {}) as UnknownRecord;
        observations.push(
          observation("native-registry", testCase.id, "pass", Date.now() - started, [
            `PyPI releases ${Object.keys((metadata.releases as UnknownRecord | undefined) ?? {}).length}`,
            `vulnerabilities ${Array.isArray(metadata.vulnerabilities) ? metadata.vulnerabilities.length : "n/a"}`
          ], {
            advisory: Array.isArray(metadata.vulnerabilities),
            identity: Boolean(info.name),
            machine_readable: true,
            metadata: Boolean(info.summary || info.license),
            version: Boolean(info.version)
          })
        );
      } else if (testCase.source === "github" && testCase.repo) {
        const metadata = await fetchJson(`https://api.github.com/repos/${testCase.repo}`, { headers: { "user-agent": USER_AGENT } }, fetchFn, timeoutMs);
        observations.push(
          observation("native-registry", testCase.id, "pass", Date.now() - started, [
            `stars ${numberOrNull(metadata.stargazers_count) ?? "n/a"}`,
            `open issues ${numberOrNull(metadata.open_issues_count) ?? "n/a"}`
          ], {
            identity: Boolean(metadata.full_name),
            machine_readable: true,
            metadata: Boolean(metadata.description || metadata.license),
            repo_posture: Boolean(metadata.default_branch),
            version: Boolean(metadata.pushed_at)
          })
        );
      } else if (testCase.source === "huggingface-model") {
        const name = testCase.expectedPackage ?? "";
        const metadata = await fetchJson(`https://huggingface.co/api/models/${encodeHubRepoPath(name)}`, {}, fetchFn, timeoutMs);
        observations.push(
          observation("native-registry", testCase.id, "pass", Date.now() - started, [
            `downloads ${numberOrNull(metadata.downloads) ?? "n/a"}`,
            `siblings ${Array.isArray(metadata.siblings) ? metadata.siblings.length : "n/a"}`
          ], {
            identity: Boolean(metadata.id || metadata.modelId),
            machine_readable: true,
            metadata: Boolean(metadata.cardData || metadata.tags),
            package_behavior: Array.isArray(metadata.siblings),
            version: Boolean(metadata.sha || metadata.lastModified)
          })
        );
      } else if (testCase.source === "huggingface-dataset") {
        const name = testCase.expectedPackage ?? "";
        const metadata = await fetchJson(`https://huggingface.co/api/datasets/${encodeHubRepoPath(name)}`, {}, fetchFn, timeoutMs);
        observations.push(
          observation("native-registry", testCase.id, "pass", Date.now() - started, [
            `downloads ${numberOrNull(metadata.downloads) ?? "n/a"}`,
            `siblings ${Array.isArray(metadata.siblings) ? metadata.siblings.length : "n/a"}`
          ], {
            identity: Boolean(metadata.id || metadata.datasetId),
            machine_readable: true,
            metadata: Boolean(metadata.cardData || metadata.tags),
            package_behavior: Array.isArray(metadata.siblings),
            version: Boolean(metadata.sha || metadata.lastModified)
          })
        );
      } else if (testCase.source === "mcp") {
        const registry = await fetchJson("https://registry.modelcontextprotocol.io/v0/servers", {}, fetchFn, timeoutMs);
        const servers = Array.isArray(registry.servers) ? registry.servers : Array.isArray(registry) ? registry : [];
        observations.push(
          observation("native-registry", testCase.id, servers.length > 0 ? "pass" : "warn", Date.now() - started, [`MCP servers ${servers.length}`], {
            identity: servers.length > 0,
            machine_readable: true,
            metadata: servers.length > 0,
            search: true
          })
        );
      } else {
        observations.push(skip("native-registry", testCase.id, "No native registry adapter for this case."));
      }
    } catch (error) {
      observations.push(observation("native-registry", testCase.id, "fail", Date.now() - started, [errorMessage(error)], {}));
    }
  }
  return observations;
}

async function osvTrack(cases: BenchmarkCase[], fetchFn: typeof fetch, timeoutMs?: number): Promise<ProviderObservation[]> {
  const supported = cases.filter((testCase) => testCase.ecosystem && testCase.expectedPackage && testCase.version);
  const observations: ProviderObservation[] = cases.filter((testCase) => !supported.includes(testCase)).map((testCase) => skip("osv", testCase.id, "OSV is an advisory lookup, not a broad package search layer."));
  for (const testCase of supported) {
    const started = Date.now();
    try {
      const payload = await fetchJson(
        "https://api.osv.dev/v1/query",
        {
          body: JSON.stringify({
            package: { ecosystem: testCase.ecosystem, name: testCase.expectedPackage },
            version: testCase.version
          }),
          headers: { "content-type": "application/json", "user-agent": USER_AGENT },
          method: "POST"
        },
        fetchFn,
        timeoutMs
      );
      const vulns = Array.isArray(payload.vulns) ? payload.vulns : [];
      observations.push(
        observation("osv", testCase.id, "pass", Date.now() - started, [`vulnerabilities ${vulns.length}`], {
          advisory: true,
          identity: Boolean(testCase.expectedPackage),
          machine_readable: true,
          version: Boolean(testCase.version)
        })
      );
    } catch (error) {
      observations.push(observation("osv", testCase.id, "fail", Date.now() - started, [errorMessage(error)], {}));
    }
  }
  return observations;
}

async function depsDevTrack(cases: BenchmarkCase[], fetchFn: typeof fetch, timeoutMs?: number): Promise<ProviderObservation[]> {
  const supported = cases.filter((testCase) => testCase.ecosystem && testCase.expectedPackage && testCase.version);
  const observations: ProviderObservation[] = cases.filter((testCase) => !supported.includes(testCase)).map((testCase) => skip("deps.dev", testCase.id, "deps.dev package query applies to package ecosystems, not MCP/HF/repo search."));
  for (const testCase of supported) {
    const started = Date.now();
    try {
      const system = testCase.ecosystem === "PyPI" ? "PYPI" : "NPM";
      const query = new URLSearchParams({
        "versionKey.name": testCase.expectedPackage ?? "",
        "versionKey.system": system,
        "versionKey.version": testCase.version ?? ""
      });
      const payload = await fetchJson(`https://api.deps.dev/v3/query?${query.toString()}`, {}, fetchFn, timeoutMs);
      const result = Array.isArray(payload.results) ? payload.results[0] as UnknownRecord | undefined : undefined;
      const version = (result?.version as UnknownRecord | undefined) ?? {};
      const advisoryKeys = Array.isArray(version.advisoryKeys) ? version.advisoryKeys : [];
      observations.push(
        observation("deps.dev", testCase.id, result ? "pass" : "warn", Date.now() - started, [
          `results ${Array.isArray(payload.results) ? payload.results.length : 0}`,
          `advisories ${advisoryKeys.length}`
        ], {
          advisory: true,
          identity: Boolean(result),
          machine_readable: true,
          metadata: Boolean(version.licenses || version.links),
          provenance: Boolean(version.links),
          version: Boolean(version.versionKey)
        })
      );
    } catch (error) {
      observations.push(observation("deps.dev", testCase.id, "fail", Date.now() - started, [errorMessage(error)], {}));
    }
  }
  return observations;
}

async function socketTrack(cases: BenchmarkCase[], env: Record<string, string | undefined>, fetchFn: typeof fetch, timeoutMs?: number): Promise<ProviderObservation[]> {
  const token = env.SOCKET_API_KEY;
  if (!token) {
    return cases.map((testCase) => skip("socket", testCase.id, "SOCKET_API_KEY is not configured."));
  }
  const org = await socketOrgSlug(token, fetchFn, timeoutMs).catch(() => null);
  if (!org) {
    return cases.map((testCase) => observation("socket", testCase.id, "fail", 0, ["Socket auth or organization lookup failed."], {}));
  }
  const observations: ProviderObservation[] = [];
  for (const testCase of cases) {
    if (!testCase.purl) {
      observations.push(skip("socket", testCase.id, "Socket PURL lookup applies to package cases."));
      continue;
    }
    const started = Date.now();
    try {
      const response = await fetchWithTimeout(
        `https://api.socket.dev/v0/orgs/${encodeURIComponent(org)}/purl?alerts=true&compact=true&purlErrors=true&cachedResultsOnly=true&summary=true&timeoutSec=8`,
        {
          body: JSON.stringify({ components: [{ purl: testCase.purl }] }),
          headers: {
            accept: "application/x-ndjson",
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            "user-agent": USER_AGENT
          },
          method: "POST"
        },
        fetchFn,
        timeoutMs
      );
      const text = await response.text();
      if (!response.ok) {
        if (response.status === 429) {
          observations.push(
            observation("socket", testCase.id, "warn", Date.now() - started, ["Socket PURL lookup returned 429 rate limit."], {
              machine_readable: true
            }, "Socket package lookup was rate-limited by the current token or plan.")
          );
          continue;
        }
        throw new Error(`Socket PURL lookup returned ${response.status}`);
      }
      const rows = parseNdjson(text);
      const packageRows = rows.filter((row) => row._type !== "summary");
      const alertCount = packageRows.reduce((sum, row) => sum + (Array.isArray(row.alerts) ? row.alerts.length : 0), 0);
      observations.push(
        observation("socket", testCase.id, packageRows.length > 0 ? "pass" : "warn", Date.now() - started, [
          `rows ${rows.length}`,
          `alerts ${alertCount}`
        ], {
          advisory: alertCount > 0 || testCase.expectedVulnerability === false,
          identity: packageRows.length > 0,
          machine_readable: true,
          metadata: packageRows.length > 0,
          package_behavior: alertCount > 0,
          version: Boolean(testCase.version)
        })
      );
    } catch (error) {
      observations.push(observation("socket", testCase.id, "fail", Date.now() - started, [errorMessage(error)], {}));
    }
  }
  return observations;
}

async function snykTrack(cases: BenchmarkCase[], env: Record<string, string | undefined>, fetchFn: typeof fetch, timeoutMs?: number): Promise<ProviderObservation[]> {
  const token = env.SNYK_TOKEN;
  if (!token) {
    return cases.map((testCase) => skip("snyk", testCase.id, "SNYK_TOKEN is not configured."));
  }
  const org = await snykOrgId(token, fetchFn, timeoutMs).catch(() => null);
  if (!org) {
    return cases.map((testCase) => observation("snyk", testCase.id, "fail", 0, ["Snyk auth or organization lookup failed."], {}));
  }
  const observations: ProviderObservation[] = [];
  for (const testCase of cases) {
    if (!testCase.ecosystem || !testCase.expectedPackage) {
      observations.push(skip("snyk", testCase.id, "Snyk package endpoint applies to package cases."));
      continue;
    }
    const started = Date.now();
    try {
      const ecosystem = testCase.ecosystem === "PyPI" ? "pip" : "npm";
      const url = `https://api.snyk.io/rest/orgs/${encodeURIComponent(org)}/ecosystems/${ecosystem}/packages/${encodeURIComponent(testCase.expectedPackage)}?version=2025-11-05`;
      const response = await fetchWithTimeout(
        url,
        {
          headers: {
            accept: "application/vnd.api+json",
            authorization: `token ${token}`,
            "content-type": "application/vnd.api+json",
            "user-agent": USER_AGENT
          }
        },
        fetchFn,
        timeoutMs
      );
      const text = await response.text();
      let payload: UnknownRecord = {};
      try {
        payload = text ? JSON.parse(text) as UnknownRecord : {};
      } catch {
        payload = {};
      }
      if (response.status === 403) {
        observations.push(
          observation("snyk", testCase.id, "warn", Date.now() - started, ["Authenticated, but package endpoint is not available on the current token or plan."], {
            identity: false,
            machine_readable: true
          }, "Package Health API returned 403 for the current token/plan.")
        );
        continue;
      }
      if (!response.ok) {
        throw new Error(`Snyk package endpoint returned ${response.status}`);
      }
      const data = (payload.data ?? {}) as UnknownRecord;
      const attributes = (data.attributes ?? {}) as UnknownRecord;
      observations.push(
        observation("snyk", testCase.id, "pass", Date.now() - started, [`attributes ${Object.keys(attributes).length}`], {
          advisory: Boolean(attributes.vulnerabilities || attributes.issues),
          identity: Boolean(data.id),
          machine_readable: true,
          metadata: Object.keys(attributes).length > 0,
          version: Boolean(testCase.version)
        })
      );
    } catch (error) {
      observations.push(observation("snyk", testCase.id, "fail", Date.now() - started, [errorMessage(error)], {}));
    }
  }
  return observations;
}

async function scorecardTrack(cases: BenchmarkCase[], fetchFn: typeof fetch, timeoutMs?: number): Promise<ProviderObservation[]> {
  const observations: ProviderObservation[] = [];
  for (const testCase of cases) {
    if (!testCase.repo) {
      observations.push(skip("openssf-scorecard", testCase.id, "OpenSSF Scorecard applies to GitHub repository cases."));
      continue;
    }
    const started = Date.now();
    try {
      const payload = await fetchJson(`https://api.scorecard.dev/projects/github.com/${testCase.repo}`, {}, fetchFn, timeoutMs);
      observations.push(
        observation("openssf-scorecard", testCase.id, "pass", Date.now() - started, [
          `score ${numberOrNull(payload.score) ?? "n/a"}`,
          `checks ${Array.isArray(payload.checks) ? payload.checks.length : "n/a"}`
        ], {
          identity: Boolean((payload.repo as UnknownRecord | undefined)?.name),
          machine_readable: true,
          repo_posture: typeof payload.score === "number"
        })
      );
    } catch (error) {
      observations.push(observation("openssf-scorecard", testCase.id, "fail", Date.now() - started, [errorMessage(error)], {}));
    }
  }
  return observations;
}

function observation(
  provider: BenchmarkProvider,
  caseId: string,
  status: ObservationStatus,
  durationMs: number,
  evidence: string[],
  dimensions: Partial<Record<Dimension, boolean>>,
  limitation?: string
): ProviderObservation {
  return {
    caseId,
    dimensions,
    durationMs,
    evidence: evidence.slice(0, 8),
    limitation,
    provider,
    score: scoreDimensions(dimensions, status),
    status
  };
}

function skip(provider: BenchmarkProvider, caseId: string, limitation: string): ProviderObservation {
  return observation(provider, caseId, "skip", 0, [], {}, limitation);
}

function scoreDimensions(dimensions: Partial<Record<Dimension, boolean>>, status: ObservationStatus): number {
  if (status === "skip") return 0;
  if (status === "fail") return 0;
  const possible = Object.values(DIMENSION_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  const earned = Object.entries(dimensions).reduce((sum, [dimension, enabled]) => sum + (enabled ? DIMENSION_WEIGHTS[dimension as Dimension] : 0), 0);
  const base = Math.round((earned / possible) * 100);
  return status === "warn" ? Math.round(base * 0.7) : base;
}

function summarizeProviders(
  observations: ProviderObservation[],
  categoryBreakdown: Array<{ key: CategoryKey; tracks: Array<{ provider: BenchmarkProvider; score: number }> }>
): ProviderSummary[] {
  const providers = [...new Set(observations.map((item) => item.provider))].sort();
  return providers.map((provider) => {
    const rows = observations.filter((item) => item.provider === provider);
    const applicableRows = rows.filter((item) => item.status !== "skip");
    const pass = applicableRows.filter((item) => item.status === "pass").length;
    const warn = applicableRows.filter((item) => item.status === "warn").length;
    const fail = applicableRows.filter((item) => item.status === "fail").length;
    const latencies = applicableRows.filter((item) => item.durationMs > 0).map((item) => item.durationMs).sort((a, b) => a - b);
    const depthScore = applicableRows.length
      ? Math.round(applicableRows.reduce((sum, item) => sum + item.score, 0) / applicableRows.length)
      : 0;
    const categoryScores = categoryBreakdown
      .map((category) => category.tracks.find((track) => track.provider === provider)?.score)
      .filter((score): score is number => typeof score === "number");
    const score = categoryScores.length
      ? Math.round(categoryScores.reduce((sum, value) => sum + value, 0) / categoryScores.length)
      : 0;
    return {
      applicable: applicableRows.length,
      coveragePct: Math.round((pass / Math.max(applicableRows.length, 1)) * 100),
      depthScore,
      fail,
      medianLatencyMs: percentile(latencies, 0.5),
      pass,
      provider,
      score,
      skip: rows.length - applicableRows.length,
      sourceCoveragePct: Math.round((applicableRows.length / Math.max(rows.length, 1)) * 100),
      warn
    };
  });
}

function buildCategoryBreakdown(observations: ProviderObservation[]) {
  const providers = [...new Set(observations.map((item) => item.provider))].sort();
  return CATEGORY_DEFINITIONS.map((category) => ({
    description: category.description,
    dimensions: category.dimensions,
    key: category.key,
    title: category.title,
    tracks: providers
      .map((provider) => {
        const rows = observations.filter((item) => item.provider === provider);
        const score = rows.length
          ? Math.round(rows.reduce((sum, item) => sum + scoreCategory(item, category), 0) / rows.length)
          : 0;
        const applicable = rows.filter((item) => item.status !== "skip").length;
        const pass = rows.filter((item) => item.status === "pass").length;
        return {
          applicable,
          pass,
          provider,
          score,
          sourceCoveragePct: Math.round((applicable / Math.max(rows.length, 1)) * 100)
        };
      })
      .sort((left, right) => right.score - left.score || right.sourceCoveragePct - left.sourceCoveragePct || left.provider.localeCompare(right.provider))
  }));
}

function scoreCategory(observation: ProviderObservation, category: CategoryDefinition): number {
  if (observation.status === "skip" || observation.status === "fail") return 0;
  const possible = Object.values(category.weights).reduce((sum, weight) => sum + weight, 0);
  const earned = Object.entries(category.weights).reduce(
    (sum, [dimension, weight]) => sum + (observation.dimensions[dimension as Dimension] ? weight : 0),
    0
  );
  const base = Math.round((earned / possible) * 100);
  return observation.status === "warn" ? Math.round(base * 0.7) : base;
}

function buildMatrix(observations: ProviderObservation[]) {
  const rows: Record<string, Record<string, { score: number; status: ObservationStatus }>> = {};
  for (const item of observations) {
    rows[item.caseId] ??= {};
    rows[item.caseId][item.provider] = { score: item.score, status: item.status };
  }
  return rows;
}

function headlineFindings(summaries: ProviderSummary[], observations: ProviderObservation[]): string[] {
  const nipmod = summaries.find((summary) => summary.provider === "nipmod");
  const socket = summaries.find((summary) => summary.provider === "socket");
  const snyk = summaries.find((summary) => summary.provider === "snyk");
  const packageCases = CASES.filter((testCase) => testCase.expectedPackage).length;
  const nipmodInstallPlans = observations.filter((item) => item.provider === "nipmod" && item.dimensions.install_plan).length;
  return [
    nipmod ? `Nipmod covered ${nipmod.pass}/${nipmod.applicable} live applicable checks with median latency ${nipmod.medianLatencyMs ?? "n/a"} ms.` : "Nipmod live track did not run.",
    `Nipmod returned install-plan/read-only evidence for ${nipmodInstallPlans}/${packageCases} package/source cases where an agent would otherwise move toward execution.`,
    socket
      ? socket.warn > 0 && socket.pass === 0
        ? `Socket auth worked, but package lookup was rate-limited or plan-limited in ${socket.warn}/${socket.applicable} applicable checks.`
        : `Socket authenticated package lookup passed ${socket.pass}/${socket.applicable} applicable checks.`
      : "Socket track was unavailable.",
    snyk
      ? snyk.warn > 0 && snyk.pass === 0
        ? `Snyk auth worked, but package-health depth was plan-limited in ${snyk.warn}/${snyk.applicable} applicable checks.`
        : `Snyk package endpoint passed ${snyk.pass}/${snyk.applicable} applicable checks.`
      : "Snyk track was unavailable.",
    "OSV, deps.dev and OpenSSF are strong evidence feeds, but they are not agent install-plan layers by themselves."
  ];
}

function articleDraft(summaries: ProviderSummary[]): string {
  const nipmod = summaries.find((summary) => summary.provider === "nipmod");
  const socket = summaries.find((summary) => summary.provider === "socket");
  const deps = summaries.find((summary) => summary.provider === "deps.dev");
  const osv = summaries.find((summary) => summary.provider === "osv");
  const snyk = summaries.find((summary) => summary.provider === "snyk");
  return [
    "Internal article draft, review before publishing.",
    "",
    "AI agents are becoming package consumers. They search registries, pull models, inspect repos, connect MCP servers and eventually move toward execution. Existing security tools already cover important parts of that world, but the agent workflow creates a narrower question: what evidence is available before an agent touches a workspace?",
    "",
    "We built an internal benchmark around that pre-install moment. It does not rank every company on one generic security number. OSV is measured as an advisory feed. deps.dev is measured as package metadata and dependency context. Socket is measured through authenticated PURL lookups when the token and plan allow it. Snyk is measured through its authenticated API and package endpoint availability. OpenSSF Scorecard is measured as repository posture. Native registries remain the source of truth for upstream metadata.",
    "",
    `In the current run, Nipmod passed ${nipmod?.pass ?? 0}/${nipmod?.applicable ?? 0} live applicable checks and scored ${nipmod?.score ?? "n/a"} on agent package-decision depth. OSV scored ${osv?.score ?? "n/a"} as an advisory-only baseline. deps.dev scored ${deps?.score ?? "n/a"} as a metadata and advisory baseline. Socket scored ${socket?.score ?? "n/a"}${socket?.warn ? " with token or plan rate limits affecting package lookup" : " where authenticated PURL lookup was available"}. Snyk scored ${snyk?.score ?? "n/a"}${snyk?.warn ? " because auth worked but package-health depth was unavailable on the current token or plan" : " where package endpoint access was available"}.`,
    "",
    "The useful signal is the shape of the gap. A vulnerability database, a registry search page and a repository score can all be excellent, but none of them alone gives an agent a complete preflight: search result, source evidence, warnings, install boundary and read-only execution policy in one flow.",
    "",
    "That is the benchmark Nipmod has to keep earning: better evidence before agents touch external code, honest boundaries and no hosted workspace writes."
  ].join("\n");
}

function publishableClaims(summaries: ProviderSummary[], observations: ProviderObservation[]): string[] {
  const nipmod = summaries.find((summary) => summary.provider === "nipmod");
  const socket = summaries.find((summary) => summary.provider === "socket");
  const snyk = summaries.find((summary) => summary.provider === "snyk");
  const installPlans = observations.filter((item) => item.provider === "nipmod" && item.dimensions.install_plan && item.dimensions.read_only).length;
  return [
    `Nipmod returned read-only install-plan evidence for ${installPlans}/${CASES.length} benchmark source cases.`,
    nipmod ? `Nipmod live track passed ${nipmod.pass}/${nipmod.applicable} applicable checks with median latency ${nipmod.medianLatencyMs ?? "n/a"} ms.` : "Nipmod live track did not run.",
    "OSV and deps.dev are useful evidence feeds, but they do not produce agent install plans by themselves.",
    socket && socket.warn > 0 ? "Socket comparison is authenticated but currently affected by token or plan rate limits; do not use this run for a direct Socket performance claim." : "Socket authenticated PURL lookup was available in this run.",
    snyk && snyk.warn > 0 ? "Snyk comparison is authenticated but package-health depth was unavailable on the current token or plan; do not use this run for a direct Snyk depth claim." : "Snyk package endpoint was available in this run."
  ];
}

async function socketOrgSlug(token: string, fetchFn: typeof fetch, timeoutMs?: number): Promise<string | null> {
  const payload = await fetchJson(
    "https://api.socket.dev/v0/organizations",
    { headers: { authorization: `Bearer ${token}`, "user-agent": USER_AGENT } },
    fetchFn,
    timeoutMs
  );
  const organizations = payload.organizations;
  if (Array.isArray(organizations)) {
    const org = organizations[0] as UnknownRecord | undefined;
    return typeof org?.slug === "string" ? org.slug : null;
  }
  if (organizations && typeof organizations === "object") {
    const org = Object.values(organizations as Record<string, unknown>)[0] as UnknownRecord | undefined;
    return typeof org?.slug === "string" ? org.slug : null;
  }
  return null;
}

async function snykOrgId(token: string, fetchFn: typeof fetch, timeoutMs?: number): Promise<string | null> {
  const self = await fetchJson(
    "https://api.snyk.io/rest/self?version=2024-06-10",
    { headers: { accept: "application/vnd.api+json", authorization: `token ${token}`, "content-type": "application/vnd.api+json", "user-agent": USER_AGENT } },
    fetchFn,
    timeoutMs
  );
  const attributes = ((self.data as UnknownRecord | undefined)?.attributes ?? {}) as UnknownRecord;
  if (typeof attributes.default_org_context === "string") {
    return attributes.default_org_context;
  }
  const orgs = await fetchJson(
    "https://api.snyk.io/rest/orgs?version=2024-06-10&limit=10",
    { headers: { accept: "application/vnd.api+json", authorization: `token ${token}`, "content-type": "application/vnd.api+json", "user-agent": USER_AGENT } },
    fetchFn,
    timeoutMs
  );
  const first = Array.isArray(orgs.data) ? orgs.data[0] as UnknownRecord | undefined : undefined;
  return typeof first?.id === "string" ? first.id : null;
}

async function fetchJson(url: string, init: RequestInit, fetchFn: typeof fetch, timeoutMs?: number): Promise<UnknownRecord> {
  const response = await fetchWithTimeout(url, init, fetchFn, timeoutMs);
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`invalid JSON from ${new URL(url).host}`);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${new URL(url).host}`);
  }
  return isRecord(payload) ? payload : { data: payload };
}

async function fetchWithTimeout(url: string, init: RequestInit, fetchFn: typeof fetch, timeoutMs = 15_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readCredentialEnv(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const path of CREDENTIAL_FILES) {
    try {
      const text = await readFile(path, "utf8");
      Object.assign(result, parseEnvFile(text));
    } catch {
      // Optional local credentials.
    }
  }
  return result;
}

function parseEnvFile(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index);
    let value = trimmed.slice(index + 1);
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith("\"") && value.endsWith("\""))) {
      value = value.slice(1, -1);
    }
    env[key] = value.replace(/\\ /g, " ");
  }
  return env;
}

function parseNdjson(text: string): UnknownRecord[] {
  return text
    .trim()
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as UnknownRecord);
}

function toNipmodSource(source: BenchmarkSource): string {
  return source;
}

function encodeHubRepoPath(value: string): string {
  return value.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function percentile(values: number[], percentileValue: number): number | null {
  if (!values.length) return null;
  const index = Math.min(values.length - 1, Math.max(0, Math.round((values.length - 1) * percentileValue)));
  return values[index];
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

type UnknownRecord = Record<string, unknown>;

async function main(): Promise<void> {
  const result = await runCompetitiveBenchmark({
    baseUrl: optionValue("--base-url") ?? process.env.NIPMOD_CANARY_BASE_URL ?? DEFAULT_BASE_URL,
    includeLive: !process.argv.includes("--no-live")
  });
  console.log(JSON.stringify(result, null, 2));
  const nipmod = result.summaries.find((summary) => summary.provider === "nipmod");
  if (!process.argv.includes("--no-live") && (!nipmod || nipmod.fail > 0)) {
    process.exitCode = 1;
  }
}

function optionValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

const isDirectRun = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (isDirectRun) {
  await main();
}
