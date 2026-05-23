import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";

export const metadata = createPageMetadata({
  description: "Prepare package records for Nipmod archive review without claiming ownership of external sources.",
  path: "/package",
  title: "Create a Nipmod package"
});

export default function PackagePage() {
  return (
    <DocsShell
      description="The public package creation path is being kept conservative: source owners keep ownership, Nipmod records metadata and trust evidence, and archive writes stay behind explicit gates."
      eyebrow="Archive intake"
      stats={[
        { label: "Ownership", value: "source owner" },
        { label: "Hosted writes", value: "none" },
        { label: "Public listing", value: "gated" }
      ]}
      title="Package records need proof."
    >
      <DocsSection eyebrow="Current" title="What can happen today">
        <DocsGrid>
          <DocsCard label="Resolve" title="Find external packages">
            <p>Nipmod can search public sources and normalize package metadata for agents.</p>
          </DocsCard>
          <DocsCard label="Inspect" title="Read trust context">
            <p>Agents can inspect source, license, repository links, metrics and warning signals before selecting a package.</p>
          </DocsCard>
          <DocsCard label="Prepare" title="Create an archive candidate">
            <p>The prepare endpoint builds a candidate record. It does not grant ownership or publish blindly.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="API" title="Archive candidate flow">
        <DocsCode>{"GET /api/archive/prepare?source=npm&name=undici\nGET /api/archive/status"}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Gate" title="Before a public listing">
        <DocsTable
          rows={[
            ["Source", "The original source URL, package identity and version must be exact."],
            ["Trust", "The record needs repeatable trust signals and clear warnings."],
            ["Receipt", "Confirmed records need a durable receipt and timestamp."],
            ["Ownership", "Nipmod does not take ownership of an external package or repo."]
          ]}
        />
      </DocsSection>
    </DocsShell>
  );
}
