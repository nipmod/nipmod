import { DocsCode, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";

export const metadata = createPageMetadata({
  description: "Audit package trust, permissions, advisories and source context before an agent changes a workspace.",
  path: "/audit",
  title: "Nipmod audit"
});

export default function AuditPage() {
  return (
    <DocsShell
      description="Audit is the local guardrail that should run after package selection and before workspace changes."
      eyebrow="Audit"
      title="Audit before install."
    >
      <DocsSection eyebrow="Commands" title="Local audit path">
        <DocsCode>{"nipmod audit --online\nnipmod ci --online\nnipmod sbom --json"}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Checks" title="What audit should verify">
        <DocsTable
          rows={[
            ["Identity", "The package identity and source record match the selected candidate."],
            ["Integrity", "Digest, lockfile and receipt data are consistent."],
            ["Warnings", "Known advisories and resolver warnings are visible before install."],
            ["Permissions", "Workspace writes happen only after local approval."]
          ]}
        />
      </DocsSection>
    </DocsShell>
  );
}
