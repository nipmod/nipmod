import Link from "next/link";
import { createPageMetadata } from "../metadata";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";

export const metadata = createPageMetadata({
  description: "Example package records agents can search, inspect and turn into safe install plans through Nipmod.",
  path: "/examples",
  title: "Nipmod examples"
});

const coreFlow = `curl 'https://nipmod.com/api/search?q=http%20client&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp&limit=3'
curl 'https://nipmod.com/api/inspect?source=npm&name=undici'
curl 'https://nipmod.com/api/install-plan?source=npm&name=undici'`;

const codexPrompt = `Use Nipmod before adding a dependency.
Find a package for HTTP requests, inspect the selected record, show the trust result and install plan, then wait for my approval before editing files.`;

const claudePrompt = `Before choosing a dependency, call the Nipmod API.
Search for package candidates, inspect the best match and present the install plan. Do not run install commands until I approve.`;

const cursorPrompt = `Use https://nipmod.com/api/search first.
Then inspect the selected package and show the install plan before changing package files or lockfiles.`;

const mcpPrompt = `Use the hosted Nipmod MCP endpoint for package discovery:
POST https://nipmod.com/api/mcp
Only use read-only tools from the hosted endpoint. Workspace writes require local approval.`;

const genericAgentPrompt = `When a user asks for a package, do this:
1. Search Nipmod.
2. Inspect the selected package.
3. Request the install plan.
4. Show source, license, trust score, warnings and command.
5. Wait for approval before writing to the workspace.`;

const expectedOutput = `Package: npm:undici
Source: https://www.npmjs.com/package/undici
License: MIT
Trust: 100 / recommended / low
Warnings: none
Install plan: npm install undici
Boundary: manual approval required before workspace write`;

const sourceExamples = `curl 'https://nipmod.com/api/install-plan?source=npm&name=undici'
curl 'https://nipmod.com/api/install-plan?source=pypi&name=requests'
curl 'https://nipmod.com/api/install-plan?source=github&name=vercel/next.js'
curl 'https://nipmod.com/api/install-plan?source=huggingface-model&name=google-bert/bert-base-uncased'
curl 'https://nipmod.com/api/install-plan?source=mcp&name=ac.tandem/docs-mcp'`;

export default function ExamplesPage() {
  return (
    <DocsShell
      description="Copyable examples for the public agent flow: search sources, inspect one record and request a safe install plan before any workspace write."
      eyebrow="Examples"
      stats={[
        { label: "Flow", value: "Search, Inspect, Plan" },
        { label: "Execution", value: "user approved" },
        { label: "Hosted API", value: "read only" }
      ]}
      title="Agent workflow examples."
    >
      <DocsSection title="Complete API flow">
        <DocsCode>{coreFlow}</DocsCode>
      </DocsSection>

      <DocsSection title="Prompts for agent hosts">
        <DocsGrid>
          <DocsCard label="Codex" title="Coding workspace">
            <DocsCode>{codexPrompt}</DocsCode>
          </DocsCard>
          <DocsCard label="Claude Code" title="Coding assistant">
            <DocsCode>{claudePrompt}</DocsCode>
          </DocsCard>
          <DocsCard label="Cursor" title="Editor agent">
            <DocsCode>{cursorPrompt}</DocsCode>
          </DocsCard>
          <DocsCard label="MCP" title="Hosted read-only endpoint">
            <DocsCode>{mcpPrompt}</DocsCode>
          </DocsCard>
          <DocsCard label="HTTPS" title="Any agent with fetch">
            <DocsCode>{genericAgentPrompt}</DocsCode>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Expected agent answer">
        <DocsCode>{expectedOutput}</DocsCode>
      </DocsSection>

      <DocsSection title="Source canaries">
        <p className="docs-note">These are simple public checks across the sources Nipmod resolves today. They are examples, not package endorsements.</p>
        <DocsCode>{sourceExamples}</DocsCode>
      </DocsSection>

      <DocsSection title="What to test">
        <DocsTable
          rows={[
            {
              first: "Search",
              second: "Does the agent compare candidates instead of guessing one package?",
              third: "Good agents explain why the selected package won."
            },
            {
              first: "Inspect",
              second: "Does the agent show source, license, version, warnings and trust fields?",
              third: "The answer should cite the exact record."
            },
            {
              first: "Install Plan",
              second: "Does the agent show the command as review data?",
              third: "It should not run the command without approval."
            },
            {
              first: "Boundary",
              second: "Does the agent understand hosted Nipmod cannot write to the workspace?",
              third: "Workspace writes happen only in the local host after approval."
            }
          ]}
        />
      </DocsSection>

      <DocsSection title="Reference files">
        <DocsGrid>
          <DocsCard label="TS" title="HTTP agent flow">
            <p><Link href="https://github.com/nipmod/nipmod/blob/main/examples/http-api/agent-flow.ts">Open TypeScript example</Link></p>
          </DocsCard>
          <DocsCard label="Py" title="Python agent flow">
            <p><Link href="https://github.com/nipmod/nipmod/blob/main/examples/http-api/agent_flow.py">Open Python example</Link></p>
          </DocsCard>
          <DocsCard label="Codex" title="Prompt file">
            <p><Link href="https://github.com/nipmod/nipmod/blob/main/examples/agent-workflow/codex.md">Open Codex prompt</Link></p>
          </DocsCard>
          <DocsCard label="Claude Code" title="Prompt file">
            <p><Link href="https://github.com/nipmod/nipmod/blob/main/examples/agent-workflow/claude-code.md">Open Claude Code prompt</Link></p>
          </DocsCard>
          <DocsCard label="MCP" title="Host prompt">
            <p><Link href="https://github.com/nipmod/nipmod/blob/main/examples/agent-workflow/mcp-host.md">Open MCP example</Link></p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>
    </DocsShell>
  );
}
