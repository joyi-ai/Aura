import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import type { ProcessContext } from "./index"
import { MessageV2 } from "../message-v2"
import { Session } from ".."
import { Identifier } from "@/id/id"
import { Log } from "@/util/log"
import { ClaudeAgent } from "@/provider/claude-agent"
import { ClaudePluginTransform } from "@/claude-plugin/transform"
import { Todo } from "../todo"

export namespace ClaudeAgentMessageMapper {
  const log = Log.create({ service: "claude-agent-message-mapper" })

  // Type helpers to avoid strict `as` narrowing errors with tsgo
  type AnyMsg = Record<string, unknown>

  /**
   * Process a streaming message from Claude Agent SDK
   * Handles all 16 SDK message types in the SDKMessage union
   */
  export async function processMessage(msg: SDKMessage, ctx: ProcessContext): Promise<void> {
    // Use string type to handle all SDK message types (tsgo is strict about discriminated union narrowing)
    const msgType = (msg as AnyMsg).type as string
    switch (msgType) {
      case "system":
        await handleSystemMessage(msg as AnyMsg, ctx)
        break

      case "assistant":
        await handleAssistantMessage(msg as AnyMsg, ctx)
        break

      case "user":
        await handleUserMessage(msg as AnyMsg, ctx)
        break

      case "result":
        await handleResultMessage(msg as AnyMsg, ctx)
        break

      case "stream_event":
        await handleStreamEvent(msg as AnyMsg, ctx)
        break

      case "tool_progress":
        await handleToolProgress(msg as AnyMsg, ctx)
        break

      case "tool_use_summary":
        await handleToolUseSummary(msg as AnyMsg, ctx)
        break

      case "auth_status":
        handleAuthStatus(msg as AnyMsg)
        break
    }
  }

  /**
   * Handle system messages: init, status, compact_boundary, hooks, task_notification, files_persisted
   */
  async function handleSystemMessage(msg: AnyMsg, ctx: ProcessContext): Promise<void> {
    const subtype = msg.subtype as string | undefined
    switch (subtype) {
      case "init": {
        const sessionId = msg.session_id as string
        ctx.agentSessionID = sessionId
        await ClaudeAgent.setAgentSessionID(ctx.sessionID, sessionId)
        log.info("captured agent session ID", { agentSessionID: sessionId })
        break
      }

      case "status": {
        const status = msg.status as string | null
        if (status === "compacting") {
          log.info("agent is compacting context")
          const part: MessageV2.TextPart = {
            id: Identifier.ascending("part"),
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            type: "text",
            text: "Compacting conversation context...",
            synthetic: true,
            metadata: { sdkStatus: "compacting" },
            time: { start: Date.now() },
          }
          await Session.updatePart(part)
        }
        break
      }

      case "compact_boundary": {
        const metadata = msg.compact_metadata as { trigger: string; pre_tokens: number }
        log.info("compact boundary", {
          trigger: metadata.trigger,
          preTokens: metadata.pre_tokens,
        })
        const part: MessageV2.CompactionPart = {
          id: Identifier.ascending("part"),
          sessionID: ctx.sessionID,
          messageID: ctx.messageID,
          type: "compaction",
          auto: metadata.trigger === "auto",
        }
        await Session.updatePart(part)
        break
      }

      case "task_notification": {
        const taskId = msg.task_id as string
        const status = msg.status as string
        const summary = msg.summary as string
        log.info("task notification", { taskId, status })
        if (summary) {
          const part: MessageV2.TextPart = {
            id: Identifier.ascending("part"),
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            type: "text",
            text: summary,
            synthetic: true,
            metadata: { sdkTaskNotification: true, taskId, taskStatus: status },
            time: { start: Date.now() },
          }
          await Session.updatePart(part)
        }
        break
      }

      case "hook_started": {
        const hookId = msg.hook_id as string
        const hookName = msg.hook_name as string
        const hookEvent = msg.hook_event as string
        log.info("hook started", { hookId, hookName, hookEvent })
        break
      }

      case "hook_progress": {
        const hookId = msg.hook_id as string
        const hookName = msg.hook_name as string
        log.info("hook progress", { hookId, hookName })
        break
      }

      case "hook_response": {
        const hookId = msg.hook_id as string
        const hookName = msg.hook_name as string
        const outcome = msg.outcome as string
        if (outcome === "error") {
          log.warn("hook error", { hookId, hookName })
        } else {
          log.info("hook response", { hookId, hookName, outcome })
        }
        break
      }

      case "files_persisted": {
        const files = msg.files as Array<{ filename: string }> | undefined
        const failed = msg.failed as Array<{ filename: string }> | undefined
        log.info("files persisted", { count: files?.length ?? 0, failedCount: failed?.length ?? 0 })
        if (failed && failed.length > 0) {
          log.warn("some files failed to persist", { failed: failed.map((f) => f.filename) })
        }
        break
      }
    }
  }

