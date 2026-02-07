import { Instance } from "@/project/instance"
import { Plugin } from "../plugin"
import { map, filter, pipe, fromEntries, mapValues } from "remeda"
import z from "zod"
import { fn } from "@/util/fn"
import type { AuthOuathResult, Hooks, AuthHook } from "@opencode-ai/plugin"
import { NamedError } from "@opencode-ai/util/error"
import { Auth, OAUTH_DUMMY_KEY } from "@/auth"
import { CodexAppServer } from "../codex/app-server"

export namespace ProviderAuth {
  function isRecord(input: unknown): input is Record<string, unknown> {
    return typeof input === "object" && input !== null
  }

  function readString(input: unknown): string | undefined {
    return typeof input === "string" ? input : undefined
  }

  function readBoolean(input: unknown): boolean | undefined {
    return typeof input === "boolean" ? input : undefined
  }

  function normalizeCodexAuthUrl(input: string): string {
    const url = new URL(input)
    // Keep the browser auth page in the same shape users already had working.
    url.searchParams.set("originator", "opencode")
    return url.toString()
  }

  const codexAuth: AuthHook = {
    provider: "codex",
    methods: [
      {
        label: "ChatGPT Pro/Plus (browser)",
        type: "oauth",
        authorize: async () => {
          const start = await CodexAppServer.loginChatGpt()
          if (!isRecord(start)) {
            throw new Error("Failed to initiate Codex ChatGPT login")
          }
          const loginId = readString(start.loginId)
          const authUrl = readString(start.authUrl)
          if (!loginId || !authUrl) {
            throw new Error("Failed to initiate Codex ChatGPT login")
          }
          return {
            method: "auto" as const,
            url: normalizeCodexAuthUrl(authUrl),
            instructions: "Complete authorization in your browser. This window will close automatically.",
            callback: async () => {
              const result = await CodexAppServer.waitForLogin(loginId).catch(() => undefined)
              const success = isRecord(result) ? readBoolean(result.success) : undefined
              if (success !== true) {
                await CodexAppServer.cancelLogin(loginId).catch(() => {})
                return { type: "failed" as const }
              }
              return {
                type: "success" as const,
                // Marker to indicate codex app-server auth completed. This is not an API key.
                key: OAUTH_DUMMY_KEY,
              }
            },
          }
        },
      },
      {
        label: "Manually enter API Key",
        type: "api",
      },
    ],
  }

  const state = Instance.state(async () => {
    const methods = pipe(
      await Plugin.list(),
      filter((x) => x.auth?.provider !== undefined),
      map((x) => [x.auth!.provider, x.auth!] as const),
      fromEntries(),
    )
    if (!methods["codex"]) {
      methods["codex"] = codexAuth
    }
    return { methods, pending: {} as Record<string, AuthOuathResult> }
  })

  export const Method = z
    .object({
      type: z.union([z.literal("oauth"), z.literal("api")]),
      label: z.string(),
    })
    .meta({
      ref: "ProviderAuthMethod",
    })
  export type Method = z.infer<typeof Method>

  export async function methods() {
    const methods = await state().then((x) => x.methods)
    return mapValues(methods, (x) =>
      x.methods.map(
        (y): Method => ({
          type: y.type,
          label: y.label,
        }),
      ),
    )
  }

  export const Authorization = z
    .object({
      url: z.string(),
      method: z.union([z.literal("auto"), z.literal("code")]),
      instructions: z.string(),
    })
    .meta({
      ref: "ProviderAuthAuthorization",
    })
  export type Authorization = z.infer<typeof Authorization>

  export const authorize = fn(
    z.object({
      providerID: z.string(),
      method: z.number(),
    }),
    async (input): Promise<Authorization | undefined> => {
      const auth = await state().then((s) => s.methods[input.providerID])
      if (!auth) return
      const method = auth.methods[input.method]
      if (!method) return
      if (method.type === "oauth") {
        const result = await method.authorize()
        await state().then((s) => (s.pending[input.providerID] = result))
        return {
          url: result.url,
          method: result.method,
          instructions: result.instructions,
        }
      }
    },
  )

  export const callback = fn(
    z.object({
      providerID: z.string(),
      method: z.number(),
      code: z.string().optional(),
    }),
    async (input) => {
      const match = await state().then((s) => s.pending[input.providerID])
      if (!match) throw new OauthMissing({ providerID: input.providerID })
      let result

      if (match.method === "code") {
        if (!input.code) throw new OauthCodeMissing({ providerID: input.providerID })
        result = await match.callback(input.code)
      }

      if (match.method === "auto") {
        result = await match.callback()
      }

      if (result?.type === "success") {
        const isCodexOAuthMarker = input.providerID === "codex" && "key" in result && result.key === OAUTH_DUMMY_KEY
        if (isCodexOAuthMarker) {
          return
        }
        if ("key" in result) {
          await Auth.set(input.providerID, {
            type: "api",
            key: result.key,
          })
        }
        if ("refresh" in result) {
          const info: Auth.Info = {
            type: "oauth",
            access: result.access,
            refresh: result.refresh,
            expires: result.expires,
          }
          if (result.accountId) {
            info.accountId = result.accountId
          }
          await Auth.set(input.providerID, info)
        }
        return
      }

      throw new OauthCallbackFailed({})
    },
  )

  export const api = fn(
    z.object({
      providerID: z.string(),
      key: z.string(),
    }),
    async (input) => {
      await Auth.set(input.providerID, {
        type: "api",
        key: input.key,
      })
    },
  )

  export const OauthMissing = NamedError.create(
    "ProviderAuthOauthMissing",
    z.object({
      providerID: z.string(),
    }),
  )
  export const OauthCodeMissing = NamedError.create(
    "ProviderAuthOauthCodeMissing",
    z.object({
      providerID: z.string(),
    }),
  )

  export const OauthCallbackFailed = NamedError.create("ProviderAuthOauthCallbackFailed", z.object({}))
}
