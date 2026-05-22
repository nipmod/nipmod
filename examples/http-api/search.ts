const query = process.argv.slice(2).join(" ").trim() || "react";
const baseUrl = process.env.NIPMOD_API_BASE_URL ?? "https://nipmod.com";

const searchUrl = new URL("/api/search", baseUrl);
searchUrl.searchParams.set("q", query);
searchUrl.searchParams.set("limit", "3");

const search = await readJson(searchUrl);
const first = search.records?.[0];

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
      inspected: inspect.record?.id,
      query,
      recommendation: first.trust?.decision,
      source: first.source,
      installPlan: plan.plan
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
