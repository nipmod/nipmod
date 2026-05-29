import { NextResponse, type NextRequest } from "next/server";
import {
  ACCOUNT_LOGIN_EMAIL_COOKIE,
  createAccountSupabaseServerClient,
  normalizeAccountEmail,
  normalizeAccountEmailCode,
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
  const email = normalizeAccountEmail(request.cookies.get(ACCOUNT_LOGIN_EMAIL_COOKIE)?.value);
  const emailCode = normalizeAccountEmailCode(formData?.get("code"));
  const next = safeAccountNextPath(readFormString(formData?.get("next")));

  if (!email) {
    return redirectToAccount(url.origin, "login_email_missing");
  }
  if (!emailCode) {
    return redirectToAccount(url.origin, "invalid_email_code", "code_sent");
  }

  const supabase = await createAccountSupabaseServerClient();
  if (!supabase) {
    return redirectToAccount(url.origin, "auth_not_configured");
  }

  const { error } = await supabase.auth.verifyOtp({
    email,
    token: emailCode,
    type: "email"
  });

  if (error) {
    return redirectToAccount(url.origin, "invalid_email_code", "code_sent");
  }

  const response = NextResponse.redirect(new URL(next, url.origin));
  response.cookies.delete(ACCOUNT_LOGIN_EMAIL_COOKIE);
  return response;
}

function redirectToAccount(origin: string, error: string, sent?: string): NextResponse {
  const destination = new URL("/account", origin);
  destination.searchParams.set("error", error);
  if (sent) {
    destination.searchParams.set("sent", sent);
  }
  return NextResponse.redirect(destination);
}

function readFormString(value: FormDataEntryValue | null | undefined): string | null {
  return typeof value === "string" ? value : null;
}
