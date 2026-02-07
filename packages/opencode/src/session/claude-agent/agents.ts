export namespace ClaudeAgentSubagents {
  /**
   * SDK agent definition type
   */
  export type SdkAgentDefinition = {
    description: string
    tools?: string[]
    prompt: string
    model?: "sonnet" | "opus" | "haiku" | "inherit"
  }

  /**
   * Build SDK agent definitions from OpenCode agents
   * Maps OpenCode subagents to the SDK's agents option format
   */
  export async function build(): Promise<Record<string, SdkAgentDefinition>> {
    const { Agent } = await import("@/agent/agent")
    const agents = await Agent.list()
    const sdkAgents: Record<string, SdkAgentDefinition> = {}

    for (const agent of agents) {
      // Skip hidden agents (compaction, title, summary)
      if (agent.hidden) continue
      // Skip primary agents (they run as the main agent, not subagents)
      if (agent.mode === "primary") continue

      sdkAgents[agent.name] = {
        description: agent.description || `${agent.name} agent`,
        prompt: agent.prompt || "",
        // Map model if specified
        model: agent.model?.modelID as "sonnet" | "opus" | "haiku" | undefined,
      }
    }

    return sdkAgents
  }
}
