import { createPageMetadata } from "../metadata";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";

export const metadata = createPageMetadata({
  description: "Security policy, vulnerability reporting and incident response for the Nipmod package API.",
  path: "/security",
  title: "Nipmod security"
});

const responseTargets = [
  ["Critical", "24 hour acknowledgement, signed advisory or mitigation note as soon as a safe fix exists."],
  ["High", "48 hour acknowledgement."],
  ["Medium and low", "5 business day acknowledgement."]
] as const;

const capabilities = [
  "publish signed advisories",
  "quarantine registry records",
  "block audit, CI, install plan and add flows",
  "publish updated transparency and witness proof"
];

export default function SecurityPage() {
  return (
    <DocsShell
      description="Nipmod treats package text, source metadata, prompts and install instructions as untrusted input until the resolver and trust checks say otherwise."
      eyebrow="Security"
      stats={[
        { label: "Hosted writes", value: "none" },
        { label: "Install plans", value: "approval required" },
        { label: "Reports", value: "security.txt" }
      ]}
      title="Security policy."
    >
      <DocsSection eyebrow="Report" title="What to include">
        <DocsTable
          rows={[
            ["Contact", <a href="/.well-known/security.txt" className="data-link" key="security">security.txt</a>],
            ["Package", "Name, source, version, digest and exact reproduction command."],
            ["Impact", "Which API, install plan, archive record or local command is affected."],
            ["Boundaries", "Do not include secrets, destructive payloads or unrelated private data."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Response" title="Targets">
        <DocsGrid>
          {responseTargets.map(([label, value]) => (
            <DocsCard key={label} label="target" title={label}>
              <p>{value}</p>
            </DocsCard>
          ))}
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Controls" title="What Nipmod can do">
        <DocsGrid>
          {capabilities.map((item) => (
            <DocsCard key={item} title={item}>
              <p>Unsafe package records can be downgraded, warned or blocked in Nipmod surfaces.</p>
            </DocsCard>
          ))}
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Template" title="Minimal report template">
        <DocsCode>{"Package/source:\nVersion or commit:\nEndpoint or command:\nReproduction:\nExpected result:\nActual result:\nImpact:\nContact:"}</DocsCode>
      </DocsSection>
    </DocsShell>
  );
}
