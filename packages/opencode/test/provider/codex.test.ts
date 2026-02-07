import { describe, expect, mock, test } from "bun:test"

const state = {
  data: [] as Record<string, unknown>[],
}

mock.module("../../src/codex/app-server", () => ({
  CodexAppServer: {
    modelList: async () => state.data,
    account: async () => ({ account: {}, requiresOpenaiAuth: false }),
  },
}))

import { CodexProvider } from "../../src/provider/codex"

describe("provider.codex listModels fallback", () => {
  test("injects gpt-5.3-codex when app-server model list is stale", async () => {
    state.data = [
      {
        model: "gpt-5.2-codex",
        displayName: "GPT-5.2 Codex",
        supportedReasoningEfforts: ["low", "medium", "high"],
      },
    ]

    const models = await CodexProvider.listModels()
    expect(models["gpt-5.2-codex"]).toBeDefined()
    expect(models["gpt-5.3-codex"]).toBeDefined()
    const model = models["gpt-5.3-codex"]
    if (!model) throw new Error("expected gpt-5.3-codex model to be present")
    expect(model.name).toBe("GPT-5.3 Codex")
    expect(model.release_date).toBe("2026-02-05")
    expect(model.limit.context).toBe(400000)
    expect(model.variants?.["xhigh"]).toEqual({ reasoningEffort: "xhigh" })
  })

  test("preserves app-server metadata for gpt-5.3-codex", async () => {
    state.data = [
      {
        model: "gpt-5.3-codex",
        displayName: "Codex 5.3 from server",
        supportedReasoningEfforts: ["high", "xhigh", "low", "medium"],
      },
    ]

    const models = await CodexProvider.listModels()
    const model = models["gpt-5.3-codex"]
    if (!model) throw new Error("expected gpt-5.3-codex model to be present")
    expect(model.name).toBe("Codex 5.3 from server")
    expect(Object.keys(model.variants ?? {})).toEqual(["low", "medium", "high", "xhigh"])
    expect(models["gpt-5.2-codex"]).toBeDefined()
  })
})
