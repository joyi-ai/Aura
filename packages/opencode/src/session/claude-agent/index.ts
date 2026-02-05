import { query } from "@anthropic-ai/claude-agent-sdk"
import { MessageV2 } from "../message-v2"
import { Session } from ".."
import { AskUserQuestion } from "../ask-user-question"
import { PlanMode } from "../plan-mode"
import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import { ClaudeAgent } from "@/provider/claude-agent"
import { Provider } from "@/provider/provider"
import { SessionStatus } from "../status"
import type { Agent } from "@/agent/agent"
import { Config } from "@/config/config"
import { McpSync } from "@/mcp/sync"

import { ClaudeAgentExecutable } from "./executable"
import { ClaudeAgentAuth } from "./auth"
import { ClaudeAgentPromptBuilder } from "./prompt-builder"
import { ClaudeAgentPermission } from "./permission"
import { ClaudeAgentMessageMapper } from "./message-mapper"
import { ClaudeAgentSubagents } from "./agents"
import { ClaudeAgentCommands } from "./commands"

export namespace ClaudeAgentProcessor {
  const log = Log.create({ service: "claude-agent-processor" })

  // Re-export types for external consumers
  export type ImageInput = ClaudeAgentPromptBuilder.ImageInput
  export type ClaudeSlashCommand = ClaudeAgentCommands.ClaudeSlashCommand

  export interface ProcessInput {
    sessionID: string
    assistantMessage: MessageV2.Assistant
    prompt: string
    images?: ImageInput[]
    agent: Agent.Info
    abort: AbortSignal
    modelID?: string
    providerID?: string
    /** Enable extended thinking with the specified token budget */
    maxThinkingTokens?: number
  }

  // Re-export for backward compatibility
  export const mapPermissionMode = ClaudeAgentPermission.mapPermissionMode
  export const supportedCommands = ClaudeAgentCommands.supportedCommands

