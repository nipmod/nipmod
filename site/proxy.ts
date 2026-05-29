import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const bankrTokenUrl = "https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3";
const isDevelopment = process.env.NODE_ENV === "development";
const SUPABASE_URL_ENV = "NIPMOD_ARCHIVE_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY_ENV = "NIPMOD_ARCHIVE_SUPABASE_PUBLISHABLE_KEY";

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  const url = request.nextUrl.clone();

  if (host === "token.nipmod.com" || url.pathname === "/token") {
    return NextResponse.redirect(bankrTokenUrl, 308);
  }

  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
    return adminResponse(request);
  }

  return updateAccountSession(request);
}

export const config = {
  matcher: ["/:path*", "/token"]
};

export function adminContentSecurityPolicy(nonce: string, development = isDevelopment): string {
  const scriptSrc = development
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const connectSrc = development
    ? "connect-src 'self' https: ws: wss:"
    : "connect-src 'self' https://node.nipmod.com https://nipmod-witness.fly.dev";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    "script-src-attr 'none'",
    "upgrade-insecure-requests",
    connectSrc
  ].join("; ");
}

function adminResponse(request: NextRequest): NextResponse {
  const nonce = createNonce();
  const csp = adminContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", csp);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

async function updateAccountSession(request: NextRequest): Promise<NextResponse> {
  const supabaseUrl = process.env[SUPABASE_URL_ENV];
  const supabasePublishableKey = process.env[SUPABASE_PUBLISHABLE_KEY_ENV];

  if (!supabaseUrl || !supabasePublishableKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; options: CookieOptions; value: string }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, options, value }) => response.cookies.set(name, value, options));
      }
    }
  });

  await supabase.auth.getUser();
  return response;
}

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
