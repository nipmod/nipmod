const DEFAULT_MAX_JSON_BODY_BYTES = 128 * 1024;

export class ApiRequestBodyError extends Error {
  constructor(
    readonly code: "invalid_json" | "payload_too_large",
    message: string,
    readonly status: 400 | 413
  ) {
    super(message);
  }
}

export async function readJsonRequestBody(request: Request, maxBytes = DEFAULT_MAX_JSON_BODY_BYTES): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number.parseInt(contentLength, 10);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new ApiRequestBodyError("payload_too_large", "request body is too large", 413);
    }
  }

  const text = await readLimitedRequestText(request, maxBytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiRequestBodyError("invalid_json", "invalid JSON", 400);
  }
}

export async function readLimitedRequestText(request: Request, maxBytes: number): Promise<string> {
  if (!request.body) {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new ApiRequestBodyError("payload_too_large", "request body is too large", 413);
    }
    return text;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new ApiRequestBodyError("payload_too_large", "request body is too large", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}
