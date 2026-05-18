import { packageDraftFromScoutCycle } from "../../../lib/scout";
import { readScoutCycle } from "../data";
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
    const live = await scoutRuntimeJson(runtimePath("/draft", request));
    if (live) {
      return Response.json(live.payload, { status: live.status });
    }

    const cycle = await readScoutCycle();
    const draft = packageDraftFromScoutCycle(cycle, repo);
    if (!draft) {
      return Response.json({ error: "repo is not a current Scout draft", ok: false }, { status: 404 });
    }
    return Response.json(draft);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error), ok: false }, { status: 400 });
  }
}
