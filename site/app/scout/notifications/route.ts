import { readScoutCycle } from "../data";

export const revalidate = 300;
export const runtime = "nodejs";

export async function GET() {
  const cycle = await readScoutCycle();
  return Response.json(cycle.ownerNotifications);
}
