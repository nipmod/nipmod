import { createPageMetadata } from "../metadata";
import { DocsCard, DocsCode, DocsGrid, DocsProse, DocsSection, DocsSequence, DocsShell, DocsTable } from "../docs-shell";

export const metadata = createPageMetadata({
  description: "Nipmod API endpoints for agent package search, inspection, install planning and MCP access.",
  path: "/api-access",
  title: "Nipmod API"
});

const agentPrompt = `Use Nipmod before choosing a package.
If no key is available, issue one with POST /api/keys/beta.
Search for candidates with x-nipmod-api-key, inspect the selected record, show me the install plan and run a local deep scan if files are already present before changing the workspace.`;

const agentDiscovery = `Read these first:
https://nipmod.com/llms.txt
https://nipmod.com/.well-known/nipmod.json
POST https://nipmod.com/api/keys/beta
GET https://nipmod.com/api/openapi with x-nipmod-api-key`;

const threeCalls = `curl 'https://nipmod.com/api/search?q=http%20client&limit=3' \\
  -H 'x-nipmod-api-key: <key>'

curl 'https://nipmod.com/api/inspect?source=npm&name=undici' \\
  -H 'x-nipmod-api-key: <key>'

curl 'https://nipmod.com/api/install-plan?source=npm&name=undici' \\
  -H 'x-nipmod-api-key: <key>'`;

const localDeepScan = `nipmod deep-scan . --json`;

const keyedCalls = `curl 'https://nipmod.com/api/search?q=http%20client&limit=3' \\
  -H 'x-nipmod-api-key: <key>'

curl 'https://nipmod.com/api/usage/stats?hours=24' \\
  -H 'authorization: Bearer <admin-key>'`;

const betaKeyCall = `curl -s -X POST 'https://nipmod.com/api/keys/beta' \\
  -H 'content-type: application/json' \\
  -d '{"label":"agent-quickstart"}'

curl 'https://nipmod.com/api/search?q=http%20client&limit=3' \\
  -H 'x-nipmod-api-key: <returned-key>'`;

const betaKeyAgentPrompt = `Read https://nipmod.com/api/openapi.
If you do not have a Nipmod key yet, POST https://nipmod.com/api/keys/beta first.
Store the returned key in local secrets and use it as x-nipmod-api-key.
Do not send prompts, user data, API keys or workspace paths.`;

const searchShape = `{
  "id": "npm:undici",
  "source": "npm",
  "name": "undici",
  "version": "8.3.0",
  "trust": {
    "score": 100,
    "decision": "recommended",
    "risk": "low"
  },
  "archive": {
    "persistence": "ephemeral"
  }
}`;

const installPlanShape = `{
  "commands": ["npm install undici"],
  "requiresApprovalBeforeWrite": true,
  "hostedApiExecutes": false,
  "metadataIsInstruction": false,
  "boundary": "manual-after-user-approval",
  "risk": "low"
}`;

const errorShape = `{
  "error": {
    "code": "invalid_source",
    "message": "Unsupported source.",
    "requestId": "req_...",
    "retryable": false
  }
}`;

