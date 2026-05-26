import { createPageMetadata } from "../metadata";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import systemReadiness from "../../public/compatibility/system-readiness.json";
import registryData from "../registry-data.json";
import type { RegistryIndex } from "../../lib/registry";

const registry = registryData as RegistryIndex;

type Readiness = {
  cliCommands?: string[];
  mcpTools?: string[];
  sharedArchive?: { packageCount: number };
};

const system = systemReadiness as Readiness;

export const metadata = createPageMetadata({
  description: "Public status for the Nipmod API, source resolver, archive mode, MCP boundary and readiness receipts.",
  path: "/status",
  title: "Nipmod status"
});

export default function StatusPage() {
  return (
    <DocsShell
      description="A compact view of the live API surface, archive state and verification receipts. Raw machine receipts stay linked as data, not as the main product UI."
      eyebrow="Status"
      stats={[
        { label: "Archive records", value: String(system.sharedArchive?.packageCount ?? registry.packages.length) },
        { label: "CLI commands", value: String(system.cliCommands?.length ?? 0) },
        { label: "MCP tools", value: String(system.mcpTools?.length ?? 0) }
      ]}
      title="Public status."
    >
      <DocsSection eyebrow="Live" title="Current system surface">
        <DocsGrid>
          <DocsCard label="API" title="Search, inspect, install plan">
            <p>The hosted API is the core agent surface. It resolves public package sources and returns structured results.</p>
          </DocsCard>
          <DocsCard label="Archive" title="Confirmed records">
            <p>The public archive can stay empty until a package passes the gates. Search still works through live sources.</p>
          </DocsCard>
          <DocsCard label="MCP" title="Remote read-only boundary">
            <p>Remote MCP exposes package intelligence only. Local writes stay outside the hosted boundary.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Receipts" title="Machine readable proof">
        <DocsTable
          rows={[
            ["OpenAPI", <a className="data-link" href="/api/openapi" key="openapi">/api/openapi</a>, "Endpoint contract."],
            ["Source health", <a className="data-link" href="/api/sources/health" key="sources">/api/sources/health</a>, "Resolver health."],
            ["Archive status", <a className="data-link" href="/api/archive/status" key="archive">/api/archive/status</a>, "Archive write mode."],
            ["System readiness", <a className="data-link" href="/compatibility/system-readiness.json" key="system">/compatibility/system-readiness.json</a>, "Committed readiness receipt."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Smoke" title="One read only check">
        <DocsCode>{"curl 'https://nipmod.com/api/search?q=http%20client&sources=npm,pypi,github&limit=3' -H 'x-nipmod-api-key: <key>'\ncurl 'https://nipmod.com/api/archive/status' -H 'x-nipmod-api-key: <key>'\ncurl 'https://nipmod.com/api/sources/health' -H 'x-nipmod-api-key: <key>'"}</DocsCode>
      </DocsSection>
    </DocsShell>
  );
}
