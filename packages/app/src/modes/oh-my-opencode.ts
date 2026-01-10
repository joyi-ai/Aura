import type { OhMyOpenCodeSettings } from "./types"

export const OH_MY_OPENCODE_AGENT_OPTIONS = [
  "Sisyphus",
  "oracle",
  "librarian",
  "explore",
  "frontend-ui-ux-engineer",
  "document-writer",
  "multimodal-looker",
] as const

export const OH_MY_OPENCODE_AGENT_NAMES = [
  "Sisyphus",
  "OpenCode-Builder",
  "Planner-Sisyphus",
  ...OH_MY_OPENCODE_AGENT_OPTIONS,
] as const

export const OH_MY_OPENCODE_HOOK_OPTIONS = [
  "todo-continuation-enforcer",
  "context-window-monitor",
  "session-recovery",
  "session-notification",
  "comment-checker",
  "grep-output-truncator",
  "tool-output-truncator",
  "directory-agents-injector",
  "directory-readme-injector",
  "empty-task-response-detector",
  "think-mode",
  "anthropic-context-window-limit-recovery",
  "rules-injector",
  "background-notification",
  "auto-update-checker",
  "startup-toast",
  "keyword-detector",
  "agent-usage-reminder",
  "non-interactive-env",
  "interactive-bash-session",
  "empty-message-sanitizer",
  "thinking-block-validator",
  "ralph-loop",
  "preemptive-compaction",
  "compaction-context-injector",
  "claude-code-hooks",
  "auto-slash-command",
  "edit-error-recovery",
] as const

export const OH_MY_OPENCODE_DEFAULT_SETTINGS: OhMyOpenCodeSettings = {
  sisyphusAgent: {
    disabled: false,
    defaultBuilderEnabled: false,
    plannerEnabled: true,
    replacePlan: true,
  },
  disabledAgents: [],
  disabledHooks: [],
  claudeCode: {
    mcp: true,
    commands: true,
    skills: true,
    agents: true,
    hooks: true,
    plugins: true,
  },
  autoUpdate: true,
}
