import { describe, expect, test } from "vitest";
import { createDailyBuildLogDraft, type BuildLogChange } from "./daily-build-log.ts";

describe("daily build log", () => {
  test("drafts a concise public update from meaningful changes", () => {
    const changes: BuildLogChange[] = [
      {
        files: ["site/app/api/search/route.ts", "site/lib/external-packages.ts"],
        message: "Improve external source search"
      },
      {
        files: ["site/app/globals.css", "site/app/site-header.tsx"],
        message: "Polish responsive docs header"
      },
      {
        files: ["tools/source-depth-canary.ts", "tools/source-depth-canary.test.ts"],
        message: "Tighten source depth canary"
      }
    ];

    const draft = createDailyBuildLogDraft(changes, { generatedAt: new Date("2026-05-24T10:00:00.000Z") });

    expect(draft.skipped).toBe(false);
    expect(draft.notableAreas).toEqual(["api", "trust", "site"]);
    expect(draft.post).toContain("Nipmod dev update.");
    expect(draft.post).toContain("API behavior, source resolution and agent-facing response contracts.");
    expect(draft.post).toContain("Trust signals, install-plan checks and source-depth verification.");
    expect(draft.post).toContain("Website structure, docs surface and responsive product polish.");
    expect(draft.post).not.toContain("Improve external source search");
  });

  test("skips low-signal artifact-only changes", () => {
    const draft = createDailyBuildLogDraft([
      {
        files: ["site/public/releases/nipmod-1.2.9.tgz.sha256", "pnpm-lock.yaml"],
        message: "Update generated artifacts"
      }
    ]);

    expect(draft.skipped).toBe(true);
    expect(draft.post).toBeNull();
  });
});
