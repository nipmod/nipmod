import { NextResponse, type NextRequest } from "next/server";
import { accountAuthConfig, createAccountSupabaseServerClient, normalizeAccountEmail, safeAccountNextPath } from "../../../lib/account-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return NextResponse.redirect(new URL("/account", request.nextUrl.origin));
}

export async function POST(request: NextRequest): Promise<Response> {
  const url = request.nextUrl;
  const formData = await request.formData().catch(() => null);
  const email = normalizeAccountEmail(formData?.get("email"));
  const next = safeAccountNextPath(readFormString(formData?.get("next")));

  if (!email) {
    return redirectToAccount(url.origin, "invalid_email");
  }

  const config = accountAuthConfig();
  if (!config.configured) {
    return redirectToAccount(url.origin, "auth_not_configured");
  }

  const supabase = await createAccountSupabaseServerClient();
  if (!supabase) {
    return redirectToAccount(url.origin, "auth_not_configured");
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
    return redirectToAccount(url.origin, "email_login_failed");
  }

  return redirectToAccount(url.origin, null, "magic_link_sent");
}

function redirectToAccount(origin: string, error: string | null, sent?: string): Response {
  const destination = new URL("/account", origin);
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
