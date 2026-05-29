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

type AccountLoginState = {
  codeRequested: boolean;
  notice: AccountNotice | null;
};

type AccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const config = accountAuthConfig();
  const user = await getCurrentAccountUser();
  const loginState = readAccountLoginState(await searchParams);

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
      {!config.configured ? <AuthMissing missing={config.missing} /> : user ? <AccountWorkspace user={user} /> : <LoginPanel state={loginState} />}

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

function LoginPanel({ state }: { state: AccountLoginState }) {
  return (
    <DocsSection eyebrow="Login" title="Continue with email">
      {state.notice ? <p className={`account-login-notice account-login-notice-${state.notice.tone}`}>{state.notice.text}</p> : null}
      <DocsGrid>
        <DocsCard label="Email" title={state.codeRequested ? "Send another code" : "Get a one-time code"}>
          <form action="/auth/login" className="account-login-form" method="post">
            <input name="next" type="hidden" value="/account" />
            <label className="account-field">
              <span>Email</span>
              <input autoComplete="email" inputMode="email" name="email" placeholder="you@example.com" required type="email" />
            </label>
            <button className="button button-primary button-small" type="submit">Send code</button>
          </form>
          <p className="account-login-help">No password and no OAuth provider setup. The email code signs you into Nipmod, then you can use chat and create agent keys.</p>
        </DocsCard>
        {state.codeRequested ? (
          <DocsCard label="Code" title="Confirm your email">
            <form action="/auth/verify" className="account-login-form" method="post">
              <input name="next" type="hidden" value="/account" />
              <label className="account-field">
                <span>Email code</span>
                <input autoComplete="one-time-code" inputMode="numeric" maxLength={16} name="code" placeholder="123456" required type="text" />
              </label>
              <button className="button button-primary button-small" type="submit">Confirm code</button>
            </form>
            <p className="account-login-help">Codes expire quickly. If it fails, send a new code with the same email.</p>
          </DocsCard>
        ) : null}
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

function readAccountLoginState(params: Record<string, string | string[] | undefined> | undefined): AccountLoginState {
  const error = readSearchValue(params?.error);
  const sent = readSearchValue(params?.sent);
  const codeRequested = sent === "code_sent";
  if (codeRequested && !error) {
    return {
      codeRequested,
      notice: {
        text: "Check your email and enter the login code.",
        tone: "success"
      }
    };
  }
  if (error === "invalid_email") {
    return {
      codeRequested,
      notice: {
        text: "Enter a valid email address.",
        tone: "error"
      }
    };
  }
  if (error === "auth_not_configured") {
    return {
      codeRequested,
      notice: {
        text: "Email login is not configured on this deployment.",
        tone: "error"
      }
    };
  }
  if (error === "email_login_failed") {
    return {
      codeRequested,
      notice: {
        text: "The login code could not be sent. Try again in a moment.",
        tone: "error"
      }
    };
  }
  if (error === "invalid_email_code") {
    return {
      codeRequested: true,
      notice: {
        text: "The email code is invalid or expired. Check the code or request a new one.",
        tone: "error"
      }
    };
  }
  if (error === "login_email_missing") {
    return {
      codeRequested: false,
      notice: {
        text: "Start again with your email address before entering a code.",
        tone: "error"
      }
    };
  }
  if (error === "auth_callback_failed" || error === "missing_auth_code") {
    return {
      codeRequested,
      notice: {
        text: "The email login could not be verified. Request a new code.",
        tone: "error"
      }
    };
  }
  return { codeRequested: false, notice: null };
}

function readSearchValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}
