import { describe, expect, test } from "vitest";
import { selectAccountChatLlmProfile, tryAnswerAccountChatWithLlm } from "../lib/account-chat-llm";

describe("account chat LLM adapter", () => {
  test("stays disabled when no gateway token is configured", async () => {
    const result = await tryAnswerAccountChatWithLlm("wie gehts?", { env: {} });

    expect(result).toEqual({ ok: false, reason: "not_configured" });
  });

  test("returns a normal model answer without forcing a package search", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "Mir geht es gut. Frag mich nach einem Paket, wenn du eins brauchst."
              }
            }
          ],
          usage: {
            completion_tokens: 14,
            prompt_tokens: 120
          }
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      );
    };

    const result = await tryAnswerAccountChatWithLlm("wie gehts?", {
      env: {
        AI_GATEWAY_API_KEY: "test-gateway-token",
        NIPMOD_CHAT_MODEL: "openai/test-model"
      },
      fetchImpl,
      history: [{ content: "hallo", role: "user" }],
      userId: "user_123"
    });

    expect(result).toMatchObject({
      answer: "Mir geht es gut. Frag mich nach einem Paket, wenn du eins brauchst.",
      cost: {
        estimatedCostUsd: null,
        inputTokens: 120,
        outputTokens: 14,
        usageSource: "gateway"
      },
      costMode: "package",
      installPlan: null,
      model: "openai/test-model",
      ok: true,
      records: [],
      selected: null,
      usedTools: []
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.model).toBe("openai/test-model");
    expect(requests[0]?.tools).toEqual(expect.any(Array));
  });

  test("tries the fallback model when the first gateway model is unavailable", async () => {
    const models: string[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { model?: string };
      models.push(body.model ?? "");
      if (models.length === 1) {
        return new Response(JSON.stringify({ error: { message: "model unavailable" } }), { status: 404 });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: "Fallback model response." } }] }), {
        headers: { "content-type": "application/json" },
        status: 200
      });
    };

    const result = await tryAnswerAccountChatWithLlm("hello", {
      env: {
        AI_GATEWAY_API_KEY: "test-gateway-token"
      },
      fetchImpl
    });

    expect(result).toMatchObject({
      answer: "Fallback model response.",
      costMode: "conversation",
      model: "openai/gpt-5.4-mini",
      ok: true
    });
    expect(models).toEqual(["openai/gpt-5.4-nano", "openai/gpt-5.4-mini"]);
  });

  test("routes normal chat, package questions and security questions to different cost profiles", () => {
    expect(selectAccountChatLlmProfile("wie gehts?")).toMatchObject({
      maxOutputTokens: 260,
      mode: "conversation",
      models: ["openai/gpt-5.4-nano", "openai/gpt-5.4-mini"]
    });
    expect(selectAccountChatLlmProfile("best package for forms in react")).toMatchObject({
      maxOutputTokens: 620,
      mode: "package",
      models: ["openai/gpt-5.4-mini", "openai/gpt-5.4-nano"]
    });
    expect(selectAccountChatLlmProfile("is this npm package safe from malware and postinstall scripts?")).toMatchObject({
      maxOutputTokens: 850,
      mode: "security",
      models: ["openai/gpt-5.4", "openai/gpt-5.4-mini"]
    });
  });

  test("can disable LLM spend with the daily user limit", async () => {
    const result = await tryAnswerAccountChatWithLlm("hello", {
      env: {
        AI_GATEWAY_API_KEY: "test-gateway-token",
        NIPMOD_CHAT_LLM_DAILY_USER_LIMIT: "0"
      },
      fetchImpl: async () => {
        throw new Error("gateway should not be called");
      },
      userId: "budget-user"
    });

    expect(result).toEqual({ ok: false, reason: "daily_limit_exceeded" });
  });
});
