import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";

export const metadata = createPageMetadata({
  description: "Run the Nipmod flow for package search, trust inspection and safe install planning.",
  path: "/demo",
  title: "Nipmod demo"
});

export default function DemoPage() {
  return (
    <DocsShell
      description="A minimal demo of the agent path: search, inspect, request an install plan and stop before workspace writes."
      eyebrow="Demo"
      title="Search, inspect, plan."
    >
      <DocsSection eyebrow="Terminal" title="Run the read only path">
        <DocsGrid>
          <DocsCard label="1" title="Search">
            <DocsCode>{"curl 'https://nipmod.com/api/search?q=http%20client&limit=3' -H 'x-nipmod-api-key: <key>'"}</DocsCode>
          </DocsCard>
          <DocsCard label="2" title="Inspect">
            <DocsCode>{"curl 'https://nipmod.com/api/inspect?source=npm&name=undici' -H 'x-nipmod-api-key: <key>'"}</DocsCode>
          </DocsCard>
          <DocsCard label="3" title="Plan">
            <DocsCode>{"curl 'https://nipmod.com/api/install-plan?source=npm&name=undici' -H 'x-nipmod-api-key: <key>'"}</DocsCode>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Boundary" title="What the demo proves">
        <DocsTable
          rows={[
            ["Search works", "The resolver can query supported public sources."],
            ["Trust is visible", "The response includes source context and warnings."],
            ["No remote write", "The hosted API returns a plan only."],
            ["Local approval", "Actual install remains a local, approved action."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Agent" title="Prompt">
        <DocsCode>{"Use Nipmod with x-nipmod-api-key to search for an HTTP client package. Inspect the best candidate and show me the install plan. Do not modify the workspace."}</DocsCode>
      </DocsSection>
    </DocsShell>
  );
}
