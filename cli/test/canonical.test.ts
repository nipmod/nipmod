import { describe, expect, test } from "vitest";
import { canonicalJson, sha256Hex } from "../src/verifier.js";

describe("canonical JSON", () => {
  test("sorts object keys recursively without reordering arrays", () => {
    const value = { b: 2, a: { d: 4, c: 3 }, z: [ { b: 2, a: 1 } ] };

    expect(canonicalJson(value)).toBe('{"a":{"c":3,"d":4},"b":2,"z":[{"a":1,"b":2}]}');
  });

  test("produces stable SHA-256 hex digests", () => {
    expect(sha256Hex(Buffer.from("hello"))).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });
});

