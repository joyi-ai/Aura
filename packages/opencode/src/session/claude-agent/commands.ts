import { query } from "@anthropic-ai/claude-agent-sdk"
import { Instance } from "@/project/instance"
import { Log } from "@/util/log"
import { ClaudeAgentExecutable } from "./executable"
import { ClaudeAgentAuth } from "./auth"

export namespace ClaudeAgentCommands {
  const log = Log.create({ service: "claude-agent-commands" })

  export type ClaudeSlashCommand = {
    name: string
    description?: string
    argumentHint?: string
  }

  export async function supportedCommands(): Promise<ClaudeSlashCommand[]> {
    const empty: ClaudeSlashCommand[] = []
    const claudeExecutable = await ClaudeAgentExecutable.find()
    if (!claudeExecutable) {
      log.warn("claude code executable not found while listing slash commands")
      return empty
    }

    const authEnv = await ClaudeAgentAuth.getAuthEnv()
    const envVars: Record<string, string | undefined> = {
      ...globalThis.process.env,
      ...authEnv,
    }

    const generator = await Promise.resolve()
      .then(() =>
        query({
          prompt: "",
          options: {
            cwd: Instance.directory,
            pathToClaudeCodeExecutable: claudeExecutable,
            env: envVars,
            systemPrompt: {
              type: "preset",
              preset: "claude_code",
            },
            settingSources: ["user", "project", "local"],
          },
        }),
      )
      .catch((error) => {
        log.warn("failed to initialize claude code query for slash commands", { error })
        return undefined
      })

    if (!generator) return empty

    const commands = await generator.supportedCommands().catch((error) => {
      log.warn("failed to load claude code slash commands", { error })
      return empty
    })

    await generator.interrupt().catch(() => {})

    return commands
  }
}
