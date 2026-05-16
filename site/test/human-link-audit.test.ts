import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const siteAppDir = join(import.meta.dirname, "..", "app");

const rawHrefPatterns = [
  /^\/install\.sh(?:$|[?#])/,
  /^\/\.well-known\/(?:nipmod\.json|security\.txt)(?:$|[?#])/,
  /^\/registry\//,
  /^\/transparency\//,
  /^\/releases\/.*(?:\.tgz|\.tgz\.sig)(?:$|[?#])/,
  /^\/advisories\.json(?:$|[?#])/,
  /^\/proof\/transcript\.json(?:$|[?#])/,
  /^\/compatibility\/.*\.json(?:$|[?#])/
];

const rawExpressionPatterns = [
  /\bartifact\.href\b/,
  /\breceipt\.receiptUrl\b/,
  /\bpkg\.proof\.proofUrl\b/,
  /\bpkg\.proof\.witnessUrls\b/,
  /\bpin\.href\b/
];

describe("human website links", () => {
  test("keeps raw artifacts behind explicit data links", () => {
    const violations: string[] = [];

    for (const file of tsxFiles(siteAppDir)) {
      const source = readFileSync(file, "utf8");
      for (const anchor of source.matchAll(/<a\b[\s\S]*?>/g)) {
        const tag = anchor[0];
        const line = lineFor(source, anchor.index ?? 0);
        const href = literalHref(tag);
        const hrefExpression = expressionHref(tag);
        const className = classNameValue(tag);
        const isDataLink = className.includes("data-link");
        const isRawLiteral = href ? rawHrefPatterns.some((pattern) => pattern.test(href)) : false;
        const isRawExpression = hrefExpression
          ? rawExpressionPatterns.some((pattern) => pattern.test(hrefExpression))
          : false;

        if ((isRawLiteral || isRawExpression) && !isDataLink) {
          violations.push(`${relative(process.cwd(), file)}:${line} raw artifact link must use className="data-link"`);
        }

        if (className.includes("button") && (isRawLiteral || isRawExpression)) {
          violations.push(`${relative(process.cwd(), file)}:${line} button links must not open raw artifacts`);
        }

        if (className.includes("nav-link") && (isRawLiteral || isRawExpression)) {
          violations.push(`${relative(process.cwd(), file)}:${line} nav links must not open raw artifacts`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

function tsxFiles(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        return tsxFiles(path);
      }
      return path.endsWith(".tsx") ? [path] : [];
    })
    .sort();
}

function literalHref(tag: string): string | null {
  return tag.match(/\shref="([^"]+)"/)?.[1] ?? null;
}

function expressionHref(tag: string): string | null {
  return tag.match(/\shref=\{([^}]+)\}/)?.[1] ?? null;
}

function classNameValue(tag: string): string {
  return tag.match(/\sclassName="([^"]+)"/)?.[1] ?? "";
}

function lineFor(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}
