import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const publicCopyRoots = [join(import.meta.dirname, "..", "app")];
const unsupportedClaimPatterns = [
  /Gitlawb-native/i,
  /Gitlawb native/i,
  /official Gitlawb npm/i,
  /approved by Gitlawb/i,
  /endorsed by Gitlawb/i
];

describe("public claim boundaries", () => {
  test("does not claim Gitlawb endorsement or native status in public site copy", () => {
    const violations: string[] = [];

    for (const root of publicCopyRoots) {
      for (const file of sourceFiles(root)) {
        const source = readFileSync(file, "utf8");
        for (const pattern of unsupportedClaimPatterns) {
          if (pattern.test(source)) {
            violations.push(`${relative(process.cwd(), file)} contains ${pattern}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        return sourceFiles(path);
      }
      return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
    })
    .sort();
}
