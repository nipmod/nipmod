import { describe, expect, test } from "vitest";
import { runCompetitiveBenchmark } from "./competitive-benchmark.ts";

describe("competitive benchmark", () => {
  test("builds an agent package intelligence comparison report", async () => {
    const report = await runCompetitiveBenchmark({
      baseUrl: "https://nipmod.test",
      env: {
        SNYK_TOKEN: "snyk_fixture",
        SOCKET_API_KEY: "socket_fixture"
      },
      fetchFn: fixtureFetch,
      timeoutMs: 1000
    });

    expect(report.type).toBe("dev.nipmod.competitive-benchmark.v1");
    expect(report.summaries.map((summary) => summary.provider)).toEqual(expect.arrayContaining([
      "deps.dev",
      "native-registry",
      "nipmod",
      "osv",
      "snyk",
      "socket"
    ]));
    expect(report.summaries.map((summary) => summary.provider)).not.toContain("surplus");
    expect(JSON.stringify(report.methodology)).not.toMatch(/surplus|cost[-_ ]market/i);
    expect(report.headlineFindings.join("\n")).toContain("Nipmod returned install-plan/read-only evidence");
    expect(report.articleDraft).toContain("It does not rank every company on one generic security number.");

    const nipmod = report.summaries.find((summary) => summary.provider === "nipmod");
    const raw = report.summaries.find((summary) => summary.provider === "raw-agent");
    expect(nipmod?.fail).toBe(0);
    expect((nipmod?.score ?? 0)).toBeGreaterThan(raw?.score ?? 0);
  });

  test("does not leak configured credentials into the report", async () => {
    const report = await runCompetitiveBenchmark({
      baseUrl: "https://nipmod.test",
      env: {
        SNYK_TOKEN: "snyk_secret_should_not_print",
        SOCKET_API_KEY: "socket_secret_should_not_print"
      },
      fetchFn: fixtureFetch,
      timeoutMs: 1000
    });
    const text = JSON.stringify(report);

    expect(text).not.toContain("snyk_secret_should_not_print");
    expect(text).not.toContain("socket_secret_should_not_print");
    expect(text).not.toMatch(/private key|seed phrase|service_role/i);
  });
});

const fixtureFetch: typeof fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const parsed = new URL(url);

  if (url === "https://nipmod.test/api/keys/beta") return json({ key: "nka_test_key" });
  if (url.startsWith("https://nipmod.test/api/search")) {
    const source = parsed.searchParams.get("sources") ?? "npm";
    const name = parsed.searchParams.get("q")?.includes("schema") ? "zod" : "requests";
    return json({ total: 1, type: "dev.nipmod.external-search.v1", records: [{ id: `${source}:${name}` }] });
  }
  if (url.startsWith("https://nipmod.test/api/inspect")) {
    const source = parsed.searchParams.get("source") ?? "npm";
    const name = parsed.searchParams.get("name") ?? "package";
    return json({
      agentRecommendation: { workspaceWriteAllowed: false },
      artifactIntelligence: { mode: "metadata-only" },
      description: "fixture package",
      id: `${source}:${name}`,
      license: "MIT",
      name,
      originalUrl: `https://example.test/${source}/${name}`,
      source,
      sourceEvidence: { depthScore: 95 },
      trust: { score: 91, signals: ["fixture"], warnings: [] },
      version: "1.0.0"
    });
  }
  if (url.startsWith("https://nipmod.test/api/install-plan")) {
    return json({
      plan: { writes: [] },
      safety: { blocked: false },
      type: "dev.nipmod.external-install-plan.v1"
    });
  }

  if (url.startsWith("https://registry.npmjs.org/-/v1/search")) return json({ objects: [{ package: { name: "zod" } }] });
  if (url.startsWith("https://registry.npmjs.org/")) {
    const name = decodeURIComponent(parsed.pathname.slice(1));
    return json({ "dist-tags": { latest: "1.0.0" }, description: "fixture", license: "MIT", name, versions: { "1.0.0": {} } });
  }
  if (url.startsWith("https://pypi.org/pypi/")) {
    const name = decodeURIComponent(parsed.pathname.split("/")[2] ?? "package");
    return json({ info: { license: "MIT", name, summary: "fixture", version: "1.0.0" }, releases: { "1.0.0": [{}] }, vulnerabilities: [] });
  }
  if (url.startsWith("https://api.github.com/repos/")) {
    return json({ default_branch: "canary", description: "fixture", full_name: "vercel/next.js", license: { spdx_id: "MIT" }, open_issues_count: 1, pushed_at: "2026-01-01T00:00:00Z", stargazers_count: 100 });
  }
  if (url.startsWith("https://huggingface.co/api/models/")) {
    return json({ cardData: { license: "apache-2.0" }, downloads: 100, id: "sentence-transformers/all-MiniLM-L6-v2", lastModified: "2026-01-01T00:00:00Z", siblings: [{ rfilename: "model.safetensors" }], tags: [] });
  }
  if (url.startsWith("https://registry.modelcontextprotocol.io/")) return json({ servers: [{ server: { name: "ac.tandem/docs-mcp" } }] });

  if (url === "https://api.osv.dev/v1/query") return json({ vulns: [] });
  if (url.startsWith("https://api.deps.dev/v3/query")) return json({ results: [{ version: { advisoryKeys: [], licenses: ["MIT"], links: [{ label: "SOURCE", url: "https://example.test" }], versionKey: { name: "zod" } } }] });
  if (url === "https://api.socket.dev/v0/organizations") return json({ organizations: { "1": { slug: "nipmod" } } });
  if (url.startsWith("https://api.socket.dev/v0/orgs/nipmod/purl")) {
    return new Response('{"name":"zod","version":"1.0.0","alerts":[{"type":"supply-chain"}]}\n{"_type":"summary","value":{"resolved":1}}\n', { status: 200 });
  }
  if (url.startsWith("https://api.snyk.io/rest/self")) return json({ data: { attributes: { default_org_context: "org_1" }, type: "user" } });
  if (url.startsWith("https://api.snyk.io/rest/orgs?")) return json({ data: [{ id: "org_1" }] });
  if (parsed.host === "api.snyk.io" && parsed.pathname.startsWith("/rest/orgs/org_1/ecosystems/")) return json({ data: { attributes: { package_health: { score: 90 } }, id: "pkg", type: "package" } });
  if (url.startsWith("https://api.scorecard.dev/")) return json({ checks: [{ name: "Maintained", score: 10 }], repo: { name: "github.com/vercel/next.js" }, score: 8 });
  return json({ error: `fixture not found: ${url}` }, 404);
}) as typeof fetch;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}
