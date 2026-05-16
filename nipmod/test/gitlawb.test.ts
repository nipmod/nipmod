import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { packProject } from "../src/bundle.js";
import {
  createGitlawbRepo,
  createPublishDryRunPlan,
  doctorGitlawb,
  fetchGitlawbBundle,
  gitlawbBlobUrl,
  parseRemoteSpecifier,
  publishGitlawbPackage,
  resolveGitlawbHelper,
  signGitlawbRequest
} from "../src/gitlawb.js";
import { generateIdentity, verifyBytes } from "../src/identity.js";
import { verifySignedReleaseEvent } from "../src/release.js";
import { createSignedSkillProject } from "./helpers/package.js";

describe("Gitlawb integration", () => {
  test("signs Gitlawb write requests with RFC 9421 compatible headers", () => {
    const identity = generateIdentity();
    const body = Buffer.from('{"name":"signed-skill"}', "utf8");
    const signed = signGitlawbRequest({
      identity,
      method: "POST",
      path: "/api/v1/repos",
      body,
      createdAt: 1_776_444_800
    });

    expect(signed.headers["Content-Digest"]).toMatch(/^sha-256=:[A-Za-z0-9+/=]+:$/);
    expect(signed.headers["Signature-Input"]).toBe(
      `sig1=("@method" "@path" "content-digest");keyid="${identity.did}";alg="ed25519";created=1776444800`
    );
    expect(signed.headers.Signature).toMatch(/^sig1=:[A-Za-z0-9+/=]+:$/);

    const signature = Buffer.from(signed.headers.Signature.slice("sig1=:".length, -1), "base64");
    expect(verifyBytes(identity.publicKeyPem, Buffer.from(signed.signatureBase, "utf8"), signature)).toBe(true);
  });

  test("creates a Gitlawb repo with signed JSON and treats conflicts as idempotent", async () => {
    const identity = generateIdentity();
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const statuses = [201, 409];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), init: init ?? {} });
      const status = statuses.shift() ?? 500;
      return new Response(status === 409 ? '{"error":"repo_exists"}' : '{"ok":true}', {
        status,
        headers: { "content-type": "application/json" }
      });
    };

    const created = await createGitlawbRepo({
      nodeUrl: "https://node.example",
      identity,
      repoName: "signed-skill",
      description: "Signed skill fixture",
      fetchImpl
    });
    const existing = await createGitlawbRepo({
      nodeUrl: "https://node.example/",
      identity,
      repoName: "signed-skill",
      description: "Signed skill fixture",
      fetchImpl
    });

    expect(created).toEqual({ created: true });
    expect(existing).toEqual({ created: false });
    expect(requests).toHaveLength(2);
    expect(requests[0]?.url).toBe("https://node.example/api/v1/repos");
    expect(requests[1]?.url).toBe("https://node.example/api/v1/repos");
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
      default_branch: "main",
      description: "Signed skill fixture",
      is_public: true,
      name: "signed-skill"
    });
    expect(requests[0]?.init.headers).toMatchObject({
      "Content-Type": "application/json",
      "Content-Digest": expect.stringMatching(/^sha-256=:/),
      "Signature-Input": expect.stringContaining(`keyid="${identity.did}"`),
      Signature: expect.stringMatching(/^sig1=:/)
    });
  });

  test("builds digest-addressable Gitlawb blob URLs from remote package specs", () => {
    const identity = generateIdentity();
    const spec = parseRemoteSpecifier(`pkg:${identity.did}/signed-skill@0.1.0`);

    expect(spec).toEqual({
      canonical: `pkg:${identity.did}/signed-skill`,
      ownerDid: identity.did,
      ownerSegment: identity.did.split(":").at(-1),
      repoName: "signed-skill",
      version: "0.1.0"
    });
    expect(gitlawbBlobUrl("https://node.nipmod.com/", spec)).toBe(
      `https://node.nipmod.com/api/v1/repos/${identity.did.split(":").at(-1)}/signed-skill/blob/releases/0.1.0/bundle.nipmod`
    );
  });

  test("rejects oversized Gitlawb bundles before buffering remote bodies", async () => {
    const identity = generateIdentity();
    const spec = parseRemoteSpecifier(`pkg:${identity.did}/signed-skill@0.1.0`);

    await expect(
      fetchGitlawbBundle({
        fetchImpl: async () =>
          new Response("oversized", {
            headers: { "content-length": String(50 * 1024 * 1024 + 1) },
            status: 200
          }),
        nodeUrl: "https://node.example",
        spec
      })
    ).rejects.toThrow("Gitlawb bundle response is too large");
  });

  test("rejects package slugs Gitlawb cannot store as repository names", () => {
    const identity = generateIdentity();

    expect(() => parseRemoteSpecifier(`pkg:${identity.did}/bad.name@0.1.0`)).toThrow(/repo names/i);
  });

  test("publishes a packed bundle through repo create and git-remote-gitlawb", async () => {
    const signedProject = await createSignedSkillProject();
    const packed = await packProject(signedProject.dir, {
      signingPrivateKeyPem: signedProject.identity.privateKeyPem
    });
    const helperDir = await mkdtemp(join(tmpdir(), "nipmod-helper-"));
    const helperPath = join(helperDir, "git-remote-gitlawb");
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const commands: Array<{ command: string; args: readonly string[]; cwd: string; env: Record<string, string> }> = [];
    let releaseJson: unknown = null;
    const sourceCommit = "0123456789abcdef0123456789abcdef01234567";

    await writeFile(helperPath, "#!/bin/sh\nexit 0\n");
    await chmod(helperPath, 0o755);

    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), init: init ?? {} });
      return new Response('{"ok":true}', { status: 201, headers: { "content-type": "application/json" } });
    };

    const result = await publishGitlawbPackage({
      projectDir: signedProject.dir,
      nodeUrl: "https://node.example",
      helperPath,
      fetchImpl,
      runCommand: async (command, args, options) => {
        commands.push({ command, args, cwd: options.cwd, env: options.env });
        if (args[0] === "rev-parse") {
          return `${sourceCommit}\n`;
        }
        if (args[0] === "add" && args.some((arg) => arg.endsWith("release.json"))) {
          releaseJson = JSON.parse(
            await readFile(join(options.cwd, "releases", "0.1.0", "release.json"), "utf8")
          );
        }
      }
    });

    expect(result.package).toBe(signedProject.manifest.canonical);
    expect(result.version).toBe("0.1.0");
    expect(result.digest).toBe(packed.digest);
    expect(result.resolved).toBe(`https://node.example/api/v1/repos/${signedProject.identity.did.split(":").at(-1)}/signed-skill/blob/releases/0.1.0/bundle.nipmod`);
    expect(result.sourceCommit).toBe(sourceCommit);
    expect(result.registryCandidate).toMatchObject({
      artifactPath: "releases/0.1.0/bundle.nipmod",
      digest: packed.digest,
      package: signedProject.manifest.canonical,
      publisher: signedProject.identity.did,
      releasePath: "releases/0.1.0/release.json",
      sourceCommit,
      sourceRepo: `gitlawb://${signedProject.identity.did}/signed-skill`,
      sourceTag: "v0.1.0",
      type: "dev.nipmod.registry-candidate.v1",
      version: "0.1.0"
    });
    expect(requests[0]?.url).toBe("https://node.example/api/v1/repos");
    expect(commands.map((call) => `${call.command} ${call.args.join(" ")}`)).toEqual([
      "git init",
      "git checkout -B main",
      "git config user.email bot@nipmod.local",
      "git config user.name nipmod",
      "git add releases/0.1.0/bundle.nipmod",
      "git commit -m Add signed-skill 0.1.0 artifact",
      "git rev-parse HEAD",
      "git add releases/0.1.0/release.json index.json",
      "git commit -m Publish signed-skill 0.1.0 metadata",
      "git tag -f v0.1.0",
      `git push gitlawb://${signedProject.identity.did}/signed-skill HEAD:main refs/tags/v0.1.0`
    ]);

    const push = commands.at(-1);
    expect(push?.env.GITLAWB_NODE).toBe("https://node.example");
    expect(push?.env.GITLAWB_KEY).toMatch(/identity\.pem$/);
    expect(push?.env.PATH.split(":")).toContain(helperDir);
    expect(
      verifySignedReleaseEvent(releaseJson, {
        artifactSha256: packed.digest,
        package: signedProject.manifest.canonical,
        publisher: signedProject.identity.did,
        sourceCommit,
        sourceRepo: `gitlawb://${signedProject.identity.did}/signed-skill`,
        sourceTag: "v0.1.0",
        version: "0.1.0"
      }).signature.keyId
    ).toBe(signedProject.identity.did);
  });

  test("creates a publish dry-run plan without creating repos or running git commands", async () => {
    const signedProject = await createSignedSkillProject();
    const packed = await packProject(signedProject.dir, {
      signingPrivateKeyPem: signedProject.identity.privateKeyPem
    });
    const helperDir = await mkdtemp(join(tmpdir(), "nipmod-dry-run-helper-"));
    const helperPath = join(helperDir, "git-remote-gitlawb");
    const gitPath = join(helperDir, "git");
    const requests: Array<{ method: string; url: string }> = [];

    await writeFile(helperPath, "#!/bin/sh\nexit 0\n");
    await writeFile(gitPath, "#!/bin/sh\nexit 0\n");
    await chmod(helperPath, 0o755);
    await chmod(gitPath, 0o755);

    const plan = await createPublishDryRunPlan({
      projectDir: signedProject.dir,
      nodeUrl: "https://node.example",
      env: { PATH: helperDir },
      fetchImpl: async (input, init) => {
        requests.push({ method: init?.method ?? "GET", url: String(input) });
        return new Response("not found", { status: 404 });
      }
    });

    expect(plan).toMatchObject({
      ready: true,
      package: signedProject.manifest.canonical,
      version: "0.1.0",
      digest: packed.digest,
      manifestDigest: packed.manifestDigest,
      repoName: "signed-skill",
      nodeUrl: "https://node.example",
      sourceRepo: `gitlawb://${signedProject.identity.did}/signed-skill`,
      sourceTag: "v0.1.0",
      registryCandidate: {
        sourceCommit: null,
        type: "dev.nipmod.registry-candidate.v1"
      },
      helper: { ok: true, path: helperPath, source: "PATH" },
      git: { ok: true, path: gitPath },
      versionCheck: {
        status: "available"
      }
    });
    expect(plan.resolved).toBe(
      `https://node.example/api/v1/repos/${signedProject.identity.did.split(":").at(-1)}/signed-skill/blob/releases/0.1.0/bundle.nipmod`
    );
    expect(plan.releaseEvent.payload.artifact.sha256).toBe(packed.digest);
    expect(plan.releaseEvent.payload.source.commit).toBeUndefined();
    expect(plan.releaseEvent.signature.keyId).toBe(signedProject.identity.did);
    expect(requests).toEqual([
      {
        method: "GET",
        url: plan.resolved
      }
    ]);
  });

  test("publish dry-run blocks an existing version with different bytes", async () => {
    const signedProject = await createSignedSkillProject();
    const helperDir = await mkdtemp(join(tmpdir(), "nipmod-dry-run-conflict-"));
    const helperPath = join(helperDir, "git-remote-gitlawb");
    const gitPath = join(helperDir, "git");

    await writeFile(helperPath, "#!/bin/sh\nexit 0\n");
    await writeFile(gitPath, "#!/bin/sh\nexit 0\n");
    await chmod(helperPath, 0o755);
    await chmod(gitPath, 0o755);

    const plan = await createPublishDryRunPlan({
      projectDir: signedProject.dir,
      nodeUrl: "https://node.example",
      env: { PATH: helperDir },
      fetchImpl: async () => new Response("different bundle", { status: 200 })
    });

    expect(plan.ready).toBe(false);
    expect(plan.versionCheck).toMatchObject({
      status: "blocked-existing-version"
    });
    expect(plan.versionCheck.existingDigest).not.toBe(plan.digest);
  });

  test("finds git-remote-gitlawb from PATH when publish gets no --helper", async () => {
    const signedProject = await createSignedSkillProject();
    const helperDir = await mkdtemp(join(tmpdir(), "nipmod-path-helper-"));
    const helperPath = join(helperDir, "git-remote-gitlawb");
    const gitPath = join(helperDir, "git");
    const commands: Array<{ command: string; args: readonly string[]; env: Record<string, string> }> = [];

    await writeFile(helperPath, "#!/bin/sh\nexit 0\n");
    await writeFile(gitPath, "#!/bin/sh\nexit 0\n");
    await chmod(helperPath, 0o755);
    await chmod(gitPath, 0o755);

    await publishGitlawbPackage({
      projectDir: signedProject.dir,
      nodeUrl: "https://node.example",
      env: { PATH: helperDir },
      fetchImpl: async () => new Response('{"ok":true}', { status: 201, headers: { "content-type": "application/json" } }),
      runCommand: async (command, args, options) => {
        commands.push({ command, args, env: options.env });
        if (args[0] === "rev-parse") {
          return "1234567890abcdef1234567890abcdef12345678\n";
        }
      }
    });

    const push = commands.at(-1);
    expect(push?.args).toEqual(["push", `gitlawb://${signedProject.identity.did}/signed-skill`, "HEAD:main", "refs/tags/v0.1.0"]);
    expect(push?.env.PATH.split(":")).toContain(helperDir);
    expect(push?.env.GITLAWB_KEY).toMatch(/identity\.pem$/);
  });

  test("stops publish before remote writes when git-remote-gitlawb is missing", async () => {
    const signedProject = await createSignedSkillProject();
    let repoCreateCalled = false;

    await expect(
      publishGitlawbPackage({
        projectDir: signedProject.dir,
        nodeUrl: "https://node.example",
        env: { PATH: "" },
        fetchImpl: async () => {
          repoCreateCalled = true;
          return new Response('{"ok":true}', { status: 201, headers: { "content-type": "application/json" } });
        }
      })
    ).rejects.toThrow(/git-remote-gitlawb/i);

    expect(repoCreateCalled).toBe(false);
  });

  test("stops publish before remote writes when git is missing", async () => {
    const signedProject = await createSignedSkillProject();
    const helperDir = await mkdtemp(join(tmpdir(), "nipmod-no-git-"));
    const helperPath = join(helperDir, "git-remote-gitlawb");
    let repoCreateCalled = false;

    await writeFile(helperPath, "#!/bin/sh\nexit 0\n");
    await chmod(helperPath, 0o755);

    await expect(
      publishGitlawbPackage({
        projectDir: signedProject.dir,
        nodeUrl: "https://node.example",
        env: { PATH: helperDir },
        fetchImpl: async () => {
          repoCreateCalled = true;
          return new Response('{"ok":true}', { status: 201, headers: { "content-type": "application/json" } });
        }
      })
    ).rejects.toThrow(/git is required/i);

    expect(repoCreateCalled).toBe(false);
  });

  test("does not trust helper binaries inside the package being published", async () => {
    const signedProject = await createSignedSkillProject();
    const projectBin = join(signedProject.dir, "bin");
    const projectHelper = join(projectBin, "git-remote-gitlawb");

    await mkdir(projectBin, { recursive: true });
    await writeFile(projectHelper, "#!/bin/sh\nexit 0\n");
    await chmod(projectHelper, 0o755);

    const missing = await resolveGitlawbHelper({ cwd: signedProject.dir, env: { PATH: "" } });

    expect(missing.ok).toBe(false);
    expect(missing.checked).not.toContain(projectHelper);
  });

  test("rejects publishing a changed bundle over an existing version", async () => {
    const signedProject = await createSignedSkillProject();
    const helperDir = await mkdtemp(join(tmpdir(), "nipmod-version-helper-"));
    const helperPath = join(helperDir, "git-remote-gitlawb");
    const gitPath = join(helperDir, "git");
    const commands: Array<{ args: readonly string[]; cwd: string }> = [];

    await writeFile(helperPath, "#!/bin/sh\nexit 0\n");
    await writeFile(gitPath, "#!/bin/sh\nexit 0\n");
    await chmod(helperPath, 0o755);
    await chmod(gitPath, 0o755);

    await expect(
      publishGitlawbPackage({
        projectDir: signedProject.dir,
        nodeUrl: "https://node.example",
        env: { PATH: helperDir },
        fetchImpl: async () =>
          new Response('{"error":"repo_exists"}', { status: 409, headers: { "content-type": "application/json" } }),
        runCommand: async (_command, args, options) => {
          commands.push({ args, cwd: options.cwd });
          if (args[0] === "clone") {
            const bundleDir = join(String(args[2]), "releases", "0.1.0");
            await mkdir(bundleDir, { recursive: true });
            await writeFile(join(bundleDir, "bundle.nipmod"), Buffer.from("different"));
          }
        }
      })
    ).rejects.toThrow(/version 0\.1\.0 already exists/i);
  });

  test("reports helper status for doctor output", async () => {
    const helperDir = await mkdtemp(join(tmpdir(), "nipmod-doctor-helper-"));
    const helperPath = join(helperDir, "git-remote-gitlawb");
    const gitPath = join(helperDir, "git");
    await writeFile(helperPath, "#!/bin/sh\nexit 0\n");
    await writeFile(gitPath, "#!/bin/sh\nexit 0\n");
    await chmod(helperPath, 0o755);
    await chmod(gitPath, 0o755);

    const found = await resolveGitlawbHelper({ env: { PATH: helperDir } });
    const missing = await resolveGitlawbHelper({ env: { PATH: "" } });
    const doctor = await doctorGitlawb({
      offline: true,
      env: { PATH: helperDir },
      nodeVersion: "v22.0.0"
    });

    expect(found).toMatchObject({ ok: true, path: helperPath, source: "PATH" });
    expect(missing.ok).toBe(false);
    expect(missing.installCommand).toContain("verified checksum");
    expect(missing.installCommand).not.toContain("curl -fsSL");
    expect(doctor.ready).toBe(true);
    expect(doctor.checks.map((check) => `${check.id}:${check.status}`)).toEqual([
      "node:ok",
      "git:ok",
      "gitlawb-helper:ok",
      "gitlawb-node:warn"
    ]);
  });

  test("treats a missing Gitlawb helper as publish-only setup", async () => {
    const helperDir = await mkdtemp(join(tmpdir(), "nipmod-doctor-no-helper-"));
    const gitPath = join(helperDir, "git");
    await writeFile(gitPath, "#!/bin/sh\nexit 0\n");
    await chmod(gitPath, 0o755);

    const doctor = await doctorGitlawb({
      offline: true,
      env: { PATH: helperDir },
      nodeVersion: "v22.0.0"
    });

    expect(doctor.ready).toBe(true);
    expect(doctor.checks.map((check) => `${check.id}:${check.status}`)).toEqual([
      "node:ok",
      "git:ok",
      "gitlawb-helper:warn",
      "gitlawb-node:warn"
    ]);
    expect(doctor.checks.find((check) => check.id === "gitlawb-helper")).toMatchObject({
      detail: expect.stringContaining("verified checksum"),
      message: "publish needs git-remote-gitlawb; install and add still work"
    });
  });

  test("publishes new versions by cloning an existing Gitlawb repo first", async () => {
    const signedProject = await createSignedSkillProject();
    const helperDir = await mkdtemp(join(tmpdir(), "nipmod-helper-"));
    const helperPath = join(helperDir, "git-remote-gitlawb");
    const commands: Array<{ command: string; args: readonly string[]; cwd: string }> = [];

    await writeFile(helperPath, "#!/bin/sh\nexit 0\n");
    await chmod(helperPath, 0o755);

    const fetchImpl: typeof fetch = async () =>
      new Response('{"error":"repo_exists"}', { status: 409, headers: { "content-type": "application/json" } });

    await publishGitlawbPackage({
      projectDir: signedProject.dir,
      nodeUrl: "https://node.example",
      helperPath,
      fetchImpl,
      runCommand: async (command, args, options) => {
        commands.push({ command, args, cwd: options.cwd });
        if (args[0] === "rev-parse") {
          return "abcdef1234567890abcdef1234567890abcdef12\n";
        }
      }
    });

    expect(commands[0]?.command).toBe("git");
    expect(commands[0]?.args.slice(0, 2)).toEqual(["clone", `gitlawb://${signedProject.identity.did}/signed-skill`]);
    expect(commands[0]?.args[2]).toMatch(/nipmod-publish-.*\/repo$/);
    expect(commands.slice(1).map((call) => `${call.command} ${call.args.join(" ")}`)).toEqual([
      "git checkout -B main",
      "git config user.email bot@nipmod.local",
      "git config user.name nipmod",
      "git add releases/0.1.0/bundle.nipmod",
      "git commit -m Add signed-skill 0.1.0 artifact",
      "git rev-parse HEAD",
      "git add releases/0.1.0/release.json index.json",
      "git commit -m Publish signed-skill 0.1.0 metadata",
      "git tag -f v0.1.0",
      `git push gitlawb://${signedProject.identity.did}/signed-skill HEAD:main refs/tags/v0.1.0`
    ]);
    expect(commands[0]?.cwd).not.toBe(commands[1]?.cwd);
  });
});
