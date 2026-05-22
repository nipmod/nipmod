import { describe, expect, test } from "vitest";
import { assertUnauthenticatedReceivePackBlocked } from "./receive-pack-abuse-smoke.ts";

describe("receive-pack abuse smoke", () => {
  test("passes only when unauthenticated receive-pack returns an HTTP Signature challenge", async () => {
    const fetchFn = fakeFetch([
      {
        status: 401,
        headers: { "www-authenticate": "Signature realm=\"gitlawb-alpha\"" }
      },
      {
        status: 401,
        headers: { "www-authenticate": "Signature realm=\"gitlawb-alpha\"" }
      }
    ]);

    await expect(
      assertUnauthenticatedReceivePackBlocked({
        baseUrl: "https://node.nipmod.test",
        fetchFn
      })
    ).resolves.toMatchObject({
      challenge: "Signature realm=\"gitlawb-alpha\"",
      status: 401,
      url: "https://node.nipmod.test/z6MknipmodUnauthProbe/receive-pack-abuse/git-receive-pack",
      probes: [
        { label: "minimal", status: 401 },
        { label: "large", status: 401 }
      ]
    });
    expect(fetchFn.calls).toHaveLength(2);
    expect(String(fetchFn.calls[1].init.body).length).toBeGreaterThan(1024 * 1024 - 1);
  });

  test("fails closed when the write endpoint accepts an unauthenticated POST", async () => {
    await expect(
      assertUnauthenticatedReceivePackBlocked({
        baseUrl: "https://node.nipmod.test",
        fetchFn: fakeFetch([{ status: 200, text: "ok" }])
      })
    ).rejects.toThrow(/expected unauthenticated receive-pack to return 401/i);
  });

  test("fails closed when 401 is not an HTTP Signature challenge", async () => {
    await expect(
      assertUnauthenticatedReceivePackBlocked({
        baseUrl: "https://node.nipmod.test",
        fetchFn: fakeFetch([{ status: 401, headers: { "www-authenticate": "Bearer" } }])
      })
    ).rejects.toThrow(/missing Signature challenge/i);
  });

  test("fails closed when a large unauthenticated body is accepted", async () => {
    await expect(
      assertUnauthenticatedReceivePackBlocked({
        baseUrl: "https://node.nipmod.test",
        fetchFn: fakeFetch([
          {
            status: 401,
            headers: { "www-authenticate": "Signature realm=\"gitlawb-alpha\"" }
          },
          { status: 200, text: "accepted" }
        ])
      })
    ).rejects.toThrow(/expected large unauthenticated receive-pack to return 401 or 413/i);
  });
});

function fakeFetch(responses) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ init, url });
    const response = responses.shift();
    if (!response) {
      throw new Error("unexpected fetch call");
    }
    const { status, headers = {}, text = "" } = response;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(headers),
      text: async () => text
    };
  };
  fetchFn.calls = calls;
  return fetchFn;
}
