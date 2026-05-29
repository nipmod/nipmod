import { NextResponse, type NextRequest } from "next/server";
import { accountAuthConfig, createAccountSupabaseServerClient, readAccountAuthProvider, safeAccountNextPath } from "../../../lib/account-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const url = request.nextUrl;
  const provider = readAccountAuthProvider(url.searchParams.get("provider"));
  const next = safeAccountNextPath(url.searchParams.get("next"));

  if (!provider) {
    return NextResponse.redirect(new URL(`/account?error=unsupported_provider`, url.origin));
  }

  const config = accountAuthConfig();
  if (!config.configured) {
    return NextResponse.redirect(new URL(`/account?error=auth_not_configured`, url.origin));
  }

  const supabase = await createAccountSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL(`/account?error=auth_not_configured`, url.origin));
  }

  const callbackUrl = new URL("/auth/callback", url.origin);
  callbackUrl.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    options: {
      redirectTo: callbackUrl.toString()
    },
    provider
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL(`/account?error=oauth_start_failed`, url.origin));
  }

  return NextResponse.redirect(data.url);
}
