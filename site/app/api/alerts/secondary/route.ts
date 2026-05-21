import { handleAlertSinkPost } from "../../../../lib/alert-sink";

export async function POST(request: Request): Promise<Response> {
  return handleAlertSinkPost(request, {
    channel: "secondary",
    token: process.env.NIPMOD_ALERT_SECONDARY_SINK_TOKEN ?? process.env.NIPMOD_ALERT_SINK_TOKEN
  });
}
