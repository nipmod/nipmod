import { SCOUT_INTERVAL_MS } from "../../../lib/scout";
import { readScoutCycle } from "../data";

export const revalidate = 300;
export const runtime = "nodejs";

export async function GET() {
  try {
    const cycle = await readScoutCycle();
    return Response.json({
      intervalMs: SCOUT_INTERVAL_MS,
      lastError: null,
      lastRunAt: cycle.generatedAt,
      ok: true,
      running: false,
      runs: 1,
      stale: false,
      startedAt: cycle.generatedAt,
      summary: cycle.summary,
      type: "dev.nipmod.scout-health.v1"
    });
  } catch (error) {
    return Response.json(
      {
        intervalMs: SCOUT_INTERVAL_MS,
        lastError: error instanceof Error ? error.message : String(error),
        lastRunAt: new Date().toISOString(),
        ok: false,
        running: false,
        runs: 1,
        stale: true,
        startedAt: null,
        summary: null,
        type: "dev.nipmod.scout-health.v1"
      },
      { status: 503 }
    );
  }
}
