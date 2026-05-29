import { NextResponse, type NextRequest } from "next/server";
import {
  ACCOUNT_LOGIN_EMAIL_COOKIE,
  accountAuthConfig,
  createAccountSupabaseServerClient,
  normalizeAccountEmail,
  safeAccountLoginPath,
  safeAccountNextPath
} from "../../../lib/account-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return NextResponse.redirect(new URL("/account", request.nextUrl.origin));
}

export async function POST(request: NextRequest): Promise<Response> {
  const url = request.nextUrl;
  const formData = await request.formData().catch(() => null);
  const email = normalizeAccountEmail(formData?.get("email"));
  const loginPath = safeAccountLoginPath(readFormString(formData?.get("loginPath")));
  const next = safeAccountNextPath(readFormString(formData?.get("next")));

  if (!email) {
    return redirectToLogin(url.origin, loginPath, "invalid_email");
  }

  const config = accountAuthConfig();
  if (!config.configured) {
    return redirectToLogin(url.origin, loginPath, "auth_not_configured");
  }

  const supabase = await createAccountSupabaseServerClient();
  if (!supabase) {
    return redirectToLogin(url.origin, loginPath, "auth_not_configured");
  }

  const callbackUrl = new URL("/auth/callback", url.origin);
  callbackUrl.searchParams.set("next", next);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      shouldCreateUser: true
    }
  });

  if (error) {
    return redirectToLogin(url.origin, loginPath, "email_login_failed");
  }

  const response = redirectToLogin(url.origin, loginPath, null, "code_sent");
  response.cookies.set(ACCOUNT_LOGIN_EMAIL_COOKIE, email, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: url.protocol === "https:"
  });
  return response;
}

function redirectToLogin(origin: string, path: "/" | "/account", error: string | null, sent?: string): NextResponse {
  const destination = new URL(path, origin);
  if (error) {
    destination.searchParams.set("error", error);
  }
  if (sent) {
    destination.searchParams.set("sent", sent);
  }
  return NextResponse.redirect(destination);
}

function readFormString(value: FormDataEntryValue | null | undefined): string | null {
  return typeof value === "string" ? value : null;
}
