import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { generateIdentity, type Identity } from "../../src/identity.js";
import { type Manifest } from "../../src/protocol.js";

export interface SignedSkillProject {
  dir: string;
  identity: Identity;
  manifest: Manifest;
}

export async function createSignedSkillProject(prefix = "nipmod-signed-"): Promise<SignedSkillProject> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  const identity = generateIdentity();
  const name = "@probe/signed-skill";
  const slug = "signed-skill";
  const manifest: Manifest = {
    formatVersion: 1,
    name,
    canonical: `pkg:${identity.did}/${slug}`,
    version: "0.1.0",
    type: "skill",
    description: "Signed skill fixture",
    license: "MIT",
    exports: {
      ".": {
        skill: "./SKILL.md"
      }
    },
    files: ["README.md", "SKILL.md", "nipmod.json"],
    permissions: {
      filesystem: [],
      network: [],
      mcpTools: [],
      env: [],
      secrets: [],
      exec: {
        allowed: false
      },
      postinstall: {
        allowed: false
      }
    },
    publish: {
      signingKey: identity.did,
      provenance: "local"
    }
  };

  await mkdir(join(dir, ".nipmod"), { recursive: true });
  await writeFile(join(dir, "README.md"), "# Signed skill\n");
  await writeFile(join(dir, "SKILL.md"), "# Signed skill\n");
  await writeFile(join(dir, "nipmod.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(dir, ".nipmod", "identity.json"), `${JSON.stringify(identity, null, 2)}\n`, {
    mode: 0o600
  });

  return { dir, identity, manifest };
}
