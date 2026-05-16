import { handleAlertSinkPost } from "../../../../lib/alert-sink";

export async function POST(request: Request): Promise<Response> {
  return handleAlertSinkPost(request, {
    channel: "primary",
    token: process.env.NIPMOD_ALERT_SINK_TOKEN
  });
}
