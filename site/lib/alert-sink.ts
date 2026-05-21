const MAX_ALERT_BYTES = 64 * 1024;
const CHANNELS = new Set(["primary", "secondary"]);

interface AlertSinkOptions {
  channel: string;
  token?: string | undefined;
}

export async function handleAlertSinkPost(request: Request, options: AlertSinkOptions): Promise<Response> {
  if (!CHANNELS.has(options.channel)) {
    return Response.json({ ok: false, error: "not found" }, { status: 404 });
  }
  const token = options.token?.trim();
  if (!token) {
    return Response.json({ ok: false, error: "alert sink not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${token}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_ALERT_BYTES) {
    return Response.json({ ok: false, error: "payload too large" }, { status: 413 });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_ALERT_BYTES) {
    return Response.json({ ok: false, error: "payload too large" }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (!isProductionAlert(payload)) {
    return Response.json({ ok: false, error: "invalid alert" }, { status: 400 });
  }

  return Response.json(
    {
      channel: options.channel,
      ok: true,
      type: "dev.nipmod.alert-sink.ack.v1"
    },
    { status: 202 }
  );
}

function isProductionAlert(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const alert = value as {
    formatVersion?: unknown;
    generatedAt?: unknown;
    runId?: unknown;
    severity?: unknown;
    status?: unknown;
    summary?: unknown;
    suites?: unknown;
    title?: unknown;
    type?: unknown;
  };
  return (
    alert.type === "dev.nipmod.production-alert.v1" &&
    alert.formatVersion === 1 &&
    typeof alert.generatedAt === "string" &&
    typeof alert.runId === "string" &&
    typeof alert.title === "string" &&
    (alert.severity === "info" || alert.severity === "critical") &&
    (alert.status === "probe" || alert.status === "firing") &&
    alert.summary !== null &&
    typeof alert.summary === "object" &&
    Array.isArray(alert.suites)
  );
}
