import { readScoutCycle } from "../data";
import { scoutRuntimeJson } from "../runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const live = await scoutRuntimeJson("/candidates");
  if (live) {
    return Response.json(live.payload, { status: live.status });
  }

  const cycle = await readScoutCycle();
  return Response.json({
    candidates: cycle.candidates,
    formatVersion: 1,
    generatedAt: cycle.generatedAt,
    ok: true,
    summary: cycle.summary,
    type: "dev.nipmod.scout-candidates.v1"
  });
}