  /**
   * Handle assistant messages: text, thinking, tool_use content blocks
   * Text/thinking are only processed as a fallback when streaming was unavailable
   */
  async function handleAssistantMessage(msg: AnyMsg, ctx: ProcessContext): Promise<void> {
    // Check for error field on assistant messages
    const error = msg.error as string | undefined
    if (error) {
      log.error("assistant message error", { error })
      switch (error) {
        case "authentication_failed":
          throw new MessageV2.AuthError({
            providerID: "claude-agent",
            message: "Claude Code authentication failed. Please check your API key or re-authenticate.",
          })
        case "billing_error":
          throw new MessageV2.APIError({
            statusCode: 402,
            isRetryable: false,
            message: "Billing error. Please check your Anthropic account billing status.",
          })
        case "rate_limit":
          throw new MessageV2.APIError({
            statusCode: 429,
            isRetryable: true,
            message: "Rate limited by Anthropic API. Will retry automatically.",
          })
        case "invalid_request":
          throw new MessageV2.APIError({
            statusCode: 400,
            isRetryable: false,
            message: "Invalid request to Claude Code API.",
          })
        case "server_error":
          throw new MessageV2.APIError({
            statusCode: 500,
            isRetryable: true,
            message: "Anthropic server error. Will retry automatically.",
          })
        default:
          log.warn("unknown assistant error type", { error })
      }
    }

    const message = msg.message as { content?: unknown[] } | undefined
    if (!message?.content) return
    for (const block of message.content) {
      // Skip non-object blocks
      if (typeof block !== "object" || block === null) continue
      const b = block as AnyMsg
      if ("text" in b && b.text) {
        // Text block - only process if streaming was not active
        if (!ctx.hadStreaming) {
          const textPart: MessageV2.TextPart = {
            id: Identifier.ascending("part"),
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            type: "text",
            text: b.text as string,
            time: { start: Date.now() },
          }
          await Session.updatePart(textPart)
        }
      } else if ("thinking" in b && b.thinking) {
        // Reasoning/thinking block - only process if streaming was not active
        if (!ctx.hadStreaming) {
          const reasoningPart: MessageV2.ReasoningPart = {
            id: Identifier.ascending("part"),
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            type: "reasoning",
            text: b.thinking as string,
            time: { start: Date.now(), end: Date.now() },
          }
          await Session.updatePart(reasoningPart)
        }
      } else if ("type" in b && b.type === "tool_use") {
        // Tool use start - create a running tool part
        const toolId = b.id as string
        const toolName = (b.name as string).toLowerCase()
        const rawInput = b.input as Record<string, unknown>
        const baseInput = ClaudePluginTransform.objectToCamelCase(rawInput) as Record<string, unknown>
        const toolInput = (() => {
          if (toolName !== "bash") return baseInput
          if (typeof baseInput.description === "string" && baseInput.description.trim()) return baseInput
          if (typeof baseInput.command !== "string" || !baseInput.command) return baseInput
          return {
            ...baseInput,
            description: baseInput.command,
          }
        })()
        const toolPart: MessageV2.ToolPart = {
          id: Identifier.ascending("part"),
          sessionID: ctx.sessionID,
          messageID: ctx.messageID,
          type: "tool",
          callID: toolId,
          tool: toolName,
          state: {
            status: "running",
            input: toolInput,
            time: {
              start: Date.now(),
            },
          },
        }
        ctx.toolParts.set(toolId, toolPart)
        await Session.updatePart(toolPart)

        // Handle TodoWrite - update the todo store so the footer can display it
        if (toolName === "todowrite" && Array.isArray(rawInput.todos)) {
          const todos = rawInput.todos.map((t: { content?: string; status?: string }, i: number) => ({
            id: `todo-${i}`,
            content: t.content ?? "",
            status: t.status ?? "pending",
            priority: "medium",
          }))
          await Todo.update({ sessionID: ctx.sessionID, todos })
        }
      }
    }
    ctx.hadStreaming = false
  }

