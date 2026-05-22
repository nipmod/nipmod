const task = process.argv.slice(2).join(" ").trim() || "http client";
const baseUrl = process.env.NIPMOD_API_BASE_URL ?? "https://nipmod.com";

const search = await readJson(searchUrl(task));
const first = firstRecord(search);

if (!first) {
  console.log(JSON.stringify({ result: "no package records returned", task }, null, 2));
  process.exit(0);
}

const plan = await readJson(planUrl(first.source, first.name));

console.log(
  JSON.stringify(
    {
      task,
      selected: {
        id: first.id,
        name: first.name,
        source: first.source,
        trust: {
          decision: first.trust?.decision,
          factors: first.trust?.factors?.slice(0, 4),
          score: first.trust?.score,
          warnings: first.trust?.warnings
        }
      },
      installPlan: plan.plan,
      safety: plan.safety
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
  return Array.isArray(value.records) && value.records[0] && typeof value.records[0] === "object" ? value.records[0] : null;
}
