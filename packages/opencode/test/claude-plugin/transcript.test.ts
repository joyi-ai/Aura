import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import path from "path"
import * as fs from "fs/promises"
import { ClaudePluginTranscript } from "../../src/claude-plugin/transcript"
import { Global } from "../../src/global"

describe("claude-plugin.transcript", () => {
  const testSessionID = "test-session-" + Math.random().toString(36).slice(2)
  const transcriptDir = path.join(Global.Path.home, ".claude", "transcripts")

  beforeAll(async () => {
    // Ensure transcript directory exists for tests
    await fs.mkdir(transcriptDir, { recursive: true })
  })

  afterAll(async () => {
    // Clean up test transcript file
    const filepath = ClaudePluginTranscript.getPath(testSessionID)
    await fs.rm(filepath, { force: true }).catch(() => {})
    ClaudePluginTranscript.clearCache(testSessionID)
  })

  describe("getPath", () => {
    test("should return consistent path for same session", () => {
      const path1 = ClaudePluginTranscript.getPath("session-123")
      const path2 = ClaudePluginTranscript.getPath("session-123")
      expect(path1).toBe(path2)
      ClaudePluginTranscript.clearCache("session-123")
    })

    test("should return different paths for different sessions", () => {
      const path1 = ClaudePluginTranscript.getPath("session-a")
      const path2 = ClaudePluginTranscript.getPath("session-b")
      expect(path1).not.toBe(path2)
      ClaudePluginTranscript.clearCache("session-a")
      ClaudePluginTranscript.clearCache("session-b")
    })

    test("should include sessionID in filename", () => {
      const sessionID = "my-session-id"
      const filepath = ClaudePluginTranscript.getPath(sessionID)
      expect(filepath).toContain(sessionID)
      expect(filepath).toEndWith(".jsonl")
      ClaudePluginTranscript.clearCache(sessionID)
    })
  })

  describe("recordToolUse", () => {
    test("should record tool use entry", async () => {
      await ClaudePluginTranscript.recordToolUse({
        sessionID: testSessionID,
        toolName: "Bash",
        toolInput: { command: "ls -la" },
        toolUseId: "tool-use-123",
      })

      const filepath = ClaudePluginTranscript.getPath(testSessionID)
      const content = await Bun.file(filepath).text()
      const lines = content.trim().split("\n")
      const entry = JSON.parse(lines[lines.length - 1])

      expect(entry.type).toBe("tool_use")
      expect(entry.tool_name).toBe("Bash")
      expect(entry.tool_input).toEqual({ command: "ls -la" })
      expect(entry.tool_use_id).toBe("tool-use-123")
      expect(entry.timestamp).toBeDefined()
    })
  })

  describe("recordToolResult", () => {
    test("should record tool result entry", async () => {
      await ClaudePluginTranscript.recordToolResult({
        sessionID: testSessionID,
        toolName: "Bash",
        toolOutput: { output: "file1.txt\nfile2.txt" },
        toolUseId: "tool-use-123",
      })

      const filepath = ClaudePluginTranscript.getPath(testSessionID)
      const content = await Bun.file(filepath).text()
      const lines = content.trim().split("\n")
      const entry = JSON.parse(lines[lines.length - 1])

      expect(entry.type).toBe("tool_result")
      expect(entry.tool_name).toBe("Bash")
      expect(entry.tool_output).toEqual({ output: "file1.txt\nfile2.txt" })
      expect(entry.tool_use_id).toBe("tool-use-123")
      expect(entry.error).toBeUndefined()
    })

    test("should record tool result with error", async () => {
      await ClaudePluginTranscript.recordToolResult({
        sessionID: testSessionID,
        toolName: "Bash",
        toolOutput: {},
        toolUseId: "tool-use-456",
        error: "Command not found",
      })

      const filepath = ClaudePluginTranscript.getPath(testSessionID)
      const content = await Bun.file(filepath).text()
      const lines = content.trim().split("\n")
      const entry = JSON.parse(lines[lines.length - 1])

      expect(entry.type).toBe("tool_result")
      expect(entry.error).toBe("Command not found")
    })
  })

  describe("recordUserMessage", () => {
    test("should record user message entry", async () => {
      await ClaudePluginTranscript.recordUserMessage({
        sessionID: testSessionID,
        content: "Hello, please help me with my code",
      })

      const filepath = ClaudePluginTranscript.getPath(testSessionID)
      const content = await Bun.file(filepath).text()
      const lines = content.trim().split("\n")
      const entry = JSON.parse(lines[lines.length - 1])

      expect(entry.type).toBe("user")
      expect(entry.content).toBe("Hello, please help me with my code")
      expect(entry.timestamp).toBeDefined()
    })
  })

  describe("recordAssistantMessage", () => {
    test("should record assistant message entry", async () => {
      await ClaudePluginTranscript.recordAssistantMessage({
        sessionID: testSessionID,
        content: "Sure, I can help you with that",
      })

      const filepath = ClaudePluginTranscript.getPath(testSessionID)
      const content = await Bun.file(filepath).text()
      const lines = content.trim().split("\n")
      const entry = JSON.parse(lines[lines.length - 1])

      expect(entry.type).toBe("assistant")
      expect(entry.content).toBe("Sure, I can help you with that")
      expect(entry.timestamp).toBeDefined()
    })
  })

  describe("clearCache", () => {
    test("should clear cached path for session", () => {
      const sessionID = "cached-session"
      const path1 = ClaudePluginTranscript.getPath(sessionID)
      ClaudePluginTranscript.clearCache(sessionID)
      const path2 = ClaudePluginTranscript.getPath(sessionID)
      // Paths should be the same value but cache was cleared
      expect(path1).toBe(path2)
      ClaudePluginTranscript.clearCache(sessionID)
    })
  })
})