  /**
   * Handle user messages: tool results and local command outputs
   * Skips replayed messages (session resume)
   */
  async function handleUserMessage(msg: AnyMsg, ctx: ProcessContext): Promise<void> {
    // Skip replayed messages during session resume
    if (msg.isReplay) return

    const message = msg.message as { content?: unknown } | undefined
    if (!message?.content) return

    // Handle string content with local command output tags
    if (typeof message.content === "string") {
      const content = message.content
      // Check for local command output wrapped in <local-command-stdout> tags
      const localCommandMatch = content.match(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/)
      if (localCommandMatch) {
        const commandOutput = localCommandMatch[1].trim()
        if (commandOutput) {
          const textPart: MessageV2.TextPart = {
            id: Identifier.ascending("part"),
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            type: "text",
            text: commandOutput,
            time: { start: Date.now() },
          }
          await Session.updatePart(textPart)
        }
      }
      return
    }

    // Handle array content (tool results)
    if (!Array.isArray(message.content)) return
    for (const block of message.content as unknown[]) {
      // Skip non-object blocks
      if (typeof block !== "object" || block === null) continue
      const b = block as AnyMsg
      if ("type" in b && b.type === "tool_result") {
        const toolUseId = b.tool_use_id as string
        const content = b.content as string | Array<{ type: string; text?: string }> | undefined
        const isError = b.is_error as boolean | undefined
        const existingPart = ctx.toolParts.get(toolUseId)
        if (!existingPart) continue

        // Extract content from result
        let output = ""
        if (typeof content === "string") {
          output = content
        } else if (Array.isArray(content)) {
          output = content
            .map((c) => ("text" in c ? c.text : ""))
            .filter(Boolean)
            .join("\n")
        }

        const runningState = existingPart.state as MessageV2.ToolStateRunning

        if (isError) {
          // Tool error
          const errorPart: MessageV2.ToolPart = {
            ...existingPart,
            state: {
              status: "error",
              input: runningState.input,
              error: output || "Tool execution failed",
              time: {
                start: runningState.time.start,
                end: Date.now(),
              },
            },
          }
          await Session.updatePart(errorPart)
        } else {
          // Tool completed successfully
          const completedPart: MessageV2.ToolPart = {
            ...existingPart,
            state: {
              status: "completed",
              input: runningState.input,
              output: output,
              title: existingPart.tool,
              metadata: {},
              time: {
                start: runningState.time.start,
                end: Date.now(),
              },
            },
          }
          await Session.updatePart(completedPart)
        }
      }
    }
  }

  /**
   * Handle result messages: completion info, cost, tokens, errors
   */
  async function handleResultMessage(msg: AnyMsg, ctx: ProcessContext): Promise<void> {
    const subtype = msg.subtype as string
    const totalCost = msg.total_cost_usd as number | undefined
    const numTurns = msg.num_turns as number | undefined
    const durationMs = msg.duration_ms as number | undefined
    const durationApiMs = msg.duration_api_ms as number | undefined
    const resultText = msg.result as string | undefined
    const errors = msg.errors as string[] | undefined
    const permissionDenials = msg.permission_denials as Array<AnyMsg> | undefined
    const modelUsage = msg.modelUsage as Record<string, unknown> | undefined

    // Log completion info including duration
    log.info("agent completed", {
      subtype,
      cost: totalCost,
      turns: numTurns,
      durationMs,
      durationApiMs,
    })

    // Log errors if present (error result subtypes)
    if (errors?.length) {
      for (const error of errors) {
        log.warn("agent error", { error })
      }
    }

    // Log permission denials
    if (permissionDenials?.length) {
      for (const denial of permissionDenials) {
        log.warn("permission denied", { tool: denial.tool_name, message: denial.message })
      }
    }

    // Log per-model usage
    if (modelUsage && Object.keys(modelUsage).length > 0) {
      log.info("model usage breakdown", { modelUsage })
    }

    // For slash commands and other direct results, the output is in msg.result
    // Only process if there's result text and streaming didn't already capture it
    if (resultText && resultText.trim() && !ctx.hadAnyStreaming) {
      const textPart: MessageV2.TextPart = {
        id: Identifier.ascending("part"),
        sessionID: ctx.sessionID,
        messageID: ctx.messageID,
        type: "text",
        text: resultText,
        time: { start: Date.now() },
      }
      await Session.updatePart(textPart)
    }
  }

