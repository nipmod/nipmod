import { publicSourceQualityReport } from "../../lib/source-quality-public";

export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(publicSourceQualityReport(), {
    headers: {
      "cache-control": "public, max-age=300"
    }
  });
}
