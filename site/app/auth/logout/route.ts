import { NextResponse, type NextRequest } from "next/server";
import { createAccountSupabaseServerClient } from "../../../lib/account-auth";
import { accountMutationRejection } from "../../../lib/account-request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return NextResponse.json(
    { code: "method_not_allowed", error: "logout requires POST", status: 405, type: "dev.nipmod.api-error.v1" },
    { headers: { allow: "POST" }, status: 405 }
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  const rejectedMutation = accountMutationRejection(request);
  if (rejectedMutation) {
    return NextResponse.json(
      { code: "account_mutation_rejected", error: rejectedMutation, status: 403, type: "dev.nipmod.api-error.v1" },
      { status: 403 }
    );
  }
  return signOut(request);
}

async function signOut(request: NextRequest): Promise<Response> {
  const supabase = await createAccountSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/account", request.nextUrl.origin));
}
