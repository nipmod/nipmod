import { runProductionMonitor, type MonitorMode } from "../../../lib/production-monitor";
import { hasValidBearerToken } from "../../../lib/bearer-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mode: MonitorMode = url.searchParams.get("probe") === "1" ? "probe" : "normal";
  const authorization = authorizeMonitorRequest(request.headers.get("authorization"));
  if (!authorization.ok) {
    return Response.json(
      {
        error: authorization.error,
        ok: false,
        type: "dev.nipmod.production-monitor.auth.v1"
      },
      {
        headers: { "cache-control": "no-store" },
        status: authorization.status
      }
    );
  }

  const result = await runProductionMonitor({ mode });
  return Response.json(result, {
    headers: { "cache-control": "no-store" },
    status: result.ok ? 200 : 500
  });
}

function authorizeMonitorRequest(authorization: string | null): { ok: true } | { error: string; ok: false; status: number } {
  const secret = (process.env.CRON_SECRET ?? process.env.NIPMOD_MONITOR_SECRET)?.trim();
  if (!secret) {
    return { error: "monitor secret not configured", ok: false, status: 503 };
  }
  if (!hasValidBearerToken(authorization, secret)) {
    return { error: "unauthorized", ok: false, status: 401 };
  }
  return { ok: true };
}
