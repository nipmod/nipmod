import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["tools/telegram-bot.test.ts"],
    include: ["tools/*.test.ts"]
  }
});
