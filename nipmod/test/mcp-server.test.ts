import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
import { createNipmodMcpServer } from "../src/mcp-server.js";
import { generateIdentity } from "../src/identity.js";
import { createTransparencyLogFromLeaves, signWitnessStatement } from "../src/transparency.js";

describe("nipmod MCP server", () => {
  test("initializes and lists only read-only default tools", async () => {
    const server = createNipmodMcpServer();
    const packageJson = JSON.parse(await readFile(join(import.meta.dirname, "..", "package.json"), "utf8")) as {
      version: string;
    };

    const init = await server.handleRequest({
      id: 1,
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        capabilities: {},
        clientInfo: { name: "vitest", version: "1.0.0" },
        protocolVersion: "2025-11-25"
      }
    });
    const list = await server.handleRequest({ id: 2, jsonrpc: "2.0", method: "tools/list" });

    expect(init).toMatchObject({
      id: 1,
      jsonrpc: "2.0",
      result: {
        capabilities: { tools: { listChanged: false } },
        protocolVersion: "2025-11-25",
        serverInfo: { name: "nipmod", version: packageJson.version }
      }
    });
    expect(list.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "nipmod.search",
      "nipmod.inspect",
      "nipmod.install_plan",
      "nipmod.verify",
      "nipmod.audit"
    ]);
    for (const tool of list.result.tools as Array<{ annotations: Record<string, boolean> }>) {
      expect(tool.annotations).toMatchObject({
        destructiveHint: false,
        readOnlyHint: true
      });
    }
  });

  test("searches a file-backed registry through tools/call", async () => {
    const fixture = await writeRegistryFixture("alpha-agent");
    const server = createNipmodMcpServer();
    await initialize(server);

    const result = await server.handleRequest({
      id: 3,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: {
          limit: 5,
          query: "alpha",
          registryUrl: pathToFileURL(fixture.registryPath).href
        },
        name: "nipmod.search"
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.result.structuredContent).toMatchObject({
      query: "alpha",
      total: 1,
      packages: [
        {
          canonical: fixture.canonical,
          name: "alpha-agent",
          trust: "verified/100"
        }
      ]
    });
    expect(result.result.content[0]).toMatchObject({
      type: "text"
    });
    expect(result.result.content[0].text).toContain("alpha-agent");
  });

  test("creates an install plan without mutating the project lockfile", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-mcp-plan-"));
    const app = join(workspace, "app");
    const fixture = await writeRegistryFixture("plan-agent", workspace);
    const server = createNipmodMcpServer();
    await mkdir(app, { recursive: true });
    await initialize(server);

    const result = await server.handleRequest({
      id: 4,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: {
          allowCustomRoots: true,
          allowedLogIds: [fixture.transparency.log.treeHead.logId],
          allowedWitnesses: [fixture.transparency.witness.witness],
          projectDir: app,
          registryUrl: pathToFileURL(fixture.registryPath).href,
          specifier: `${fixture.canonical}@0.1.0`
        },
        name: "nipmod.install_plan"
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.result.structuredContent).toMatchObject({
      action: "install",
      readyToInstall: true,
      package: {
        canonical: fixture.canonical,
        version: "0.1.0"
      }
    });
    await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("requires explicit custom-root opt-in for MCP trust pins", async () => {
    const fixture = await writeRegistryFixture("roots-agent");
    const server = createNipmodMcpServer();
    await initialize(server);

    const result = await server.handleRequest({
      id: 5,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: {
          allowedLogIds: [fixture.transparency.log.treeHead.logId],
          allowedWitnesses: [fixture.transparency.witness.witness],
          registryUrl: pathToFileURL(fixture.registryPath).href,
          specifier: `${fixture.canonical}@0.1.0`
        },
        name: "nipmod.inspect"
      }
    });

    expect(result.error).toMatchObject({
      code: -32000,
      message: "MCP custom trust roots require allowCustomRoots: true"
    });
  });

  test("returns a JSON-RPC error for unknown tools", async () => {
    const server = createNipmodMcpServer();
    await initialize(server);

    const result = await server.handleRequest({
      id: 6,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: {},
        name: "nipmod.publish"
      }
    });

    expect(result).toMatchObject({
      error: {
        code: -32602,
        message: "unknown tool: nipmod.publish"
      },
      id: 6,
      jsonrpc: "2.0"
    });
  });

  test("does not respond to JSON-RPC notifications without ids", async () => {
    const server = createNipmodMcpServer();

    await expect(
      server.handleRequest({
        jsonrpc: "2.0",
        method: "tools/list"
      })
    ).resolves.toBeNull();
  });

  test("rejects oversized remote MCP fetches before downstream parsers buffer them", async () => {
    const server = createNipmodMcpServer({
      fetchImpl: async () =>
        new Response("x".repeat(1_048_577), {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        })
    });
    await initialize(server);

    const result = await server.handleRequest({
      id: 7,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: {
          query: "alpha",
          registryUrl: "https://registry.example.test/packages.json"
        },
        name: "nipmod.search"
      }
    });

    expect(result).toMatchObject({
      error: {
        code: -32000,
        message: "MCP fetch response is too large"
      },
      id: 7,
      jsonrpc: "2.0"
    });
  });

  test("serves newline-delimited JSON-RPC over the CLI stdio command", async () => {
    const result = await runMcpServe([
      {
        id: 1,
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          capabilities: {},
          clientInfo: { name: "vitest", version: "1.0.0" },
          protocolVersion: "2025-11-25"
        }
      },
      {
        id: 2,
        jsonrpc: "2.0",
        method: "tools/list"
      }
    ]);

    expect(result.stderr).toBe("");
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({
      id: 1,
      jsonrpc: "2.0",
      result: {
        serverInfo: { name: "nipmod" }
      }
    });
    expect(result.messages[1].result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "nipmod.search",
      "nipmod.inspect",
      "nipmod.install_plan",
      "nipmod.verify",
      "nipmod.audit"
    ]);
  });

  test("rejects extra CLI args for mcp serve without writing non-MCP stdout frames", async () => {
    const result = await runMcpServe(
      [
        {
          id: 1,
          jsonrpc: "2.0",
          method: "tools/list"
        }
      ],
      { args: ["--json"], expectFailure: true }
    );

    expect(result.messages).toEqual([]);
    expect(result.stderr).toContain("usage: nipmod mcp serve");
  });
});

