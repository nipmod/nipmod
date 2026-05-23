const query = process.argv.slice(2).join(" ").trim() || "http client";
const baseUrl = process.env.NIPMOD_API_BASE_URL ?? "https://nipmod.com";

const searchUrl = new URL("/api/search", baseUrl);
searchUrl.searchParams.set("q", query);
searchUrl.searchParams.set("sources", "npm,pypi,github,huggingface-model,huggingface-dataset,mcp");
searchUrl.searchParams.set("limit", "3");

const search = await readJson(searchUrl);
const recommendedId = typeof search.selection?.recommendedId === "string" ? search.selection.recommendedId : null;
const first = recommendedId
  ? search.records?.find((record: Record<string, any>) => record.id === recommendedId) ?? search.records?.[0]
  : search.records?.[0];

if (!first) {
  console.log(JSON.stringify({ query, result: "no package records returned" }, null, 2));
  process.exit(0);
}

const inspectUrl = new URL("/api/inspect", baseUrl);
inspectUrl.searchParams.set("source", first.source);
inspectUrl.searchParams.set("name", first.name);

const planUrl = new URL("/api/install-plan", baseUrl);
planUrl.searchParams.set("source", first.source);
planUrl.searchParams.set("name", first.name);

const inspect = await readJson(inspectUrl);
const plan = await readJson(planUrl);

console.log(
  JSON.stringify(
    {
      candidates: search.records?.slice(0, 3)?.map((record: Record<string, any>) => ({
        decision: record.trust?.decision,
        id: record.id,
        name: record.name,
        score: record.trust?.score,
        source: record.source
      })),
      selection: {
        policy: search.selection?.policy,
        recommendedId,
        candidates: search.selection?.candidates?.slice(0, 3)
      },
      inspected: inspect.record?.id,
      query,
      recommendation: first.trust?.decision,
      source: first.source,
      installPlan: plan.plan,
      safety: plan.safety
    },
    null,
    2
  )
);

async function readJson(url: URL): Promise<any> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "nipmod-example/1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`${url.pathname} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json();
}
