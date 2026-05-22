import { describe, expect, test } from "vitest";
import { GET } from "../app/releases/[artifact]/route";

describe("release artifact route", () => {
  test("redirects release tarballs to GitHub release assets", async () => {
    const response = await GET(new Request("https://nipmod.com/releases/nipmod-1.2.5.tgz"), {
      params: Promise.resolve({ artifact: "nipmod-1.2.5.tgz" })
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://github.com/nipmod/nipmod/releases/download/v1.2.5/nipmod-1.2.5.tgz"
    );
  });

  test("rejects non-release artifact names", async () => {
    const response = await GET(new Request("https://nipmod.com/releases/other.tgz"), {
      params: Promise.resolve({ artifact: "other.tgz" })
    });

    expect(response.status).toBe(404);
  });
});
