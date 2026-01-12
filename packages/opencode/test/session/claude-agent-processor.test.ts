import { describe, expect, test } from "bun:test"
import { ClaudeAgentProcessor } from "../../src/session/claude-agent-processor"
import { Agent } from "../../src/agent/agent"

describe("ClaudeAgentProcessor.mapPermissionMode", () => {
  test("maps OpenCode plan agent to Claude SDK plan mode", () => {
    const agent = Agent.Info.parse({
      name: "plan",
      mode: "primary",
      permission: [{ permission: "*", pattern: "*", action: "allow" }],
      options: {},
    })
    expect(ClaudeAgentProcessor.mapPermissionMode(agent)).toBe("plan")
  })

  test("defaults to bypassPermissions when wildcard allow is present (non-plan agent)", () => {
    const agent = Agent.Info.parse({
      name: "build",
      mode: "primary",
      permission: [{ permission: "*", pattern: "*", action: "allow" }],
      options: {},
    })
    expect(ClaudeAgentProcessor.mapPermissionMode(agent)).toBe("bypassPermissions")
  })

  test("returns acceptEdits when edit is allowed (without wildcard allow)", () => {
    const agent = Agent.Info.parse({
      name: "custom",
      mode: "primary",
      permission: [{ permission: "edit", pattern: "*", action: "allow" }],
      options: {},
    })
    expect(ClaudeAgentProcessor.mapPermissionMode(agent)).toBe("acceptEdits")
  })
})

