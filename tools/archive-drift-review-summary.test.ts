import { describe, expect, test } from "vitest";
import { parseArchiveDriftReviewPayload, renderArchiveDriftReviewSummary } from "./archive-drift-review-summary.ts";

describe("archive drift review summary", () => {
  test("renders changed and failed records for GitHub step summaries", () => {
    const rendered = renderArchiveDriftReviewSummary({
      baseUrl: "https://nipmod.test",
      checkedAt: "2026-05-27T18:00:00.000Z",
      ok: true,
      readOnly: true,
      results: [
        {
          baselineDigestPrefix: "aaaaaaaaaaaa",
          currentDigestPrefix: "bbbbbbbbbbbb",
          id: "pkgintel_1",
          name: "owner/package",
          source: "github",
          status: "changed",
          trustDecision: "recommended",
          trustScore: 92
        },
        {
          error: { code: "source_rejected", retryable: false, status: 502 },
          id: "pkgintel_2",
          name: "modelcontextprotocol/servers",
          source: "github",
          status: "failed"
        },
        {
          id: "pkgintel_3",
          name: "react",
          source: "npm",
          status: "fresh"
        }
      ],
      summary: {
        changed: 1,
        failed: 1,
        fresh: 1,
        reviewed: 3,
        skipped: 0,
        totalFetched: 3
      },
      type: "dev.nipmod.archive-drift-review.v1"
    });

    expect(rendered).toContain("## Archive drift review");
    expect(rendered).toContain("| Changed | 1 |");
    expect(rendered).toContain("| Failed | 1 |");
    expect(rendered).toContain("| github | owner/package | changed | recommended 92 | aaaaaaaaaaaa -> bbbbbbbbbbbb |  |");
    expect(rendered).toContain("| github | modelcontextprotocol/servers | failed |  |  | source_rejected 502 |");
    expect(rendered).not.toContain("react");
  });

  test("parses payloads with accidental package-manager banners", () => {
    const parsed = parseArchiveDriftReviewPayload(`
> nipmod-workspace@0.0.0 archive:drift /repo
{
  "baseUrl": "https://nipmod.test",
  "checkedAt": "2026-05-27T18:00:00.000Z",
  "ok": true,
  "readOnly": true,
  "results": [],
  "summary": {
    "changed": 0,
    "failed": 0,
    "fresh": 0,
    "reviewed": 0,
    "skipped": 0,
    "totalFetched": 0
  },
  "type": "dev.nipmod.archive-drift-review.v1"
}
`);

    expect(parsed.baseUrl).toBe("https://nipmod.test");
    expect(parsed.summary.reviewed).toBe(0);
  });

  test("escapes table metacharacters in record values", () => {
    const rendered = renderArchiveDriftReviewSummary({
      baseUrl: "https://nipmod.test",
      checkedAt: "2026-05-27T18:00:00.000Z",
      ok: true,
      readOnly: true,
      results: [
        {
          baselineDigestPrefix: "aaaaaaaaaaaa",
          currentDigestPrefix: "bbbbbbbbbbbb",
          id: "pkgintel_1",
          name: "owner/pkg|name\\with-slash",
          source: "git|hub",
          status: "changed",
          trustDecision: "recommended",
          trustScore: 92
        }
      ],
      summary: {
        changed: 1,
        failed: 0,
        fresh: 0,
        reviewed: 1,
        skipped: 0,
        totalFetched: 1
      },
      type: "dev.nipmod.archive-drift-review.v1"
    });

    expect(rendered).toContain("git\\|hub");
    expect(rendered).toContain("owner/pkg\\|name\\\\with-slash");
  });
});
