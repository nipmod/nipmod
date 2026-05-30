import { accountAuthConfig } from "../../lib/account-auth";

export type AccountNotice = {
  text: string;
  tone: "error" | "success";
};

export type AccountLoginState = {
  codeRequested: boolean;
  notice: AccountNotice | null;
};

export type AccountSearchParams = Record<string, string | string[] | undefined> | undefined;

export function AccountLoginSurface({
  loginPath = "/account",
  nextPath = "/account",
  state
}: {
  loginPath?: "/" | "/account";
  nextPath?: string;
  state: AccountLoginState;
}) {
  const config = accountAuthConfig();

  return (
    <main className="account-auth-shell" id="main">
      <section className="account-auth-copy" aria-labelledby="account-login-title">
        <p className="account-auth-kicker">Package intelligence before agent execution</p>
        <h1 id="account-login-title">Search packages, inspect trust and review install boundaries through Nipmod.</h1>
        <div className="account-auth-body">
          <p>Use the same layer agents call before they install packages, pull repos, reuse models or enable MCP servers.</p>
        </div>
      </section>

      <section className="account-auth-panel" aria-label="Email login">
        {!config.configured ? (
          <AuthMissing missing={config.missing} />
        ) : (
          <LoginPanel loginPath={loginPath} nextPath={nextPath} state={state} />
        )}
      </section>
    </main>
  );
}

function LoginPanel({
  loginPath,
  nextPath,
  state
}: {
  loginPath: "/" | "/account";
  nextPath: string;
  state: AccountLoginState;
}) {
  return (
    <>
      <div className="account-auth-panel-head">
        <h2>{state.codeRequested ? "Email code" : "Login"}</h2>
      </div>
      {state.notice ? <p className={`account-login-notice account-login-notice-${state.notice.tone}`}>{state.notice.text}</p> : null}
      <div className="account-login-steps">
        {state.codeRequested ? (
          <form action="/auth/verify" className="account-login-form account-code-form" method="post">
            <input name="loginPath" type="hidden" value={loginPath} />
            <input name="next" type="hidden" value={nextPath} />
            <label className="account-field">
              <span>Email code</span>
              <input autoComplete="one-time-code" inputMode="numeric" maxLength={16} name="code" placeholder="123456" required type="text" />
            </label>
            <button className="button button-secondary" type="submit">
              Confirm code
            </button>
          </form>
        ) : (
          <form action="/auth/login" className="account-login-form" method="post">
            <input name="loginPath" type="hidden" value={loginPath} />
            <input name="next" type="hidden" value={nextPath} />
            <label className="account-field">
              <span>Email</span>
              <input autoComplete="email" inputMode="email" name="email" placeholder="you@example.com" required type="email" />
            </label>
            <button className="button button-primary" type="submit">
              Send code
            </button>
          </form>
        )}
      </div>
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

export function readAccountLoginState(params: AccountSearchParams): AccountLoginState {
  const error = readSearchValue(params?.error);
  const sent = readSearchValue(params?.sent);
  const codeRequested = sent === "code_sent";
  if (codeRequested && !error) {
    return {
      codeRequested,
      notice: {
        text: "Code sent.",
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
  if (error === "email_rate_limited") {
    return {
      codeRequested,
      notice: {
        text: "Email login is rate limited right now. Try again later.",
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
