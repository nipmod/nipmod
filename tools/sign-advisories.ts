#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readAdvisoryPublicKeyInfo, signAdvisoryFeed } from "./advisory-signing.ts";

const root = resolve(import.meta.dirname, "..");
const advisoriesPath = join(root, "site", "public", "advisories.json");
const advisoryPrivateKeyPath =
  process.env.NIPMOD_ADVISORY_PRIVATE_KEY_PATH ?? join(root, ".nipmod", "advisory-signing-private-key.pem");
const advisoryPublicKeyPath =
  process.env.NIPMOD_ADVISORY_PUBLIC_KEY_PATH ?? join(root, "tools", "advisory-signing-public-key.json");

const signature = await signAdvisoryFeed({
  feedPath: advisoriesPath,
  privateKeyPath: advisoryPrivateKeyPath,
  publicKeyInfo: await readAdvisoryPublicKeyInfo(advisoryPublicKeyPath)
});
await writeFile(`${advisoriesPath}.sig`, `${JSON.stringify(signature, null, 2)}\n`);
console.log(`${advisoriesPath}.sig`);
