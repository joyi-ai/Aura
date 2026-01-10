import { Env } from "@/env"
import { Storage } from "@/storage/storage"
import { Auth } from "@/auth"
import type { Provider } from "./provider"

export namespace ClaudeAgent {
  const PROVIDER_ID = "claude-agent"

  // Model aliases supported by Claude Agent SDK
  export type ModelAlias = "opus" | "sonnet" | "haiku" | "default"

  // Base capabilities shared by all Claude Code models
  const BASE_CAPABILITIES: Provider.Model["capabilities"] = {
    temperature: false,
    reasoning: true,
    attachment: true,
    toolcall: true,
    input: {
      text: true,
      audio: false,
      image: true,
      video: false,
      pdf: true,
    },
    output: {
      text: true,
      audio: false,
      image: false,
      video: false,
      pdf: false,
    },
    interleaved: true,
  }

  // Opus model - best for complex reasoning
  export const MODEL_OPUS: Provider.Model = {
    id: "opus",
    providerID: PROVIDER_ID,
    name: "Opus",
    family: "claude-agent",
    api: { id: "opus", url: "", npm: "" },
    capabilities: BASE_CAPABILITIES,
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context: 200000, output: 16000 },
    status: "active",
    options: {},
    headers: {},
    release_date: "2025-02-24",
    variants: {},
  }

  // Sonnet model - balanced for daily coding (default)
  export const MODEL_SONNET: Provider.Model = {
    id: "sonnet",
    providerID: PROVIDER_ID,
    name: "Sonnet",
    family: "claude-agent",
    api: { id: "sonnet", url: "", npm: "" },
    capabilities: BASE_CAPABILITIES,
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context: 200000, output: 16000 },
    status: "active",
    options: {},
    headers: {},
    release_date: "2025-09-29",
    variants: {},
  }

  // Haiku model - fast for simple tasks
  export const MODEL_HAIKU: Provider.Model = {
    id: "haiku",
    providerID: PROVIDER_ID,
    name: "Haiku",
    family: "claude-agent",
    api: { id: "haiku", url: "", npm: "" },
    capabilities: BASE_CAPABILITIES,
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context: 200000, output: 16000 },
    status: "active",
    options: {},
    headers: {},
    release_date: "2025-10-01",
    variants: {},
  }

  // Default model (uses Opus - best for complex reasoning)
  export const MODEL_DEFAULT: Provider.Model = {
    id: "default",
    providerID: PROVIDER_ID,
    name: "Default (Opus)",
    family: "claude-agent",
    api: { id: "default", url: "", npm: "" },
    capabilities: BASE_CAPABILITIES,
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context: 200000, output: 16000 },
    status: "active",
    options: {},
    headers: {},
    release_date: "2025-12-01",
    variants: {},
  }

  // Legacy model for backward compatibility
  export const MODEL: Provider.Model = MODEL_SONNET

  // Static provider definition
  export const PROVIDER: Provider.Info = {
    id: PROVIDER_ID,
    name: "Claude Code",
    source: "custom",
    env: ["ANTHROPIC_API_KEY"],
    options: {
      __isClaudeAgent: true,
    },
    models: {
      opus: MODEL_OPUS,
      sonnet: MODEL_SONNET,
      haiku: MODEL_HAIKU,
      default: MODEL_DEFAULT,
    },
  }

  /**
   * Check if Claude Code provider is available
   * Requires ANTHROPIC_API_KEY or Claude Code CLI to be authenticated
   * Note: OAuth tokens from OpenCode login do NOT work - the SDK needs an actual API key
   */
  export async function isAvailable(): Promise<boolean> {
    // Check for API key
    if (Env.get("ANTHROPIC_API_KEY")) return true

    // Check for API key stored via auth (not OAuth)
    const auth = await Auth.get("anthropic")
    if (auth?.type === "api" && auth.key) return true

    // If no API key, the SDK might still work if Claude Code CLI is authenticated
    // We return true here and let the SDK handle auth errors if CLI isn't authenticated
    return true
  }

  /**
   * Synchronous check for API key only (used in provider loading)
   */
  export function hasApiKey(): boolean {
    return !!Env.get("ANTHROPIC_API_KEY")
  }

  /**
   * Get the access token for authentication
   * Returns API key or OAuth access token
   */
  export async function getAccessToken(): Promise<string | undefined> {
    // Prefer API key
    const apiKey = Env.get("ANTHROPIC_API_KEY")
    if (apiKey) return apiKey

    // Fall back to OAuth
    const auth = await Auth.get("anthropic")
    if (auth?.type === "oauth") {
      // Check if token is expired
      if (auth.expires && auth.expires < Date.now()) {
        // Token expired - need refresh
        return undefined
      }
      return auth.access
    }
    if (auth?.type === "api") return auth.key

    return undefined
  }

  /**
   * Get the Claude Agent session ID for an OpenCode session
   */
  export async function getAgentSessionID(sessionID: string): Promise<string | undefined> {
    return Storage.read<string>(["claude-agent-session", sessionID]).catch((e) => {
      if (Storage.NotFoundError.isInstance(e)) {
        return undefined
      }
      throw e
    })
  }

  /**
   * Store the Claude Agent session ID for an OpenCode session
   */
  export async function setAgentSessionID(sessionID: string, agentSessionID: string): Promise<void> {
    await Storage.write(["claude-agent-session", sessionID], agentSessionID)
  }

  /**
   * Check if a model belongs to Claude Agent provider
   */
  export function isClaudeAgentModel(providerID: string): boolean {
    return providerID === PROVIDER_ID
  }
}
