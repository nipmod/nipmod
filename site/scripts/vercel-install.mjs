import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const packagePath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

packageJson.pnpm = {
  ...(packageJson.pnpm ?? {}),
  overrides: {
    ...(packageJson.pnpm?.overrides ?? {}),
    postcss: "^8.5.14"
  }
};

writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
