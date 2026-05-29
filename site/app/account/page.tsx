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

type AccountNotice = {
  text: string;
  tone: "error" | "success";
};

type AccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const config = accountAuthConfig();
  const user = await getCurrentAccountUser();
  const notice = readAccountNotice(await searchParams);

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
      {!config.configured ? <AuthMissing missing={config.missing} /> : user ? <AccountWorkspace user={user} /> : <LoginPanel notice={notice} />}

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

function LoginPanel({ notice }: { notice: AccountNotice | null }) {
  return (
    <DocsSection eyebrow="Login" title="Continue with email">
      {notice ? <p className={`account-login-notice account-login-notice-${notice.tone}`}>{notice.text}</p> : null}
      <DocsGrid>
        <DocsCard label="Email" title="Get a one-time login link">
          <form action="/auth/login" className="account-login-form" method="post">
            <input name="next" type="hidden" value="/account" />
            <label className="account-field">
              <span>Email</span>
              <input autoComplete="email" inputMode="email" name="email" placeholder="you@example.com" required type="email" />
            </label>
            <button className="button button-primary button-small" type="submit">Send login link</button>
          </form>
          <p className="account-login-help">No password and no OAuth provider setup. The link signs you into Nipmod, then you can use chat and create agent keys.</p>
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
          ["Email auth", "Enable the Supabase email provider and add nipmod.com to the allowed redirect URLs."]
        ]}
      />
    </DocsSection>
  );
}

function readAccountNotice(params: Record<string, string | string[] | undefined> | undefined): AccountNotice | null {
  const error = readSearchValue(params?.error);
  const sent = readSearchValue(params?.sent);
  if (sent === "magic_link_sent") {
    return {
      text: "Check your email for the Nipmod login link.",
      tone: "success"
    };
  }
  if (error === "invalid_email") {
    return {
      text: "Enter a valid email address.",
      tone: "error"
    };
  }
  if (error === "auth_not_configured") {
    return {
      text: "Email login is not configured on this deployment.",
      tone: "error"
    };
  }
  if (error === "email_login_failed") {
    return {
      text: "The login email could not be sent. Try again in a moment.",
      tone: "error"
    };
  }
  if (error === "auth_callback_failed" || error === "missing_auth_code") {
    return {
      text: "The login link could not be verified. Request a new link.",
      tone: "error"
    };
  }
  return null;
}

function readSearchValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}