async function initialize(server: ReturnType<typeof createNipmodMcpServer>): Promise<void> {
  await server.handleRequest({
    id: 100,
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
      protocolVersion: "2025-11-25"
    }
  });
}

async function writeRegistryFixture(packageName: string, workspace?: string) {
  const dir = workspace ?? (await mkdtemp(join(tmpdir(), "nipmod-mcp-registry-")));
  const owner = generateIdentity().did;
  const canonical = `pkg:${owner}/${packageName}`;
  const digest = "f".repeat(64);
  const transparency = cliTransparency(canonical, owner, digest);
  const registryPath = join(dir, "registry.json");
  await writeFile(registryPath, `${JSON.stringify(cliRegistry(canonical, owner, digest, transparency))}\n`);
  return { canonical, registryPath, transparency };
}

function cliTransparency(canonical: string, owner: string, digest: string) {
  const logIdentity = generateIdentity();
  const witnessIdentity = generateIdentity();
  const leaf = {
    artifactSha256: digest,
    eventHash: "e".repeat(64),
    package: canonical,
    publisher: owner,
    version: "0.1.0"
  };
  const log = createTransparencyLogFromLeaves([leaf], logIdentity, "2026-05-16T14:00:00.000Z");
  const witness = signWitnessStatement(log.treeHead, witnessIdentity);
  const entry = log.entries[0];
  if (!entry) {
    throw new Error("missing transparency entry");
  }
  return { entry, log, witness };
}

function cliRegistry(
  canonical: string,
  owner: string,
  digest: string,
  transparency: ReturnType<typeof cliTransparency>
): { packages: Array<Record<string, unknown>>; [key: string]: unknown } {
  const name = canonical.split("/").at(-1);
  return {
    formatVersion: 1,
    generatedAt: "2026-05-16T14:00:00.000Z",
    packages: [
      {
        canonical,
        description: "MCP fixture package",
        digest,
        name,
        owner,
        permissions: {
          env: 0,
          exec: false,
          filesystem: 0,
          mcpTools: 0,
          network: 0,
          postinstall: false,
          secrets: 0
        },
        proof: {
          checkpointUrl: "/transparency/checkpoint.json",
          eventHash: transparency.entry.leaf.eventHash,
          leafHash: transparency.entry.leafHash,
          leafIndex: transparency.entry.leafIndex,
          leafUrl: `/transparency/leaves/${transparency.entry.leafHash}.json`,
          proofUrl: `/transparency/proofs/${transparency.entry.leafHash}.json`,
          rootHash: transparency.log.treeHead.rootHash,
          subject: `${canonical}@0.1.0`,
          treeSize: transparency.log.treeHead.treeSize,
          type: "dev.nipmod.registry.proof.v1",
          witnesses: [transparency.witness.witness],
          witnessUrls: [`/transparency/witnesses/${transparency.witness.witness}.json`]
        },
        publisher: owner,
        resolved: `https://node.nipmod.com/api/v1/repos/${owner.slice("did:key:".length)}/${name}/blob/releases/0.1.0/bundle.nipmod`,
        sourceCommit: "a".repeat(40),
        sourceRepo: `https://node.nipmod.com/${owner.slice("did:key:".length)}/${name}.git`,
        sourceTag: "v0.1.0",
        trust: {
          evidence: {
            artifactDigestVerified: true,
            bundleSignatureVerified: true,
            immutableSnapshotMatched: true,
            publisherMatchesCanonical: true,
            releaseEventSigned: true,
            sourceProvenanceVerified: true,
            transparencyLogIncluded: true,
            transparencyLogVerified: true
          },
          level: "verified",
          score: 100
        },
        type: "skill",
        version: "0.1.0"
      }
    ],
    skipped: [],
    source: "https://node.nipmod.com",
    transparencyLog: {
      ...transparency.log,
      witnesses: [transparency.witness]
    }
  };
}

async function runMcpServe(
  messages: unknown[],
  options: { args?: string[]; expectFailure?: boolean } = {}
): Promise<{ messages: Array<Record<string, unknown>>; stderr: string }> {
  const child = spawn("pnpm", ["exec", "tsx", "src/cli.ts", "mcp", "serve", ...(options.args ?? [])], {
    cwd: join(import.meta.dirname, ".."),
    env: { ...process.env, FORCE_COLOR: "0" },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  for (const message of messages) {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }
  child.stdin.end();

  const code = await new Promise<number | null>((resolve) => {
    child.on("close", resolve);
  });
  if (code !== 0 && options.expectFailure !== true) {
    throw new Error(`mcp serve failed (${code})\n${stdout}\n${stderr}`);
  }
  if (code === 0 && options.expectFailure === true) {
    throw new Error(`mcp serve unexpectedly passed\n${stdout}\n${stderr}`);
  }
  return {
    messages: stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>),
    stderr
  };
}
