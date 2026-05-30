import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell } from "../docs-shell";
import { createPageMetadata } from "../metadata";

export const metadata = createPageMetadata({
  description: "Shareable Nipmod links, proof paths and short update copy tied to live product receipts.",
  path: "/launch-kit",
  title: "Nipmod launch kit"
});

export default function LaunchKitPage() {
  return (
    <DocsShell
      description="Short copy and links that match the current API first product surface. Keep public claims tied to proof."
      eyebrow="Launch kit"
      title="Shareable copy."
    >
      <DocsSection eyebrow="Copy" title="Short update">
        <DocsCode>{"Nipmod is moving toward one package API for agents.\n\nAgents can search public sources, inspect trust signals and get install plans with risk and approval boundaries before anything touches a workspace.\n\nhttps://nipmod.com/api-access"}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Links" title="Use these links">
        <DocsGrid>
          <DocsCard label="Product" title="API">
            <p>
              <a href="/api-access">https://nipmod.com/api-access</a>
            </p>
          </DocsCard>
          <DocsCard label="Product" title="Sources">
            <p>
              <a href="/sources">https://nipmod.com/sources</a>
            </p>
          </DocsCard>
          <DocsCard label="Product" title="Status">
            <p>
              <a href="/status">https://nipmod.com/status</a>
            </p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>
    </DocsShell>
  );
}
