import { NextResponse, type NextRequest } from "next/server";
import { createAccountSupabaseServerClient, safeAccountNextPath } from "../../../lib/account-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeAccountNextPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL(`/account?error=missing_auth_code`, url.origin));
  }

  const supabase = await createAccountSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL(`/account?error=auth_not_configured`, url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/account?error=auth_callback_failed`, url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
