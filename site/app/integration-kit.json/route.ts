import { integrationKit } from "../../lib/integration-kit";

export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(integrationKit, {
    headers: {
      "cache-control": "public, max-age=300"
    }
  });
}