  /**
   * Main processing function - streams from Claude Agent SDK and maps to OpenCode parts
   */
  export async function process(input: ProcessInput): Promise<{
    finish: string
    cost: number
    tokens: {
      input: number
      output: number
      reasoning: number
      cache: { read: number; write: number }
    }
  }> {
    log.info("starting claude agent process", {
      sessionID: input.sessionID,
      agent: input.agent.name,
      providerID: input.providerID,
      modelID: input.modelID,
    })

    // Get authentication environment variables
    let authEnv = await ClaudeAgentAuth.getAuthEnv()

    // Check if using OpenRouter - if so, configure for OpenRouter API
    const isOpenRouter = input.providerID === "openrouter"
    let openRouterModelOverride: string | undefined
    if (isOpenRouter) {
      const openRouterProvider = await Provider.getProvider("openrouter")
      if (!openRouterProvider?.key) {
        throw new MessageV2.AuthError({
          providerID: "openrouter",
          message: "OpenRouter API key not configured. Please add your OpenRouter API key in provider settings.",
        })
      }
      // Set OpenRouter env vars per their documentation
      authEnv = {
        ANTHROPIC_BASE_URL: "https://openrouter.ai/api",
        ANTHROPIC_AUTH_TOKEN: openRouterProvider.key,
        ANTHROPIC_API_KEY: "", // Must be explicitly empty to prevent conflicts
      }
      // The model ID from OpenRouter (e.g., "anthropic/claude-opus-4") will be used as the model override
      openRouterModelOverride = input.modelID
      log.info("using OpenRouter provider", { modelID: openRouterModelOverride })
    }

    SessionStatus.set(input.sessionID, { type: "busy" })

    const ctx: ProcessContext = {
      sessionID: input.sessionID,
      messageID: input.assistantMessage.id,
      toolParts: new Map(),
      streamingParts: new Map(),
    }

    // Check if we have an existing agent session to resume
    const existingAgentSessionID = await ClaudeAgent.getAgentSessionID(input.sessionID)

    const permissionMode = ClaudeAgentPermission.mapPermissionMode(input.agent)
    log.info("using permission mode", { mode: permissionMode })

    // Find Claude Code executable
    const claudeExecutable = await ClaudeAgentExecutable.find()
    if (!claudeExecutable) {
      throw new MessageV2.AuthError({
        providerID: "claude-agent",
        message:
          "Claude Code CLI not found. Please install it from https://claude.ai/code or via npm: npm install -g @anthropic-ai/claude-code",
      })
    }
    log.info("using claude code executable", { path: claudeExecutable })

    let result = {
      finish: "end_turn",
      cost: 0,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
    }

    try {
      const abortController = new AbortController()

      // Link to parent abort signal
      input.abort.addEventListener("abort", () => {
        abortController.abort()
      })

      // Create streaming prompt (always uses AsyncGenerator for full streaming input mode)
      const sdkSessionID = existingAgentSessionID ?? crypto.randomUUID()
      const prompt = ClaudeAgentPromptBuilder.createStreamingPrompt(input.prompt, input.images, sdkSessionID)

      // Build env vars - for OpenRouter, add model override
      const envVars: Record<string, string | undefined> = {
        ...globalThis.process.env,
        ...authEnv,
      }
      if (isOpenRouter && openRouterModelOverride) {
        // Override all model aliases to use the selected OpenRouter model
        envVars.ANTHROPIC_DEFAULT_SONNET_MODEL = openRouterModelOverride
        envVars.ANTHROPIC_DEFAULT_OPUS_MODEL = openRouterModelOverride
        envVars.ANTHROPIC_DEFAULT_HAIKU_MODEL = openRouterModelOverride
      }

      const mcpServers = await Config.get()
        .then((cfg) => McpSync.toExternalServers(cfg.mcp))
        .catch(() => ({}))
      const hasMcp = Object.keys(mcpServers).length > 0
      const allowedTools = hasMcp
        ? undefined
        : [
            "Read",
            "Write",
            "Edit",
            "Bash",
            "Glob",
            "Grep",
            "WebSearch",
            "WebFetch",
            "Task",
            "TodoWrite",
            "AskUserQuestion",
            "ExitPlanMode",
            "Skill",
          ]

      // Build SDK agent definitions from OpenCode agents
      const sdkAgents = await ClaudeAgentSubagents.build()

      const generator = query({
        prompt,
        options: {
          abortController,
          resume: existingAgentSessionID,
          cwd: Instance.directory,
          permissionMode,
          pathToClaudeCodeExecutable: claudeExecutable,
          // Pass the selected model - for OpenRouter, use "sonnet" since we override via env
          model: isOpenRouter ? "sonnet" : (input.modelID as "opus" | "sonnet" | "haiku" | "default" | undefined),
          // Enable extended thinking if specified
          maxThinkingTokens: input.maxThinkingTokens,
          // Handle AskUserQuestion tool specially
          canUseTool: ClaudeAgentPermission.createCanUseTool(ctx),
          // Pass auth environment variables (OAuth token or API key, or OpenRouter config)
          env: envVars,
          mcpServers: hasMcp ? mcpServers : undefined,
          allowedTools,

          // Real-time streaming events (enables SDKPartialAssistantMessage)
          includePartialMessages: true,

          // System prompt configuration
          systemPrompt: {
            type: "preset",
            preset: "claude_code",
            append: "",
          },

          // Load all settings: user, project, local
          settingSources: ["user", "project", "local"],

          // Subagent definitions from OpenCode agent system
          agents: sdkAgents,
        },
      })

      for await (const msg of generator) {
        input.abort.throwIfAborted()
        await ClaudeAgentMessageMapper.processMessage(msg, ctx)

        // Extract usage from result message
        if (msg.type === "result") {
          result.cost = msg.total_cost_usd ?? 0
          if (msg.usage) {
            result.tokens = {
              input: msg.usage.input_tokens ?? 0,
              output: msg.usage.output_tokens ?? 0,
              reasoning: 0,
              cache: {
                read: msg.usage.cache_read_input_tokens ?? 0,
                write: msg.usage.cache_creation_input_tokens ?? 0,
              },
            }
          }
          if (msg.subtype === "success") {
            result.finish = "end_turn"
          } else {
            result.finish = msg.subtype
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : ""
      const isAbortMessage = message.includes("process aborted") || message.includes("aborted by user")
      if (error instanceof Error && error.name === "AbortError") {
        log.info("claude agent aborted")
        result.finish = "aborted"
        return result
      }
      if (input.abort.aborted || isAbortMessage) {
        log.info("claude agent aborted")
        result.finish = "aborted"
        return result
      }
      log.error("claude agent error", { error })
      throw error
    } finally {
      // Cancel any pending AskUserQuestion and PlanMode requests for this session
      AskUserQuestion.cancelSession(input.sessionID)
      PlanMode.cancelSession(input.sessionID)
      SessionStatus.set(input.sessionID, { type: "idle" })
    }

    return result
  }
}

/**
 * Shared context passed between message mapper and permission handler
 */
export interface ProcessContext {
  sessionID: string
  messageID: string
  toolParts: Map<string, MessageV2.ToolPart>
  agentSessionID?: string
  /** Path to the plan file for this session (tracked when agent writes to ~/.claude/plans/) */
  planFilePath?: string
  /** Streaming text parts by content block index (for real-time token streaming) */
  streamingParts: Map<number, { partId: string; text: string; type: "text" | "reasoning" }>
  /** Whether streaming events were received for the current message */
  hadStreaming?: boolean
  /** Whether streaming was ever active during this query (for result dedup) */
  hadAnyStreaming?: boolean
}
