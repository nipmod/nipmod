import { readScoutCycle } from "../data";

export const revalidate = 300;
export const runtime = "nodejs";

export async function GET() {
  const cycle = await readScoutCycle();
  return Response.json({
    formatVersion: 1,
    generatedAt: cycle.generatedAt,
    node: cycle.node,
    ok: cycle.ok,
    summary: cycle.summary,
    type: "dev.nipmod.scout-last-public.v1"
  });
}
