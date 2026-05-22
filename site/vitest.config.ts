import { defineConfig } from "vitest/config";

const includeOperatorTests = process.env.NIPMOD_INCLUDE_OPERATOR_TESTS === "1";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.ts", ...(includeOperatorTests ? ["../tools/**/*.test.ts"] : [])]
  }
});
