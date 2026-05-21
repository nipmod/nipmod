import { describe, expect, test } from "vitest";
import { cursorContent, cursorInstallLink, cursorMcpJson, cursorMcpServerConfig } from "../app/cursor/content";

describe("cursor page content", () => {
  test("publishes a valid Cursor MCP install deeplink", () => {
    const url = new URL(cursorInstallLink);
    expect(url.protocol).toBe("cursor:");
    expect(url.hostname).toBe("anysphere.cursor-deeplink");
    expect(url.pathname).toBe("/mcp/install");
    expect(url.searchParams.get("name")).toBe("nipmod");

    const encodedConfig = url.searchParams.get("config");
    expect(encodedConfig).toBeTruthy();
    const decoded = JSON.parse(Buffer.from(encodedConfig ?? "", "base64").toString("utf8"));
    expect(decoded).toEqual(cursorMcpServerConfig);
  });

  test("keeps Cursor wording honest until marketplace review", () => {
    expect(cursorContent.accuratePost).toContain("works in Cursor through MCP");
    expect(cursorContent.notYet).toContain("Do not say Nipmod is officially on Cursor");
    expect(cursorContent.status.map((item) => item.label)).toEqual([
      "MCP ready",
      "Local writes only",
      "Not marketplace listed yet"
    ]);
  });

  test("publishes the manual Cursor config", () => {
    expect(JSON.parse(cursorMcpJson)).toEqual({
      mcpServers: {
        nipmod: cursorMcpServerConfig
      }
    });
    expect(cursorContent.setupCommand).toBe("nipmod setup cursor");
    expect(cursorContent.reviewLinks.map((link) => link.href)).toContain("/mcp");
  });
});
