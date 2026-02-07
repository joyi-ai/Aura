import type { PermissionMode, CanUseTool, PermissionResult } from "@anthropic-ai/claude-agent-sdk"
import type { Agent } from "@/agent/agent"
import type { ProcessContext } from "./index"
import { AskUserQuestion } from "../ask-user-question"
import { PlanMode } from "../plan-mode"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Log } from "@/util/log"
import { Todo } from "../todo"
import path from "path"
import os from "os"

export namespace ClaudeAgentPermission {
  const log = Log.create({ service: "claude-agent-permission" })

  /**
   * Map OpenCode permission rules to Claude Agent SDK permission mode
   */
  export function mapPermissionMode(agent: Agent.Info): PermissionMode {
    // If the user selected OpenCode's `plan` agent while running through Claude Code,
    // use Claude Agent SDK's planning-only mode (no execution).
    if (agent.name === "plan") return "plan"

    const permission = agent.permission
    if (!permission || permission.length === 0) return "default"

    // Check if all tools are allowed
    const hasAllowAll = permission.some((r) => r.permission === "*" && r.pattern === "*" && r.action === "allow")
    if (hasAllowAll) return "bypassPermissions"

    // Check if edits are auto-approved
    const editRule = permission.find((r) => r.permission === "edit")
    if (editRule?.action === "allow") return "acceptEdits"

    return "default"
  }

  /**
   * Create a canUseTool callback that handles AskUserQuestion specially
   */
  export function createCanUseTool(ctx: ProcessContext): CanUseTool {
    // Capture directory while in Instance context. The SDK calls this callback
    // from its transport's async context where AsyncLocalStorage may be lost,
    // which causes Bus.publish (via Instance.directory) to silently fail and
    // prevents AskUserQuestion/ExitPlanMode events from reaching the frontend.
    const directory = Instance.directory

    return async (toolName, input, options): Promise<PermissionResult> => {
      return Instance.provide({
        directory,
        fn: async () => {
      // Handle AskUserQuestion specially - wait for user response
      if (toolName === "AskUserQuestion") {
        const askInput = input as {
          questions: Array<{
            question: string
            header: string
            options: Array<{ label: string; description: string }>
            multiSelect: boolean
          }>
        }

        log.info("intercepting AskUserQuestion tool", {
          sessionID: ctx.sessionID,
          questionCount: askInput.questions?.length,
        })

        try {
          // Wait for user to answer the questions
          const answers = await AskUserQuestion.ask({
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            callID: options.toolUseID ?? Identifier.ascending("tool"),
            questions: askInput.questions,
          })

          // Return the answers in the updated input
          return {
            behavior: "allow",
            updatedInput: {
              ...input,
              answers,
            },
          }
        } catch (e) {
          log.error("AskUserQuestion failed", { error: e })
          return {
            behavior: "deny",
            message: e instanceof Error ? e.message : "Failed to get user response",
          }
        }
      }

      // Track plan file writes - when agent writes/edits ~/.claude/plans/, remember the path
      if (toolName === "Write" || toolName === "Edit") {
        const writeInput = input as { file_path?: string; filePath?: string }
        const filePath = writeInput.file_path ?? writeInput.filePath
        if (filePath) {
          const plansDir = path.join(os.homedir(), ".claude", "plans")
          const normalizedPath = path.normalize(filePath)
          const normalizedPlansDir = path.normalize(plansDir)
          if (normalizedPath.startsWith(normalizedPlansDir)) {
            ctx.planFilePath = filePath
            log.info("tracked plan file write", { path: filePath, sessionID: ctx.sessionID, tool: toolName })
          }
        }
      }

      // Handle ExitPlanMode - wait for user to approve/reject the plan
      if (toolName === "ExitPlanMode") {
        const planInput = input as { plan?: string }

        // Try to read plan content from the plan file if not provided in input
        let planContent = planInput.plan ?? ""
        if (!planContent) {
          try {
            // First, try to use the tracked plan file path from this session
            if (ctx.planFilePath) {
              const file = Bun.file(ctx.planFilePath)
              if (await file.exists()) {
                planContent = await file.text()
                log.info("read plan content from tracked file", { path: ctx.planFilePath, length: planContent.length })
              }
            }

            // Fallback: Look for the most recent plan file in ~/.claude/plans/
            if (!planContent) {
              const plansDir = path.join(os.homedir(), ".claude", "plans")
              const glob = new Bun.Glob("*.md")
              const planFiles: { path: string; mtime: number }[] = []
              for await (const file of glob.scan({ cwd: plansDir, absolute: true })) {
                const stat = await Bun.file(file).stat()
                if (stat) {
                  planFiles.push({ path: file, mtime: stat.mtime.getTime() })
                }
              }
              // Sort by modification time, newest first
              planFiles.sort((a, b) => b.mtime - a.mtime)
              if (planFiles.length > 0) {
                const newestPlan = planFiles[0]
                // Only read if modified within the last hour (likely current session's plan)
                const oneHourAgo = Date.now() - 60 * 60 * 1000
                if (newestPlan.mtime > oneHourAgo) {
                  planContent = await Bun.file(newestPlan.path).text()
                  log.info("read plan content from most recent file (fallback)", {
                    path: newestPlan.path,
                    length: planContent.length,
                  })
                }
              }
            }
          } catch (e) {
            log.warn("failed to read plan file", { error: e })
          }
        }

        log.info("intercepting ExitPlanMode tool", {
          sessionID: ctx.sessionID,
          planLength: planContent.length,
        })

        try {
          const approved = await PlanMode.review({
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            callID: options.toolUseID ?? Identifier.ascending("tool"),
            plan: planContent,
          })

          return {
            behavior: "allow",
            updatedInput: {
              ...input,
              approved,
            },
          }
        } catch (e) {
          log.error("ExitPlanMode failed", { error: e })
          return {
            behavior: "deny",
            message: e instanceof Error ? e.message : "Failed to get plan approval",
          }
        }
      }

      // Handle TodoWrite - update the todo store so the footer can display it
      if (toolName === "TodoWrite") {
        const todoInput = input as { todos?: Array<{ content?: string; status?: string }> }
        if (Array.isArray(todoInput.todos)) {
          const todos = todoInput.todos.map((t, i) => ({
            id: `todo-${i}`,
            content: t.content ?? "",
            status: t.status ?? "pending",
            priority: "medium",
          }))
          await Todo.update({ sessionID: ctx.sessionID, todos })
        }
      }

      // For all other tools, allow them (permission mode handles the rest)
      return {
        behavior: "allow",
        updatedInput: input,
      }
        },
      })
    }
  }
}
