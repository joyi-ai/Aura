import path from "path"
import os from "os"
import z from "zod"
import { Instance } from "@/project/instance"
import { Log } from "@/util/log"

/**
 * Configuration for Claude Code plugin hooks
 * Supports disabling specific hook commands via config files
 */
export namespace ClaudePluginConfig {
  const log = Log.create({ service: "claude-plugin.config" })

  // Config file locations (in order of precedence)
  const CONFIG_LOCATIONS = [
    // Project-level config
    () => path.join(Instance.directory, ".opencode", "claude-plugin.json"),
    // User-level config
    () => path.join(os.homedir(), ".config", "opencode", "claude-plugin.json"),
  ]

  // Schema for disabled hooks configuration
  export const DisabledHooksConfig = z.object({
    // Regex patterns for commands to disable
    disabledCommands: z.array(z.string()).optional(),
    // Disable hooks for specific events
    disabledEvents: z.array(z.string()).optional(),
    // Disable hooks from specific plugins
    disabledPlugins: z.array(z.string()).optional(),
  })

  export const Config = z.object({
    disabled: DisabledHooksConfig.optional(),
    // Force use of zsh for hook execution
    forceZsh: z.boolean().optional(),
    // Custom zsh path
    zshPath: z.string().optional(),
  })

  export type Config = z.infer<typeof Config>

  // Cached config
  let cachedConfig: Config | null = null
  let lastLoadTime = 0
  const CACHE_TTL = 5000 // 5 seconds

  /**
   * Load config from file locations
   */
  export async function load(): Promise<Config> {
    const now = Date.now()
    if (cachedConfig && now - lastLoadTime < CACHE_TTL) {
      return cachedConfig
    }

    for (const getPath of CONFIG_LOCATIONS) {
      try {
        const configPath = getPath()
        const file = Bun.file(configPath)
        if (await file.exists()) {
          const text = await file.text()
          const json = JSON.parse(text)
          const parsed = Config.safeParse(json)
          if (parsed.success) {
            cachedConfig = parsed.data
            lastLoadTime = now
            log.info("loaded config", { path: configPath })
            return cachedConfig
          } else {
            log.warn("invalid config file", { path: configPath, errors: parsed.error.issues })
          }
        }
      } catch (error) {
        // Config file doesn't exist or can't be read, continue to next location
      }
    }

    // Return empty config if no file found
    cachedConfig = {}
    lastLoadTime = now
    return cachedConfig
  }

  /**
   * Check if a hook command is disabled
   */
  export async function isCommandDisabled(command: string): Promise<boolean> {
    const config = await load()
    const patterns = config.disabled?.disabledCommands ?? []

    for (const pattern of patterns) {
      try {
        const regex = new RegExp(pattern)
        if (regex.test(command)) {
          log.info("command disabled by config", { command, pattern })
          return true
        }
      } catch {
        // Invalid regex, skip
        log.warn("invalid regex pattern in config", { pattern })
      }
    }

    return false
  }

  /**
   * Check if a hook event is disabled
   */
  export async function isEventDisabled(event: string): Promise<boolean> {
    const config = await load()
    const events = config.disabled?.disabledEvents ?? []
    return events.includes(event)
  }

  /**
   * Check if a plugin is disabled
   */
  export async function isPluginDisabled(pluginId: string): Promise<boolean> {
    const config = await load()
    const plugins = config.disabled?.disabledPlugins ?? []

    for (const pattern of plugins) {
      try {
        const regex = new RegExp(pattern)
        if (regex.test(pluginId)) {
          return true
        }
      } catch {
        // Plain string match
        if (pluginId === pattern || pluginId.startsWith(pattern + "@")) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Get shell configuration for hook execution
   */
  export async function getShellConfig(): Promise<{ forceZsh: boolean; zshPath?: string }> {
    const config = await load()
    return {
      forceZsh: config.forceZsh ?? false,
      zshPath: config.zshPath,
    }
  }

  /**
   * Clear cached config (for testing or config reload)
   */
  export function clearCache(): void {
    cachedConfig = null
    lastLoadTime = 0
  }
}
