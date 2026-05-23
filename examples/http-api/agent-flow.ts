const task = process.argv.slice(2).join(" ").trim() || "http client";
const baseUrl = process.env.NIPMOD_API_BASE_URL ?? "https://nipmod.com";

const search = await readJson(searchUrl(task));
const first = firstRecord(search);

if (!first) {
  console.log(JSON.stringify({ result: "no package records returned", task }, null, 2));
  process.exit(0);
}

const inspect = await readJson(inspectUrl(first.source, first.name));
const inspectedRecord = inspect.record ?? first;
const plan = await readJson(planUrl(inspectedRecord.source, inspectedRecord.name));
const archive = await readJson(archivePrepareUrl(inspectedRecord.source, inspectedRecord.name));

console.log(
  JSON.stringify(
    {
      task,
      agentInstruction: "Search Nipmod, inspect the selected package and show the install plan before any workspace write.",
      sourceHealth: {
        partial: search.partial,
        summary: search.sourceSummary,
        degraded: Array.isArray(search.sourceReports)
          ? search.sourceReports
              .filter((report: Record<string, any>) => report.status === "failed")
              .map((report: Record<string, any>) => ({
                source: report.source,
                code: report.error?.code,
                retryable: report.recovery?.retryable,
                suggestedAction: report.recovery?.suggestedAction
              }))
          : []
      },
      selection: {
        policy: search.selection?.policy,
        recommendedId: search.selection?.recommendedId,
        candidates: search.selection?.candidates?.slice(0, 3)
      },
      selected: {
        id: inspectedRecord.id,
        name: inspectedRecord.name,
        originalUrl: inspectedRecord.originalUrl,
        source: inspectedRecord.source,
        trust: {
          decision: inspectedRecord.trust?.decision,
          dimensions: inspectedRecord.trust?.dimensions,
          factors: inspectedRecord.trust?.factors?.slice(0, 5),
          score: inspectedRecord.trust?.score,
          warnings: inspectedRecord.trust?.warnings
        }
      },
      installPlan: plan.plan,
      safety: plan.safety,
      approvalBoundary: {
        hostedApiExecutesCommands: false,
        hostedApiWritesCallerWorkspace: false,
        localHostMustApproveBeforeWrite: plan.plan?.requiresApprovalBeforeWrite === true
      },
      archivePreview: {
        status: archive.record?.status ?? archive.receipt?.archiveStatus,
        stored: archive.receipt?.stored ?? false,
        receiptType: archive.receipt?.type,
        writeBoundary: "prepare-only; durable confirm requires x-nipmod-archive-token"
      }
    },
    null,
    2
  )
);

function searchUrl(query: string): URL {
  const url = new URL("/api/search", baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("sources", "npm,pypi,github,huggingface-model,huggingface-dataset,mcp");
  url.searchParams.set("limit", "5");
  return url;
}

function planUrl(source: string, name: string): URL {
  const url = new URL("/api/install-plan", baseUrl);
  url.searchParams.set("source", source);
  url.searchParams.set("name", name);
  return url;
}

function inspectUrl(source: string, name: string): URL {
  const url = new URL("/api/inspect", baseUrl);
  url.searchParams.set("source", source);
  url.searchParams.set("name", name);
  return url;
}

function archivePrepareUrl(source: string, name: string): URL {
  const url = new URL("/api/archive/prepare", baseUrl);
  url.searchParams.set("source", source);
  url.searchParams.set("name", name);
  return url;
}

async function readJson(url: URL): Promise<Record<string, any>> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "nipmod-agent-flow-example/1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`${url.pathname} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function firstRecord(value: Record<string, any>): Record<string, any> | null {
  if (!Array.isArray(value.records)) {
    return null;
  }
  const recommendedId = typeof value.selection?.recommendedId === "string" ? value.selection.recommendedId : null;
  const recommended = recommendedId ? value.records.find((record) => record?.id === recommendedId) : null;
  return recommended && typeof recommended === "object" ? recommended : value.records[0] && typeof value.records[0] === "object" ? value.records[0] : null;
}
