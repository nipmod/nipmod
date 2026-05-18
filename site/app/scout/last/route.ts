import { readScoutCycle } from "../data";
import { scoutRuntimeJson } from "../runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const live = await scoutRuntimeJson("/last");
  if (live) {
    return Response.json(live.payload, { status: live.status });
  }

  const cycle = await readScoutCycle();
  return Response.json({
    formatVersion: 1,
    generatedAt: cycle.generatedAt,
    node: cycle.node,
    ok: cycle.ok,
    draftCount: cycle.drafts.length,
    summary: cycle.summary,
    type: "dev.nipmod.scout-last-public.v1"
  });
}
