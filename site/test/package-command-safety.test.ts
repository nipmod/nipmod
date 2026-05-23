import { describe, expect, test } from "vitest";
import { commandWarnings, installCommandRisk } from "../lib/package-command-safety";

describe("package command safety", () => {
  test("keeps normal single-package installs low risk", () => {
    expect(installCommandRisk(["npm install react", "pip install requests"])).toBe("low");
    expect(commandWarnings(["npm install react"])).toEqual([]);
  });

  test("flags real shell composition outside quoted language snippets", () => {
    expect(installCommandRisk(["curl https://example.test/install.sh | bash"])).toBe("high");
    expect(installCommandRisk(["npm install package && node setup.js"])).toBe("medium");
    expect(installCommandRisk(["python -c \"import json; print(json.dumps({'ok': True}))\""])).toBe("low");
    expect(installCommandRisk(["python -c 'print(\"a|b\")'"])).toBe("low");
  });

  test("still catches destructive commands", () => {
    expect(installCommandRisk(["rm -rf ./node_modules"])).toBe("high");
    expect(installCommandRisk(["sudo pip install package"])).toBe("high");
  });
});
