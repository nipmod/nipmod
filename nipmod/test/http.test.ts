import { describe, expect, test } from "vitest";
import { readResponseBytes } from "../src/http.js";

describe("bounded HTTP response reader", () => {
  test("rejects oversized content-length before reading the body", async () => {
    await expect(
      readResponseBytes(
        new Response("ok", {
          headers: { "content-length": "11" },
          status: 200
        }),
        { label: "registry", maxBytes: 10 }
      )
    ).rejects.toThrow("registry response is too large");
  });

  test("rejects streaming responses as soon as the byte limit is crossed", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(6));
        controller.enqueue(new Uint8Array(6));
        controller.close();
      }
    });

    await expect(
      readResponseBytes(new Response(body, { status: 200 }), {
        label: "registry",
        maxBytes: 10
      })
    ).rejects.toThrow("registry response is too large");
  });
});
