import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();

  const url = request.nextUrl.clone();
  if ((host === "token.nipmod.com" && url.pathname === "/") || url.pathname === "/token") {
    url.pathname = "/coin";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/token"]
};
