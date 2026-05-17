import { readScoutCycle } from "../data";

export const revalidate = 300;
export const runtime = "nodejs";

export async function GET() {
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
