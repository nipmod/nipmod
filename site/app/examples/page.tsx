import Link from "next/link";
import { createPageMetadata } from "../metadata";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell } from "../docs-shell";

export const metadata = createPageMetadata({
  description: "Example package records agents can search, inspect and turn into safe install plans through Nipmod.",
  path: "/examples",
  title: "Nipmod examples"
});

export default function ExamplesPage() {
  return (
    <DocsShell
      description="Small calls that show the public agent flow: search sources, inspect one package and request a safe install plan."
      eyebrow="Examples"
      title="API examples."
    >
      <DocsSection eyebrow="Flow" title="Search, inspect, plan">
        <DocsGrid>
          <DocsCard label="Search" title="Find candidates across sources">
            <DocsCode>{"curl 'https://nipmod.com/api/search?q=http%20client&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp&limit=3'"}</DocsCode>
          </DocsCard>
          <DocsCard label="Inspect" title="Inspect the selected package">
            <DocsCode>{"curl 'https://nipmod.com/api/inspect?source=npm&name=undici'"}</DocsCode>
          </DocsCard>
          <DocsCard label="Plan" title="Return a plan before writing">
            <DocsCode>{"curl 'https://nipmod.com/api/install-plan?source=npm&name=undici'"}</DocsCode>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Agent prompt" title="Use from an agent">
        <DocsCode>{"Find a package for HTTP requests. Use Nipmod first: search, inspect the selected record and show the install plan before changing the workspace."}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Output" title="What the agent should return">
        <DocsCode>{"Package: <source>:<name>\nSource: <original URL>\nLicense: <license or unknown>\nTrust: <score> / <decision> / <risk>\nWarnings: <warnings or none>\nInstall plan: <command as review data>\nBoundary: approval required before workspace write"}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Exact records" title="Canary examples">
        <DocsGrid>
          <DocsCard label="PyPI" title="requests">
            <DocsCode>{"curl 'https://nipmod.com/api/install-plan?source=pypi&name=requests'"}</DocsCode>
          </DocsCard>
          <DocsCard label="GitHub" title="vercel/next.js">
            <DocsCode>{"curl 'https://nipmod.com/api/install-plan?source=github&name=vercel/next.js'"}</DocsCode>
          </DocsCard>
          <DocsCard label="Hugging Face" title="bert-base-uncased">
            <DocsCode>{"curl 'https://nipmod.com/api/install-plan?source=huggingface-model&name=google-bert/bert-base-uncased'"}</DocsCode>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Files" title="Copyable workflow examples">
        <DocsGrid>
          <DocsCard label="TS" title="HTTP agent flow">
            <p><Link href="https://github.com/nipmod/nipmod/blob/main/examples/http-api/agent-flow.ts">Open example</Link></p>
          </DocsCard>
          <DocsCard label="Py" title="Python agent flow">
            <p><Link href="https://github.com/nipmod/nipmod/blob/main/examples/http-api/agent_flow.py">Open example</Link></p>
          </DocsCard>
          <DocsCard label="Codex" title="Codex agent prompt">
            <p><Link href="https://github.com/nipmod/nipmod/blob/main/examples/agent-workflow/codex.md">Open example</Link></p>
          </DocsCard>
          <DocsCard label="Claude Code" title="Claude Code prompt">
            <p><Link href="https://github.com/nipmod/nipmod/blob/main/examples/agent-workflow/claude-code.md">Open example</Link></p>
          </DocsCard>
          <DocsCard label="MCP" title="Hosted MCP example">
            <p><Link href="https://github.com/nipmod/nipmod/blob/main/examples/agent-workflow/mcp-host.md">Open example</Link></p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>
    </DocsShell>
  );
}
