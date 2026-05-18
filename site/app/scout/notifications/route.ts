import { readScoutCycle } from "../data";
import { scoutRuntimeJson } from "../runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const live = await scoutRuntimeJson("/notifications");
  if (live) {
    return Response.json(live.payload, { status: live.status });
  }

  const cycle = await readScoutCycle();
  return Response.json(cycle.ownerNotifications);
}
