import Link from "next/link";
import { accountAuthConfig, getCurrentAccountUser } from "../../lib/account-auth";
import { DocsCard, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";
import { AccountWorkspace } from "./account-workspace";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  description: "Nipmod account surface for human package search, agent API keys and integration setup.",
  path: "/account",
  title: "Nipmod account"
});

export default async function AccountPage() {
  const config = accountAuthConfig();
  const user = await getCurrentAccountUser();

  return (
    <DocsShell
      description="A human control surface for Nipmod: ask package questions in chat and create API keys for agents from the same account."
      eyebrow="Account"
      stats={[
        { label: "Human surface", value: "chat" },
        { label: "Agent surface", value: "API keys" },
        { label: "Hosted writes", value: "0" }
      ]}
      title="Use Nipmod directly."
    >
      {!config.configured ? <AuthMissing missing={config.missing} /> : user ? <AccountWorkspace user={user} /> : <LoginPanel />}

      <DocsSection eyebrow="Model" title="One layer, two entry points">
        <DocsTable
          rows={[
            ["Human", "Signs in, asks package questions, reviews context and install plans."],
            ["Agent", "Uses an API key for search, inspect and install-plan calls."],
            ["Boundary", "The hosted API remains read-only. No package execution, no workspace writes."],
            ["Storage", "Raw API keys are returned once. The server stores keyed hashes only."]
          ]}
        />
      </DocsSection>
    </DocsShell>
  );
}

function LoginPanel() {
  return (
    <DocsSection eyebrow="Login" title="Continue with your developer account">
      <DocsGrid>
        <DocsCard label="Google" title="Sign in with Google">
          <p>Use this if you want a normal product account for chat and key creation.</p>
          <p><Link className="data-link" href="/auth/login?provider=google">Continue with Google</Link></p>
        </DocsCard>
        <DocsCard label="GitHub" title="Sign in with GitHub">
          <p>Use this if your agent or package work already lives around GitHub.</p>
          <p><Link className="data-link" href="/auth/login?provider=github">Continue with GitHub</Link></p>
        </DocsCard>
      </DocsGrid>
    </DocsSection>
  );
}

function AuthMissing({ missing }: { missing: string[] }) {
  return (
    <DocsSection eyebrow="Setup" title="Login is not configured on this deployment">
      <DocsTable
        rows={[
          ["Missing env", missing.join(", ") || "unknown"],
          ["Required", "Supabase project URL and publishable key."],
          ["Providers", "Enable Google and GitHub in Supabase Auth providers before launch."]
        ]}
      />
    </DocsSection>
  );
}
