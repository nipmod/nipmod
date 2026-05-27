import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";
import { readPublicStats } from "../../lib/public-stats";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  description: "Public Nipmod usage snapshot with control-plane routes, internal monitors and canaries excluded from external usage counts.",
  path: "/stats",
  title: "Nipmod public stats"
});

export default async function StatsPage() {
  const stats = await readPublicStats({ hours: 24 });
  const external = stats.external;
  const archive = stats.archive;
  const recap = stats.recap;
  return (
    <DocsShell
      description="A public usage snapshot for the API beta. Control-plane routes, internal monitors, canaries and unknown legacy events are separated from external usage counts."
      eyebrow="Stats"
      stats={[
        { label: "External requests", value: formatNumber(external.requestCount) },
        { label: "External keys", value: formatNumber(external.activeKeyCount) },
        { label: "Install plans", value: formatNumber(external.installPlanCount) },
        { label: "Archive records", value: formatNumber(archive.confirmedRecords) }
      ]}
      title="Public stats."
    >
      <DocsSection eyebrow="External" title="Usage snapshot">
        <DocsGrid>
          <DocsCard label="Requests" title={formatNumber(external.requestCount)}>
            <p>External requests in the last {stats.windowHours} hours. Public, beta and partner traffic only.</p>
          </DocsCard>
          <DocsCard label="Keys" title={formatNumber(external.activeKeyCount)}>
            <p>Distinct beta or partner keys observed in external traffic during the window.</p>
          </DocsCard>
          <DocsCard label="Errors" title={formatNumber(external.errorCount)}>
            <p>External request errors. Invalid-input contract checks and internal monitors are not counted here.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Routes" title="External route usage">
        <DocsTable
          rows={external.routes.map((row) => [
            String(row.route ?? ""),
            formatNumber(row.requestCount),
            row.route === "/api/install-plan" ? "Install plan" : row.route === "/api/inspect" ? "Inspect" : row.route === "/api/search" ? "Search" : ""
          ])}
        />
      </DocsSection>

      <DocsSection eyebrow="Sources" title="External source usage">
        <DocsTable rows={external.sources.map((row) => [String(row.source ?? ""), formatNumber(row.requestCount), "Requests"])} />
      </DocsSection>

      <DocsSection eyebrow="Archive" title="Confirmed package intelligence">
        <DocsTable rows={archive.sources.map((row) => [String(row.source ?? ""), formatNumber(row.requestCount), "Records"])} />
      </DocsSection>

      <DocsSection eyebrow="Recap" title="Public-safe operator recap">
        <DocsGrid>
          <DocsCard label="Status" title={recap.publicShareRecommended ? "draft ready" : "hold"}>
            <p>{recap.headline}. The recap uses aggregate counts only.</p>
          </DocsCard>
          <DocsCard label="Privacy" title="safe aggregate">
            <p>No raw API keys, IPs, user agents, prompts, workspace paths, package hashes or private package names.</p>
          </DocsCard>
        </DocsGrid>
        <DocsTable rows={recap.bullets.map((bullet) => [bullet, "Public-safe aggregate"])} />
        {recap.draft ? <DocsCode>{recap.draft}</DocsCode> : null}
      </DocsSection>

      <DocsSection eyebrow="Boundary" title="What is excluded">
        <DocsTable
          rows={[
            ["Control plane", formatNumber(stats.excluded.controlPlaneRequestCount), "Admin and stats routes are excluded from external usage."],
            ["Internal monitors", formatNumber(stats.excluded.internalRequestCount), "Not counted as external usage."],
            ["Unknown legacy events", formatNumber(stats.excluded.unknownLegacyRequestCount), "Tracked before traffic-origin separation."],
            ["Hosted workspace writes", stats.health.workspaceWritesFromHostedApi ? "yes" : "0", "Hosted API does not write to user workspaces."]
          ]}
        />
      </DocsSection>
    </DocsShell>
  );
}

function formatNumber(value: unknown): string {
  return typeof value === "number" ? new Intl.NumberFormat("en").format(value) : String(value ?? 0);
}
