import { createPackagePatchFromSource } from "../../../lib/scout";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const repo = url.searchParams.get("repo");
  if (!repo) {
    return Response.json({ error: "missing repo", ok: false }, { status: 400 });
  }

  try {
    return Response.json(createPackagePatchFromSource(repo));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error), ok: false }, { status: 400 });
  }
}
