import { describe, test, expect, mock } from "bun:test"
import path from "path"

mock.module("../../src/bun/index", () => ({
  BunProc: {
    install: async (pkg: string, _version?: string) => {
      const lastAtIndex = pkg.lastIndexOf("@")
      return lastAtIndex > 0 ? pkg.substring(0, lastAtIndex) : pkg
    },
    run: async () => {
      throw new Error("BunProc.run should not be called in tests")
    },
    which: () => process.execPath,
    InstallFailedError: class extends Error {},
  },
}))

const mockPlugin = () => ({})
mock.module("opencode-copilot-auth", () => ({ default: mockPlugin }))
mock.module("opencode-anthropic-auth", () => ({ default: mockPlugin }))
mock.module("@gitlab/opencode-gitlab-auth", () => ({ default: mockPlugin }))

const codexCalls = {
  loginApiKey: [] as string[],
}
mock.module("../../src/codex/app-server", () => ({
  CodexAppServer: {
    loginApiKey: async (key: string) => {
      codexCalls.loginApiKey.push(key)
      return { ok: true }
    },
    loginChatGpt: async () => ({
      type: "chatgpt",
      loginId: "test-login-id",
      authUrl: "https://auth.openai.com/oauth/authorize?test=true",
    }),
    waitForLogin: async () => ({ success: true }),
    cancelLogin: async () => ({ success: true }),
    logout: async () => ({ success: true }),
  },
}))

import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { ProviderAuth } from "../../src/provider/auth"
import { Auth } from "../../src/auth"

describe("provider.auth codex alias", () => {
  test("codex methods are available with oauth and api", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            $schema: "https://opencode.ai/config.json",
          }),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const methods = await ProviderAuth.methods()
        expect(methods["codex"]).toBeDefined()
        expect(methods["codex"].some((method) => method.type === "oauth")).toBeTrue()
        expect(methods["codex"].some((method) => method.type === "api")).toBeTrue()
      },
    })
  })

  test("codex api key triggers codex app-server login", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            $schema: "https://opencode.ai/config.json",
          }),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await Auth.remove("codex")
        await Auth.remove("openai")
        codexCalls.loginApiKey = []

        await ProviderAuth.api({
          providerID: "codex",
          key: "test-codex-key",
        })

        const openai = await Auth.get("openai")
        const codex = await Auth.get("codex")
        expect(codexCalls.loginApiKey).toContain("test-codex-key")
        expect(codex).toBeUndefined()
        expect(openai).toBeUndefined()
      },
    })
  })

  test("codex oauth callback does not persist dummy api key", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            $schema: "https://opencode.ai/config.json",
          }),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await Auth.remove("codex")
        await Auth.remove("openai")
        codexCalls.loginApiKey = []

        const start = await ProviderAuth.authorize({
          providerID: "codex",
          method: 0,
        })
        expect(start?.method).toBe("auto")

        await ProviderAuth.callback({
          providerID: "codex",
          method: 0,
        })

        const codex = await Auth.get("codex")
        const openai = await Auth.get("openai")
        expect(codex).toBeUndefined()
        expect(openai).toBeUndefined()
        expect(codexCalls.loginApiKey).toEqual([])
      },
    })
  })

  test("codex oauth authorize normalizes originator parameter", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            $schema: "https://opencode.ai/config.json",
          }),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const start = await ProviderAuth.authorize({
          providerID: "codex",
          method: 0,
        })
        expect(start?.url).toBeDefined()
        const url = new URL(start!.url)
        expect(url.searchParams.get("originator")).toBe("opencode")
      },
    })
  })
})
