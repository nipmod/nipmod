export async function readResponseBytes(
  response: Response,
  options: { label: string; maxBytes: number }
): Promise<Buffer> {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (!Number.isFinite(parsedLength) || parsedLength < 0) {
      throw new Error(`${options.label} response has invalid content-length`);
    }
    if (parsedLength > options.maxBytes) {
      throw new Error(`${options.label} response is too large`);
    }
  }

  if (!response.body) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > options.maxBytes) {
      throw new Error(`${options.label} response is too large`);
    }
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const read = await reader.read();
    if (read.done) {
      break;
    }
    total += read.value.byteLength;
    if (total > options.maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // The original limit failure is the important error.
      }
      throw new Error(`${options.label} response is too large`);
    }
    chunks.push(read.value);
  }

  return Buffer.concat(chunks, total);
}

export async function readResponseText(
  response: Response,
  options: { label: string; maxBytes: number }
): Promise<string> {
  return (await readResponseBytes(response, options)).toString("utf8");
}
