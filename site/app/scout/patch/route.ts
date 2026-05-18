import { createPackagePatchFromSource } from "../../../lib/scout";
import { runtimePath, scoutRuntimeJson } from "../runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const repo = url.searchParams.get("repo");
  if (!repo) {
    return Response.json({ error: "missing repo", ok: false }, { status: 400 });
  }

  try {
    const live = await scoutRuntimeJson(runtimePath("/patch", request));
    if (live) {
      return Response.json(live.payload, { status: live.status });
    }

    return Response.json(createPackagePatchFromSource(repo));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error), ok: false }, { status: 400 });
  }
}
