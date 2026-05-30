import Link from "next/link";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";

export const metadata = createPageMetadata({
  description: "Run the public Nipmod proof loop for package discovery, install planning and source health checks.",
  path: "/proof",
  title: "Nipmod proof"
});

export default function ProofPage() {
  return (
    <DocsShell
      description="Proof is the repeatable path that shows the API, resolver, benchmark, source quality checks and safety boundary are reachable, structured and bounded."
      eyebrow="Proof"
      stats={[
        { label: "API", value: "contract" },
        { label: "Sources", value: "canary" },
        { label: "Benchmark", value: "8 cases" },
        { label: "Writes", value: "0 hosted" }
      ]}
      title="Public proof loop."
    >
      <DocsSection eyebrow="Map" title="Proof surfaces">
        <DocsGrid>
          <DocsCard label="1" title="Live agent demo">
            <p><Link href="/demo">/demo</Link> shows the user-facing preflight path before workspace writes.</p>
          </DocsCard>
          <DocsCard label="2" title="Source quality">
            <p><Link href="/source-quality">/source-quality</Link> shows source depth, regression gates and limits.</p>
          </DocsCard>
          <DocsCard label="3" title="Benchmark">
            <p><Link href="/benchmark">/benchmark</Link> shows the agent preflight comparison and methodology.</p>
          </DocsCard>
          <DocsCard label="4" title="Trust boundary">
            <p><Link href="/trust">/trust</Link> and <Link href="/security">/security</Link> explain what Nipmod does not execute or store.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Run" title="Read only proof commands">
        <DocsCode>{"curl 'https://nipmod.com/api/openapi' -H 'x-nipmod-api-key: <key>'\ncurl 'https://nipmod.com/api/search?q=http%20client&limit=3' -H 'x-nipmod-api-key: <key>'\ncurl 'https://nipmod.com/api/inspect?source=npm&name=undici' -H 'x-nipmod-api-key: <key>'\ncurl 'https://nipmod.com/api/install-plan?source=npm&name=undici' -H 'x-nipmod-api-key: <key>'\ncurl 'https://nipmod.com/api/sources/health' -H 'x-nipmod-api-key: <key>'\ncurl 'https://nipmod.com/api/archive/status' -H 'x-nipmod-api-key: <key>'"}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Expected" title="What a clean proof shows">
        <DocsTable
          rows={[
            ["OpenAPI", "The public contract returns a valid schema."],
            ["Search", "The resolver returns normalized candidate records."],
            ["Inspect", "An exact package record includes source and trust context."],
            ["Install plan", "The response requires approval before workspace writes."],
            ["Source health", "Supported source resolvers report status."],
            ["Archive status", "Archive mode is explicit."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Machine" title="Machine-readable evidence">
        <DocsTable
          rows={[
            ["Discovery manifest", <Link className="data-link" href="/.well-known/nipmod.json" key="manifest">/.well-known/nipmod.json</Link>],
            ["Demo flow", <Link className="data-link" href="/agent-demo-flow.json" key="demo">/agent-demo-flow.json</Link>],
            ["Benchmark", <Link className="data-link" href="/benchmark.json" key="benchmark">/benchmark.json</Link>],
            ["Source quality", <Link className="data-link" href="/source-quality.json" key="quality">/source-quality.json</Link>],
            ["System readiness", <Link className="data-link" href="/compatibility/system-readiness.json" key="system">/compatibility/system-readiness.json</Link>]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Boundary" title="What proof does not claim">
        <DocsTable
          rows={[
            ["No malware-free promise", "The proof shows preflight evidence and boundaries, not that every package is safe."],
            ["No hosted execution", "Nipmod does not install, clone, unpack, execute, sign, pay or write from the hosted API."],
            ["No independent audit claim", "The benchmark is public and repeatable, but it is Nipmod-authored and should keep its stated limits visible."],
            ["No partner approval claim", "Integration pages stay at public kit or outline level unless a partner approves wording."]
          ]}
        />
      </DocsSection>

      <div className="docs-next">
        <Link href="/investors">Investor brief</Link>
        <Link href="/demo">Run demo</Link>
        <Link href="/source-quality">Source quality</Link>
        <Link href="/benchmark">Benchmark</Link>
      </div>
    </DocsShell>
  );
}
