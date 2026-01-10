export type ModeId = "claude-code" | "codex" | "opencode" | "oh-my-opencode" | (string & {})

export type ModeProviderOverride = string | undefined

export type OhMyOpenCodeSettings = {
  sisyphusAgent?: {
    disabled?: boolean
    defaultBuilderEnabled?: boolean
    plannerEnabled?: boolean
    replacePlan?: boolean
  }
  disabledAgents?: string[]
  disabledHooks?: string[]
  claudeCode?: {
    mcp?: boolean
    commands?: boolean
    skills?: boolean
    agents?: boolean
    hooks?: boolean
    plugins?: boolean
  }
  autoUpdate?: boolean
}

export type ModeSettings = {
  ohMyOpenCode?: OhMyOpenCodeSettings
}

export type ModeDefinition = {
  id: ModeId
  name: string
  description?: string
  icon?: string
  color?: string
  providerOverride?: ModeProviderOverride
  defaultAgent?: string
  allowedAgents?: string[]
  disabledAgents?: string[]
  requiresPlugins?: string[]
  settings?: ModeSettings
  overrides?: Record<string, unknown>
  builtin?: boolean
}

export type ModeOverride = {
  name?: string
  description?: string
  color?: string
  providerOverride?: ModeProviderOverride | null
  defaultAgent?: string | null
  settings?: ModeSettings
  overrides?: Record<string, unknown>
}
