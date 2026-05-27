import { agentDemoFlow } from "../../lib/agent-demo-flow";

export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(agentDemoFlow, {
    headers: {
      "cache-control": "public, max-age=300"
    }
  });
}
