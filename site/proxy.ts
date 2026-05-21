import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== "/") {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/claude-original.html";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: "/"
};
