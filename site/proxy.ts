import { NextResponse, type NextRequest } from "next/server";

const bankrTokenUrl = "https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();

  const url = request.nextUrl.clone();
  if (host === "token.nipmod.com") {
    return NextResponse.redirect(bankrTokenUrl, 308);
  }

  if (url.pathname === "/token") {
    url.pathname = "/coin";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*", "/token"]
};