const mcpCall = `curl -s https://nipmod.com/api/mcp \\
  -H 'content-type: application/json' \\
  -H 'x-nipmod-api-key: <key>' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

const clientExamples = `node --experimental-strip-types examples/http-api/agent-flow.ts --issue-key "http client"
python3 examples/http-api/agent_flow.py --issue-key "http client"
curl 'https://nipmod.com/api/openapi' -H 'x-nipmod-api-key: <key>'`;

export default function ApiAccessPage() {
  return (
    <DocsShell
      description="Agents call Nipmod before choosing dependencies, models or MCP tools. The API returns source context, trust signals and install plans. It does not install anything by itself."
      eyebrow="API"
      stats={[
        { label: "OpenAPI", value: "3.1" },
        { label: "API beta", value: "free key" },
        { label: "Hosted writes", value: "0" }
      ]}
      title="One package API for agents."
    >
      <DocsSection title="Use it in one prompt">
        <DocsCode>{agentPrompt}</DocsCode>
      </DocsSection>

      <DocsSection title="Agent-readable entrypoints">
        <DocsProse>
          <p>
            The human page explains the beta surface, access rules and safety boundary. Agents should read the machine
            surfaces first, then call the API only after they understand the flow.
          </p>
          <p>
            <code>/llms.txt</code> gives agents the workflow and safety rules without layout copy. The discovery manifest
            describes the API surfaces. <code>/api/openapi</code> is the contract for generated clients, tests and agent
            tools, and it requires the same API key as package intelligence calls.
          </p>
        </DocsProse>
        <DocsCode>{agentDiscovery}</DocsCode>
      </DocsSection>

      <DocsSection title="Three calls">
        <DocsSequence
          items={[
            {
              body: "Find candidates across supported public sources. Search returns a shortlist, not install permission.",
              label: "1",
              title: "Search"
            },
            {
              body: "Read one exact package record with source links, version, license, warnings and trust factors.",
              label: "2",
              title: "Inspect"
            },
            {
              body: "Return commands and risk context for user review. Hosted API calls never execute commands.",
              label: "3",
              title: "Install Plan"
            }
          ]}
        />
        <DocsCode>{threeCalls}</DocsCode>
      </DocsSection>

      <DocsSection title="Optional local deep scan">
        <DocsProse>
          <p>
            The hosted API does not read workspaces, clone repositories, extract artifacts or run package code. When package
            files or package artifacts are already present locally, an agent can run the CLI deep scan as the second stage before approval.
          </p>
        </DocsProse>
        <DocsCode>{localDeepScan}</DocsCode>
      </DocsSection>

      <DocsSection title="Endpoints">
        <DocsTable
          rows={[
            {
              first: "Search",
              second: <code>GET /api/search?q=&lt;query&gt;&amp;sources=&lt;sources&gt;&amp;limit=5</code>,
              third: "Key-required ranked candidates from npm, PyPI, GitHub, Hugging Face and MCP."
            },
            {
              first: "Inspect",
              second: <code>GET /api/inspect?source=npm&amp;name=undici</code>,
              third: "Key-required exact record with source, trust, license, metrics and warnings."
            },
            {
              first: "Install Plan",
              second: <code>GET /api/install-plan?source=npm&amp;name=undici</code>,
              third: "Key-required commands for review. The hosted API does not write to the workspace."
            },
            {
              first: "Archive Prepare",
              second: <code>GET /api/archive/prepare?source=npm&amp;name=undici</code>,
              third: "Key-required preview of a reusable archive record after useful discovery."
            },
            {
              first: "Source Health",
              second: <code>GET /api/sources/health</code>,
              third: "Key-required configured source capabilities and bounded source checks."
            },
            {
              first: "Usage Stats",
              second: <code>GET /api/usage/stats?hours=24</code>,
              third: "Admin-only aggregate route, source, traffic-origin, trust, install-plan and archive metrics."
            },
            {
              first: "Beta Key",
              second: <code>POST /api/keys/beta</code>,
              third: "Self-service beta API key. The raw key is returned once and stored only as a keyed hash."
            },
            {
              first: "MCP",
              second: <code>POST /api/mcp</code>,
              third: "Key-required read-only MCP JSON-RPC surface over the same hosted API."
            },
            {
              first: "OpenAPI",
              second: <code>GET /api/openapi</code>,
              third: "Key-required contract for generated clients, tests and agent tool schemas."
            }
          ]}
        />
      </DocsSection>

      <DocsSection title="Access and API keys">
        <DocsTable
          rows={[
            {
              first: "API beta",
              second: "API key required.",
              third: "Self-service beta keys are free and rate limited."
            },
            {
              first: "Free beta keys",
              second: <code>POST /api/keys/beta</code>,
              third: "Issued directly by the API. They do not expose private sources."
            },
            {
              first: "Partner keys",
              second: <code>Authorization: Bearer &lt;key&gt;</code>,
              third: "Higher limits for integrations and agent hosts. Usage is grouped by key id."
            },
            {
              first: "Admin keys",
              second: <code>GET /api/usage/stats</code>,
              third: "Operational metrics only: routes, sources, traffic origins, trust decisions, install plans and archive writes."
            },
            {
              first: "Key storage",
              second: "Raw keys are not stored.",
              third: "Issued keys are verified against server-side hashes and exposed only as a key id in usage events."
            },
            {
              first: "Private data",
              second: "Do not send secrets in labels.",
              third: "The self-service endpoint stores a non-private label, tier, key id, hash and expiry only."
            }
          ]}
        />
        <DocsCode>{keyedCalls}</DocsCode>
      </DocsSection>

      <DocsSection title="Self-service beta keys">
        <DocsProse>
          <p>
            Agents can issue a beta key without a human handoff. The endpoint is public and rate limited. It returns the
            raw key once, then Nipmod keeps only a keyed hash for verification.
          </p>
        </DocsProse>
        <DocsCode>{betaKeyCall}</DocsCode>
        <DocsCode>{betaKeyAgentPrompt}</DocsCode>
      </DocsSection>

      <DocsSection title="Usage and statistics">
        <DocsTable
          rows={[
            {
              first: "Missing key",
              second: "Package intelligence calls return 401.",
              third: "Use POST /api/keys/beta before calling search, inspect, install-plan, MCP, stats or health."
            },
            {
              first: "With a key",
              second: "Usage is grouped by API key id and access tier.",
              third: "Useful for counting beta callers, projects and agent hosts."
            },
            {
              first: "Stored fields",
              second: "Route, status, source, traffic origin, result count, duration, trust decision, install-plan boundary and archive outcome.",
              third: "Queries and package names are hashed before storage."
            },
            {
              first: "Metrics endpoint",
              second: "Admin key required.",
              third: "Returns aggregate counts for routes, sources, access tiers, traffic origins, install plans, archive writes and trust outcomes."
            },
            {
              first: "Not stored",
              second: "No raw API keys, raw IPs, raw queries, package names or user-agent fingerprints.",
              third: "The analytics layer is intentionally privacy limited."
            }
          ]}
        />
      </DocsSection>

      <DocsSection title="Response shape">
        <DocsGrid>
          <DocsCard label="Search" title="Candidate record">
            <DocsCode>{searchShape}</DocsCode>
          </DocsCard>
          <DocsCard label="Install Plan" title="Approval boundary">
            <DocsCode>{installPlanShape}</DocsCode>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Trust fields agents should read">
        <DocsTable
          rows={[
            {
              first: "score",
              second: "A numeric review signal from source metadata, security evidence, warnings and plan risk.",
              third: "Not install permission."
            },
            {
              first: "decision",
              second: <code>recommended</code>,
              third: "May still require user approval before any workspace write."
            },
            {
              first: "risk",
              second: <code>low</code>,
              third: "Risk level for the selected record and install-plan context."
            },
            {
              first: "warnings",
              second: "Human-readable warnings for lifecycle scripts, weak metadata, remote-code risk or degraded source data.",
              third: "Agents should show these before recommending the package."
            },
            {
              first: "archive.persistence",
              second: <code>ephemeral</code>,
              third: "Search alone does not create a verified Nipmod package."
            }
          ]}
        />
      </DocsSection>

      <DocsSection title="Errors">
        <DocsProse>
          <p>
            Errors are structured data. Agents should not retry blindly or hide the cause from the user. Common cases include
            invalid source, missing package name, upstream timeout, source unavailable, rate limit and malformed MCP request.
          </p>
        </DocsProse>
        <DocsCode>{errorShape}</DocsCode>
      </DocsSection>

      <DocsSection title="Rate limits and versions">
        <DocsTable
          rows={[
            {
              first: "API beta",
              second: "A key is required. Requests are rate limited to keep the shared API reliable.",
              third: "Higher limits can be added later without changing the core API flow."
            },
            {
              first: "API version",
              second: "The public OpenAPI contract is the stable builder reference during beta.",
              third: <code>GET /api/openapi</code>
            },
            {
              first: "Breaking changes",
              second: "Search, Inspect and Install Plan should remain the core flow. New fields should be additive where possible.",
              third: "Agents should ignore fields they do not understand."
            },
            {
              first: "Hosted boundary",
              second: "Hosted calls can search, inspect and plan. They cannot execute commands or read local files.",
              third: "Workspace writes belong to the user's local host after approval."
            }
          ]}
        />
      </DocsSection>

      <DocsSection title="Client examples">
        <DocsProse>
          <p>
            Use the TypeScript and Python examples for agent hosts that call Nipmod through HTTPS. Use the MCP endpoint when
            the host prefers JSON-RPC tools over direct HTTP calls. Both paths keep the same safety boundary.
          </p>
        </DocsProse>
        <DocsCode>{clientExamples}</DocsCode>
        <DocsCode>{mcpCall}</DocsCode>
      </DocsSection>
    </DocsShell>
  );
}
