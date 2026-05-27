import { clawnchIntegrationDraft } from "../../lib/clawnch-integration";

export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(clawnchIntegrationDraft, {
    headers: {
      "cache-control": "public, max-age=300"
    }
  });
}
