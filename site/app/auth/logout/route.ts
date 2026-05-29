import { NextResponse, type NextRequest } from "next/server";
import { createAccountSupabaseServerClient } from "../../../lib/account-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return signOut(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return signOut(request);
}

async function signOut(request: NextRequest): Promise<Response> {
  const supabase = await createAccountSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/account", request.nextUrl.origin));
}
