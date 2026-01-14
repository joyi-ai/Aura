export type ModeId = "claude-code" | "codex" | "opencode" | (string & {})

export type ModeProviderOverride = string | undefined

export type ModeDefinition = {
  id: ModeId
  name: string
  description?: string
  icon?: string
  color?: string
  providerOverride?: ModeProviderOverride
  defaultAgent?: string
  defaultModel?: string
  defaultVariant?: string
  defaultThinking?: boolean
  allowedAgents?: string[]
  disabledAgents?: string[]
  requiresPlugins?: string[]
  overrides?: Record<string, unknown>
  builtin?: boolean
}

export type ModeOverride = {
  name?: string
  description?: string
  color?: string
  providerOverride?: ModeProviderOverride | null
  defaultAgent?: string | null
  defaultModel?: string | null
  defaultVariant?: string | null
  defaultThinking?: boolean | null
  overrides?: Record<string, unknown>
}
