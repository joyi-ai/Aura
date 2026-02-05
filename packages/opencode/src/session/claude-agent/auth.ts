import { Log } from "@/util/log"
import { Env } from "@/env"

export namespace ClaudeAgentAuth {
  const log = Log.create({ service: "claude-agent-auth" })

  /**
   * Get authentication environment variables for Claude Agent SDK
   * Supports: API key, OAuth token, or falls back to CLI auth
   */
  export async function getAuthEnv(): Promise<Record<string, string>> {
    const env: Record<string, string> = {}

    // Check for API key first (highest priority)
    const apiKey = Env.get("ANTHROPIC_API_KEY")
    if (apiKey) {
      log.info("using ANTHROPIC_API_KEY for authentication")
      return env // SDK will pick up from process.env
    }

    // Check for stored auth
    const auth = await import("@/auth").then((m) => m.Auth.get("anthropic"))

    if (auth?.type === "api" && auth.key) {
      log.info("using stored API key for authentication")
      env["ANTHROPIC_API_KEY"] = auth.key
      return env
    }

    if (auth?.type === "oauth" && auth.access) {
      // Check if token is expired
      if (auth.expires && auth.expires < Date.now()) {
        log.warn("OAuth token expired, will rely on Claude Code CLI auth")
      } else {
        log.info("using OAuth token via CLAUDE_CODE_OAUTH_TOKEN")
        env["CLAUDE_CODE_OAUTH_TOKEN"] = auth.access
        return env
      }
    }

    // No auth found - rely on Claude Code CLI's own authentication
    log.info("no auth found, relying on Claude Code CLI authentication")
    return env
  }
}
