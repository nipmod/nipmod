import { competitiveBenchmarkReport } from "../../lib/competitive-benchmark-public";

export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(competitiveBenchmarkReport, {
    headers: {
      "cache-control": "public, max-age=300"
    }
  });
}
