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
        <DocsCode>{"Find a package for HTTP requests. Use Nipmod search first, inspect the best candidate, then show me the install plan before changing the workspace."}</DocsCode>
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
    </DocsShell>
  );
}
