import { partnerIntegrationPack } from "../../lib/partner-integration-pack";

export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(partnerIntegrationPack, {
    headers: {
      "cache-control": "public, max-age=300"
    }
  });
}
