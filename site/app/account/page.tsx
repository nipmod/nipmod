import Link from "next/link";
import { accountAuthConfig, getCurrentAccountUser } from "../../lib/account-auth";
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

  if (user) {
    return <AccountWorkspace user={user} />;
  }

  return (
    <main className="account-auth-shell" id="main">
      <section className="account-auth-copy" aria-labelledby="account-login-title">
        <p>Account</p>
        <h1 id="account-login-title">Sign in to Nipmod.</h1>
        <div className="account-auth-body">
          <p>Use the same package intelligence layer directly in chat, then create API keys for agents and integrations.</p>
          <p>Email login keeps the beta simple: no password, no social account, no OAuth provider setup.</p>
        </div>
        <div className="account-auth-links">
          <Link href="/">Docs</Link>
          <Link href="/api-access">API reference</Link>
        </div>
      </section>

      <section className="account-auth-panel" aria-label="Email login">
        {!config.configured ? <AuthMissing missing={config.missing} /> : <LoginPanel state={loginState} />}
      </section>
    </main>
  );
}

function LoginPanel({ state }: { state: AccountLoginState }) {
  return (
    <>
      <div className="account-auth-panel-head">
        <span>Login</span>
        <h2>Continue with email</h2>
        <p>Enter your email, then confirm the code we send you.</p>
      </div>
      {state.notice ? <p className={`account-login-notice account-login-notice-${state.notice.tone}`}>{state.notice.text}</p> : null}
      <div className="account-login-steps">
        <form action="/auth/login" className="account-login-form" method="post">
          <input name="next" type="hidden" value="/account" />
          <label className="account-field">
            <span>Email</span>
            <input autoComplete="email" inputMode="email" name="email" placeholder="you@example.com" required type="email" />
          </label>
          <button className="button button-primary" type="submit">{state.codeRequested ? "Send another code" : "Send code"}</button>
        </form>
        {state.codeRequested ? (
          <form action="/auth/verify" className="account-login-form account-code-form" method="post">
            <input name="next" type="hidden" value="/account" />
            <label className="account-field">
              <span>Email code</span>
              <input autoComplete="one-time-code" inputMode="numeric" maxLength={16} name="code" placeholder="123456" required type="text" />
            </label>
            <button className="button button-secondary" type="submit">Confirm code</button>
          </form>
        ) : null}
      </div>
      <p className="account-login-help">After login, Nipmod opens the chat first. API key creation and settings are in the left account rail.</p>
    </>
  );
}

function AuthMissing({ missing }: { missing: string[] }) {
  return (
    <div className="account-auth-panel-head">
      <span>Setup</span>
      <h2>Login is not configured.</h2>
      <p>Missing env: {missing.join(", ") || "unknown"}. Supabase URL and publishable key are required.</p>
    </div>
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
