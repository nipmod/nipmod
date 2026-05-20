import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET(): NextResponse {
  return NextResponse.redirect("https://nipmod.com/install.sh", 308);
}
