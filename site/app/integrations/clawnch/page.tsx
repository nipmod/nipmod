import Link from "next/link";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../../docs-shell";
import { createPageMetadata } from "../../metadata";
import { clawnchIntegrationDraft } from "../../../lib/clawnch-integration";

export const metadata = createPageMetadata({
  description:
    "A draft Nipmod integration outline for Clawnch package, CLI, MCP and memory surfaces. Built for partner review before any public approval claim.",
  path: "/integrations/clawnch",
  title: "Clawnch integration draft"
});

const hostInstruction = `Before this agent installs or enables Clawnch SDK, CLI, MCP or memory tooling, call Nipmod.
Resolve the exact package or source.
Inspect trust signals and source evidence.
Request an install plan.
Do not install, run, launch, trade, manage liquidity, handle credentials or touch wallets until the user or host approves outside Nipmod.`;

const httpContract = `POST https://nipmod.com/api/keys/beta
{"label":"clawnch-integration-review"}

GET https://nipmod.com/api/search?q=clawnch%20agent%20token%20tooling&sources=npm,github,mcp&limit=5
Header: x-nipmod-api-key: <key>

GET https://nipmod.com/api/inspect?source=npm&name=@clawnch/sdk
Header: x-nipmod-api-key: <key>

GET https://nipmod.com/api/install-plan?source=npm&name=@clawnch/sdk
Header: x-nipmod-api-key: <key>`;

const machineSpec = `GET https://nipmod.com/clawnch-integration.json`;

export default function ClawnchIntegrationPage() {
  return (
    <DocsShell
      description="This is a draft for Clawnch review. It maps the visible SDK, CLI, MCP and memory surfaces into a read-only Nipmod preflight, without claiming approval or taking over Clawnch-owned flows."
      eyebrow="Integration draft"
      stats={[
        { label: "Status", value: "draft" },
        { label: "Mode", value: "read only" },
        { label: "Hosted writes", value: "0" },
        { label: "Claim", value: "not official" }
      ]}
      title="Clawnch integration draft."
    >
      <DocsSection eyebrow="Scope" title="What this draft covers">
        <DocsTable
          rows={[
            ["Clawnch", "Owns token launch, trading, liquidity, memory, matching, docs, packages and any onchain or credentialed flow."],
            ["Nipmod", "Runs before package adoption. It returns source context, trust signals, warnings and install-plan boundaries."],
            ["Agent host", "Decides whether package installation, MCP enablement or credential setup is allowed in the local environment."],
            ["User", "Approves local workspace changes, credential use, wallet actions and any Clawnch-side operation."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Surfaces" title="Public surfaces to verify">
        <DocsTable
          rows={clawnchIntegrationDraft.surfaces.map((surface) => [
            surface.name,
            `${surface.kind} via ${surface.source}`,
            surface.reviewStatus === "needs_partner_confirmation" ? "needs Clawnch confirmation" : surface.reviewStatus
          ])}
        />
      </DocsSection>

      <DocsSection eyebrow="Flow" title="Agent sequence">
        <DocsTable
          rows={clawnchIntegrationDraft.proposedFlow.map((step, index) => [
            `${index + 1}`,
            step.label,
            step.description
          ])}
        />
      </DocsSection>

      <DocsSection eyebrow="Contract" title="HTTP preflight">
        <DocsCode>{httpContract}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Host prompt" title="Instruction for agent hosts">
        <DocsCode>{hostInstruction}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Review" title="What Clawnch should confirm">
        <DocsTable rows={clawnchIntegrationDraft.requiredChecks.map((check) => [check, "Needed before public announcement"])} />
      </DocsSection>

      <DocsSection eyebrow="Boundary" title="What this does not do">
        <DocsGrid>
          <DocsCard label="Nipmod" title="Read-only preflight">
            <p>Nipmod does not execute packages, clone repos, write files, handle wallets, sign transactions, launch tokens or trade.</p>
            <p>The hosted API only returns package intelligence and install-plan data.</p>
          </DocsCard>
          <DocsCard label="Clawnch" title="Ownership stays with Clawnch">
            <p>Clawnch keeps ownership of naming, product surfaces, package publishing, docs, APIs and onchain execution.</p>
            <p>Any public wording should be reviewed by Clawnch before it is treated as an official integration.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Machine" title="Agent-readable draft">
        <DocsGrid>
          <DocsCard label="JSON" title="Integration draft">
            <p>Use this if an agent or partner reviewer needs the integration outline as structured data.</p>
            <DocsCode>{machineSpec}</DocsCode>
          </DocsCard>
          <DocsCard label="Links" title="Source material">
            <DocsTable
              rows={[
                ["Clawnch site", <Link className="data-link" href={clawnchIntegrationDraft.links.clawnchSite} key="site">clawn.ch</Link>],
                ["Clawnch docs", <Link className="data-link" href={clawnchIntegrationDraft.links.clawnchDocs} key="docs">clawn.ch/docs</Link>],
                ["Clawnch skill", <Link className="data-link" href={clawnchIntegrationDraft.links.clawnchSkill} key="skill">clawn.ch/skill</Link>],
                ["CLAWS memory", <Link className="data-link" href={clawnchIntegrationDraft.links.clawnchMemory} key="memory">clawn.ch/memory</Link>]
              ]}
            />
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <div className="docs-next">
        <Link href="/clawnch-integration.json">Read integration JSON</Link>
        <Link href="/integrations">Back to integration kit</Link>
        <Link href="/api-access">Open API docs</Link>
      </div>
    </DocsShell>
  );
}
