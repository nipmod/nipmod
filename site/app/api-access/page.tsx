import { createPageMetadata } from "../metadata";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";

export const metadata = createPageMetadata({
  description: "Nipmod API endpoints for agent package search, inspection, install planning and MCP access.",
  path: "/api-access",
  title: "Nipmod API"
});

const agentPrompt = `Use Nipmod before choosing a package.
Search for candidates, inspect the selected record, then show me the install plan before changing the workspace.`;

const agentDiscovery = `Read these first:
https://nipmod.com/llms.txt
https://nipmod.com/.well-known/nipmod.json
https://nipmod.com/api/openapi`;

const threeCalls = `curl 'https://nipmod.com/api/search?q=http%20client&limit=3'
curl 'https://nipmod.com/api/inspect?source=npm&name=undici'
curl 'https://nipmod.com/api/install-plan?source=npm&name=undici'`;

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
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

const clientExamples = `node --experimental-strip-types examples/http-api/agent-flow.ts "http client"
python3 examples/http-api/agent_flow.py "http client"
curl 'https://nipmod.com/api/openapi'`;

export default function ApiAccessPage() {
  return (
    <DocsShell
      description="Agents call Nipmod before choosing dependencies, models or MCP tools. The API returns source context, trust signals and install plans. It does not install anything by itself."
      eyebrow="API"
      stats={[
        { label: "OpenAPI", value: "3.1" },
        { label: "Public beta", value: "free, rate limited" },
        { label: "Hosted writes", value: "0" }
      ]}
      title="One package API for agents."
    >
      <DocsSection title="Use it in one prompt">
        <DocsCode>{agentPrompt}</DocsCode>
      </DocsSection>

      <DocsSection title="Agent-readable entrypoints">
        <DocsGrid>
          <DocsCard title="Human page">
            <p>This page explains the beta surface, access rules and safety boundary.</p>
          </DocsCard>
          <DocsCard title="Machine text">
            <p><code>/llms.txt</code> gives agents the exact workflow and safety rules without layout or marketing copy.</p>
          </DocsCard>
          <DocsCard title="OpenAPI">
            <p><code>/api/openapi</code> is the contract for generated clients, tests and agent tools.</p>
          </DocsCard>
        </DocsGrid>
        <DocsCode>{agentDiscovery}</DocsCode>
      </DocsSection>

      <DocsSection title="Three calls">
        <DocsGrid>
          <DocsCard label="1" title="Search">
            <p>Find candidates across supported public sources. Search returns a shortlist, not install permission.</p>
          </DocsCard>
          <DocsCard label="2" title="Inspect">
            <p>Read one exact package record with source links, version, license, warnings and trust factors.</p>
          </DocsCard>
          <DocsCard label="3" title="Install Plan">
            <p>Return commands and risk context for user review. Hosted API calls never execute commands.</p>
          </DocsCard>
        </DocsGrid>
        <DocsCode>{threeCalls}</DocsCode>
      </DocsSection>

      <DocsSection title="Endpoints">
        <DocsTable
          rows={[
            {
              first: "Search",
              second: <code>GET /api/search?q=&lt;query&gt;&amp;sources=&lt;sources&gt;&amp;limit=5</code>,
              third: "Ranked candidates from npm, PyPI, GitHub, Hugging Face and MCP."
            },
            {
              first: "Inspect",
              second: <code>GET /api/inspect?source=npm&amp;name=undici</code>,
              third: "One exact record with source, trust, license, metrics and warnings."
            },
            {
              first: "Install Plan",
              second: <code>GET /api/install-plan?source=npm&amp;name=undici</code>,
              third: "Commands for review. The hosted API does not write to the workspace."
            },
            {
              first: "Archive Prepare",
              second: <code>GET /api/archive/prepare?source=npm&amp;name=undici</code>,
              third: "Preview a reusable archive record after useful discovery."
            },
            {
              first: "Source Health",
              second: <code>GET /api/sources/health</code>,
              third: "Configured source capabilities and bounded source checks."
            },
            {
              first: "MCP",
              second: <code>POST /api/mcp</code>,
              third: "Read-only MCP JSON-RPC surface over the same hosted API."
            },
            {
              first: "OpenAPI",
              second: <code>GET /api/openapi</code>,
              third: "Contract for generated clients, tests and agent tool schemas."
            }
          ]}
        />
      </DocsSection>

      <DocsSection title="Access and API keys">
        <DocsTable
          rows={[
            {
              first: "Public beta",
              second: "No API key is required today.",
              third: "Every public request is rate limited."
            },
            {
              first: "Optional keys",
              second: <code>x-nipmod-api-key</code>,
              third: "The API also accepts bearer keys for manually issued higher-limit access."
            },
            {
              first: "Key storage",
              second: "Raw keys are not stored.",
              third: "Issued keys are verified against server-side hashes and exposed only as a key id in usage logs."
            },
            {
              first: "Self-service keys",
              second: "Not part of the public beta yet.",
              third: "The current launch path is free public access first, then individual keys when higher limits are needed."
            }
          ]}
        />
      </DocsSection>

      <DocsSection title="Usage and statistics">
        <DocsTable
          rows={[
            {
              first: "Without a key",
              second: "Nipmod counts requests by a privacy-safe client hash.",
              third: "Useful for public beta traffic and source usage."
            },
            {
              first: "With a key",
              second: "Usage is grouped by API key id and access tier.",
              third: "Useful for counting builders, projects and agent hosts."
            },
            {
              first: "Stored fields",
              second: "Route, status, source, result count, duration, hashed query and hashed package.",
              third: "Enough for product metrics without exposing user prompts."
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
        <DocsGrid>
          <DocsCard title="Structured response">
            <p>Errors should be handled as data. Agents should not retry blindly or hide the cause from the user.</p>
          </DocsCard>
          <DocsCard title="Common cases">
            <p>Invalid source, missing package name, upstream timeout, source unavailable, rate limit and malformed MCP request.</p>
          </DocsCard>
        </DocsGrid>
        <DocsCode>{errorShape}</DocsCode>
      </DocsSection>

      <DocsSection title="Rate limits and versions">
        <DocsTable
          rows={[
            {
              first: "Public beta",
              second: "No key is required. Requests are rate limited to keep the shared API reliable.",
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
        <DocsGrid>
          <DocsCard label="TS" title="TypeScript">
            <p>Reference flow for agent hosts that call Nipmod through HTTPS.</p>
          </DocsCard>
          <DocsCard label="PY" title="Python">
            <p>Same flow for Python-based workers, bots or local agent wrappers.</p>
          </DocsCard>
          <DocsCard label="MCP" title="MCP endpoint">
            <p>Read-only JSON-RPC surface for hosts that prefer MCP-style tools.</p>
          </DocsCard>
        </DocsGrid>
        <DocsCode>{clientExamples}</DocsCode>
        <DocsCode>{mcpCall}</DocsCode>
      </DocsSection>
    </DocsShell>
  );
}
