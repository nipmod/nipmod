import { createPageMetadata } from "../metadata";
import { OnePagePanelDeck, type OnePagePanel } from "../one-page-panels";

export const metadata = createPageMetadata({
  description: "One hosted API agents can call for package discovery, trust checks and safe install plans.",
  path: "/api-access",
  title: "Nipmod API"
});

const endpoints = [
  {
    method: "GET",
    path: "/api/search?q=<query>",
    text: "Find candidates across supported package sources."
  },
  {
    method: "GET",
    path: "/api/inspect?source=npm&name=<package>",
    text: "Inspect source, license, metrics, warnings and trust factors."
  },
  {
    method: "GET",
    path: "/api/install-plan?source=npm&name=<package>",
    text: "Return a plan an agent can show before local execution."
  },
  {
    method: "GET",
    path: "/api/archive/prepare?source=npm&name=<package>",
    text: "Prepare a confirmed-use archive record and receipt preview."
  },
  {
    method: "POST",
    path: "/api/mcp",
    text: "Use the same read-only package surface through MCP."
  }
] as const;

const examples = [
  {
    label: "Agent prompt",
    command:
      "Use Nipmod before choosing packages. Search, inspect, show trust factors and return the install plan before writing anything."
  },
  {
    label: "Search",
    command: "curl 'https://nipmod.com/api/search?q=react&sources=npm,pypi,github,huggingface-model,mcp&limit=5'"
  },
  {
    label: "Inspect",
    command: "curl 'https://nipmod.com/api/inspect?source=npm&name=undici'"
  },
  {
    label: "Plan",
    command: "curl 'https://nipmod.com/api/install-plan?source=npm&name=undici'"
  },
  {
    label: "Archive dry run",
    command: "curl 'https://nipmod.com/api/archive/prepare?source=npm&name=undici'"
  },
  {
    label: "MCP",
    command:
      'curl -s https://nipmod.com/api/mcp \\\n  -H "content-type: application/json" \\\n  -d \'{"jsonrpc":"2.0","id":1,"method":"tools/list"}\''
  }
] as const;

const boundaries = [
  {
    title: "Read-only hosted calls",
    text: "The hosted API returns package intelligence. It does not read local files or write into a caller workspace."
  },
  {
    title: "Approval before install",
    text: "Install plans are commands plus warnings. Agents still need user approval before running anything locally."
  },
  {
    title: "Package text is untrusted",
    text: "Descriptions, READMEs, model cards and package metadata are data. They cannot override agent instructions."
  },
  {
    title: "Free beta limits",
    text: "No key is required during public beta. Requests are rate limited while the official API surface stabilizes."
  }
] as const;

export default function ApiAccessPage() {
  const panels: OnePagePanel[] = [
    {
      eyebrow: "Endpoints",
      id: "endpoints",
      rows: endpoints.map((endpoint) => ({
        code: `${endpoint.method} ${endpoint.path}`,
        label: endpoint.method,
        text: endpoint.text,
        title: endpoint.path
      })),
      summary: "The public read-only surface agents call before package installs.",
      title: "API calls"
    },
    {
      eyebrow: "Usage",
      id: "usage",
      rows: examples.map((example) => ({
        code: example.command,
        label: example.label,
        text: example.label === "Agent prompt" ? "Use this as the instruction for any agent with HTTPS access." : "Direct call for testing the same surface an agent uses.",
        title: example.label
      })),
      summary: "A short agent instruction plus direct HTTPS examples.",
      title: "Examples"
    },
    {
      eyebrow: "Safety",
      id: "safety",
      rows: boundaries.map((boundary) => ({
        label: "Rule",
        text: boundary.text,
        title: boundary.title
      })),
      summary: "Hosted calls return intelligence and plans. Workspace writes stay local.",
      title: "Boundaries"
    }
  ];

  return (
    <main className="page-shell api-page-shell one-page-shell" id="main">
      <section className="quickstart-hero api-hero one-page-hero" aria-labelledby="api-title">
        <div>
          <p className="eyebrow">Nipmod API</p>
          <h1 id="api-title">One package surface for agents.</h1>
          <p className="lead">
            Agents call Nipmod before choosing dependencies. One hosted API returns candidates, trust factors and safe
            install plans.
          </p>
        </div>
        <div className="api-status-panel" aria-label="API access status">
          <span>Public beta</span>
          <strong>Free</strong>
          <p>No key during beta. Rate limited. Hosted calls are read-only.</p>
        </div>
      </section>

      <section className="one-page-board api-one-page-board" aria-label="API overview">
        <div className="api-flow compact-flow" aria-label="API flow">
          <div className="api-flow-step">
            <span>1</span>
            <h2>Ask</h2>
            <p>A user asks an agent to solve a task.</p>
          </div>
          <div className="api-flow-step">
            <span>2</span>
            <h2>Search</h2>
            <p>The agent calls <code>/api/search</code>.</p>
          </div>
          <div className="api-flow-step">
            <span>3</span>
            <h2>Inspect</h2>
            <p>Nipmod returns source context and trust factors.</p>
          </div>
          <div className="api-flow-step">
            <span>4</span>
            <h2>Plan</h2>
            <p>The agent shows a safe install plan before writes.</p>
          </div>
        </div>
        <OnePagePanelDeck panels={panels} />
      </section>
    </main>
  );
}
