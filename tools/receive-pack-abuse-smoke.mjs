#!/usr/bin/env node
import { fileURLToPath } from "node:url";

const DEFAULT_NODE_URL = "https://node.nipmod.com";
const PROBE_OWNER = "z6MknipmodUnauthProbe";
const PROBE_REPO = "receive-pack-abuse";
const LARGE_UNAUTH_BODY_BYTES = 1024 * 1024;

export async function assertUnauthenticatedReceivePackBlocked({
  baseUrl = DEFAULT_NODE_URL,
  fetchFn = fetch
} = {}) {
  const url = `${baseUrl.replace(/\/+$/, "")}/${PROBE_OWNER}/${PROBE_REPO}/git-receive-pack`;
  const minimal = await postReceivePack({
    body: "0000",
    fetchFn,
    label: "minimal",
    url
  });
  assertSignatureChallenge(minimal);

  const large = await postReceivePack({
    body: "0".repeat(LARGE_UNAUTH_BODY_BYTES),
    fetchFn,
    label: "large",
    url
  });
  if (![401, 413].includes(large.status)) {
    throw new Error(`expected large unauthenticated receive-pack to return 401 or 413, got ${large.status}${large.body ? `: ${large.body}` : ""}`);
  }
  if (large.status === 401) {
    assertSignatureChallenge(large);
  }

  return {
    challenge: minimal.challenge,
    probes: [minimal, large].map(({ body, ...probe }) => probe),
    status: minimal.status,
    url
  };
}

async function postReceivePack({ body, fetchFn, label, url }) {
  const response = await fetchFn(url, {
    body,
    headers: {
      "content-type": "application/x-git-receive-pack-request"
    },
    method: "POST",
    redirect: "error"
  });
  const challenge = response.headers?.get?.("www-authenticate") ?? "";

  if (label === "minimal" && response.status !== 401) {
    const responseBody = typeof response.text === "function" ? await response.text() : "";
    throw new Error(
      `expected unauthenticated receive-pack to return 401, got ${response.status}${responseBody ? `: ${responseBody.slice(0, 160)}` : ""}`
    );
  }

  return {
    body: typeof response.text === "function" && response.status !== 401 ? (await response.text()).slice(0, 160) : "",
    challenge,
    label,
    status: response.status,
    url,
    bytes: body.length
  };
}

function assertSignatureChallenge(probe) {
  if (!/\bSignature\b/i.test(probe.challenge)) {
    throw new Error("unauthenticated receive-pack returned 401 but is missing Signature challenge");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await assertUnauthenticatedReceivePackBlocked();
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}