  /**
   * Handle real-time streaming events for immediate display
   */
  async function handleStreamEvent(msg: AnyMsg, ctx: ProcessContext): Promise<void> {
    const event = msg.event as AnyMsg | undefined
    if (!event) return

    const eventType = event.type as string

    if (eventType === "content_block_start") {
      // Start a new content block - create streaming part
      const index = event.index as number
      const block = event.content_block as { type: string }

      if (block.type === "text") {
        ctx.hadStreaming = true
        ctx.hadAnyStreaming = true
        const partId = Identifier.ascending("part")
        ctx.streamingParts.set(index, { partId, text: "", type: "text" })
        const textPart: MessageV2.TextPart = {
          id: partId,
          sessionID: ctx.sessionID,
          messageID: ctx.messageID,
          type: "text",
          text: "",
          time: { start: Date.now() },
        }
        await Session.updatePart(textPart)
      } else if (block.type === "thinking") {
        ctx.hadStreaming = true
        ctx.hadAnyStreaming = true
        const partId = Identifier.ascending("part")
        ctx.streamingParts.set(index, { partId, text: "", type: "reasoning" })
        const reasoningPart: MessageV2.ReasoningPart = {
          id: partId,
          sessionID: ctx.sessionID,
          messageID: ctx.messageID,
          type: "reasoning",
          text: "",
          time: { start: Date.now() },
        }
        await Session.updatePart(reasoningPart)
      }
    } else if (eventType === "content_block_delta") {
      // Append delta to existing streaming part
      const index = event.index as number
      const delta = event.delta as { type: string; text?: string; thinking?: string }
      const streaming = ctx.streamingParts.get(index)

      if (streaming) {
        if (delta.type === "text_delta" && streaming.type === "text") {
          streaming.text += delta.text ?? ""
          const textPart: MessageV2.TextPart = {
            id: streaming.partId,
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            type: "text",
            text: streaming.text,
            time: { start: Date.now() },
          }
          await Session.updatePart(textPart)
        } else if (delta.type === "thinking_delta" && streaming.type === "reasoning") {
          streaming.text += delta.thinking ?? ""
          const reasoningPart: MessageV2.ReasoningPart = {
            id: streaming.partId,
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            type: "reasoning",
            text: streaming.text,
            time: { start: Date.now() },
          }
          await Session.updatePart(reasoningPart)
        }
      }
    } else if (eventType === "content_block_stop") {
      // Content block finished - finalize the part
      const index = event.index as number
      const streaming = ctx.streamingParts.get(index)

      if (streaming) {
        if (streaming.type === "text") {
          const textPart: MessageV2.TextPart = {
            id: streaming.partId,
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            type: "text",
            text: streaming.text,
            time: { start: Date.now() },
          }
          await Session.updatePart(textPart)
        } else if (streaming.type === "reasoning") {
          const reasoningPart: MessageV2.ReasoningPart = {
            id: streaming.partId,
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            type: "reasoning",
            text: streaming.text,
            time: { start: Date.now(), end: Date.now() },
          }
          await Session.updatePart(reasoningPart)
        }
        // Keep the part in the map so we can skip it in assistant message
      }
    } else if (eventType === "message_stop") {
      // Message complete - clear streaming parts for next message
      ctx.streamingParts.clear()
    }
  }

  /**
   * Handle tool progress updates - enrich running tool parts with elapsed time
   */
  async function handleToolProgress(msg: AnyMsg, ctx: ProcessContext): Promise<void> {
    const toolUseId = msg.tool_use_id as string
    const elapsed = msg.elapsed_time_seconds as number
    const existingPart = ctx.toolParts.get(toolUseId)
    if (!existingPart) return
    if (existingPart.state.status !== "running") return

    const runningState = existingPart.state as MessageV2.ToolStateRunning
    const updatedPart: MessageV2.ToolPart = {
      ...existingPart,
      state: {
        ...runningState,
        input: {
          ...runningState.input,
          _elapsed: elapsed,
        },
      },
    }
    await Session.updatePart(updatedPart)
  }

  /**
   * Handle tool use summary messages
   */
  async function handleToolUseSummary(msg: AnyMsg, ctx: ProcessContext): Promise<void> {
    const summary = msg.summary as string
    const toolUseIds = msg.preceding_tool_use_ids as string[]
    if (!summary) return

    log.info("tool use summary", { toolUseIds })
    const part: MessageV2.TextPart = {
      id: Identifier.ascending("part"),
      sessionID: ctx.sessionID,
      messageID: ctx.messageID,
      type: "text",
      text: summary,
      synthetic: true,
      metadata: { sdkToolSummary: true, toolUseIds },
      time: { start: Date.now() },
    }
    await Session.updatePart(part)
  }

  /**
   * Handle auth status messages (log only)
   */
  function handleAuthStatus(msg: AnyMsg): void {
    const isAuthenticating = msg.isAuthenticating as boolean
    const error = msg.error as string | undefined
    if (error) {
      log.warn("auth status error", { error })
    } else {
      log.info("auth status", { isAuthenticating })
    }
  }
}
