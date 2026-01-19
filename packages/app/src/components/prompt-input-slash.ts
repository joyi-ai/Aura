export type CodexSlashAction =
  | { kind: "command"; id: string }
  | { kind: "summarize" }
  | { kind: "insert"; text: string; popover?: "at" | "slash" }
  | { kind: "settings" }
  | { kind: "link"; url: string }

// Nested option for hierarchical menus in the slash popup tray
export type NestedOption = {
  id: string
  label: string
  description?: string
  // If present, selecting shows another nested view
  nested?: NestedOptionView
  // If present, this is a terminal option that produces text to submit
  result?: string
}

// View types for nested menus
export type NestedOptionView =
  | { type: "static"; title: string; options: NestedOption[] }
  | {
      type: "dynamic"
      title: string
      loaderId:
        | "branches"
        | "commits"
        | "sessions"
        | "models"
        | "themes"
        | "agents"
        | "mcp-servers"
        | "plugins"
        | "hooks"
        | "ides"
        | "bashes"
        | "memory-files"
        | "output-styles"
        | "rewind-points"
      searchable?: boolean
    }
  | { type: "input"; title: string; placeholder: string }

// State for nested option stack
export type NestedStackItem = {
  view: NestedOptionView
  trigger: string
  options: NestedOption[]
  filter: string
  activeIndex: number
  loading: boolean
}

type CodexSlashCommand = {
  trigger: string
  title: string
  description: string
  action?: CodexSlashAction
  nested?: NestedOptionView
  debugOnly?: boolean
}

const CODEX_SLASH_COMMANDS: CodexSlashCommand[] = [
  {
    trigger: "approvals",
    title: "Approvals",
    description: "choose what Codex can do without approval",
    action: { kind: "settings" },
  },
  {
    trigger: "review",
    title: "Review",
    description: "review my current changes and find issues",
    nested: {
      type: "static",
      title: "Select a review preset",
      options: [
        {
          id: "review-branch",
          label: "Review against a base branch",
          description: "Compare current branch to another branch",
          nested: {
            type: "dynamic",
            title: "Select a branch",
            loaderId: "branches",
            searchable: true,
          },
        },
        {
          id: "review-uncommitted",
          label: "Review uncommitted changes",
          description: "Review all staged and unstaged changes",
          result: "/review",
        },
        {
          id: "review-commit",
          label: "Review a commit",
          description: "Review changes in a specific commit",
          nested: {
            type: "dynamic",
            title: "Select a commit",
            loaderId: "commits",
            searchable: true,
          },
        },
        {
          id: "review-custom",
          label: "Custom review instructions",
          description: "Enter branch, commit, or PR URL",
          nested: {
            type: "input",
            title: "Enter review target",
            placeholder: "branch name, commit SHA, or PR URL...",
          },
        },
      ],
    },
  },
  {
    trigger: "new",
    title: "New",
    description: "start a new chat during a conversation",
    action: { kind: "command", id: "session.new" },
  },
  {
    trigger: "init",
    title: "Init",
    description: "create an AGENTS.md file with instructions for Codex",
  },
  {
    trigger: "compact",
    title: "Compact",
    description: "summarize conversation to prevent hitting the context limit",
    action: { kind: "summarize" },
  },
  {
    trigger: "mention",
    title: "Mention",
    description: "mention a file",
    action: { kind: "insert", text: "@", popover: "at" },
  },
  {
    trigger: "mcp",
    title: "MCP",
    description: "list configured MCP tools",
    action: { kind: "command", id: "mcp.toggle" },
  },
  {
    trigger: "feedback",
    title: "Feedback",
    description: "send logs to maintainers",
    action: { kind: "link", url: "https://opencode.ai/desktop-feedback" },
  },
]

export const CODEX_SLASH_HIDDEN = new Set([
  "model",
  "experimental",
  "skills",
  "resume",
  "logout",
  "quit",
  "exit",
  "rollout",
  "ps",
  "test-approval",
])
export const CODEX_SLASH_COMMANDS_ACTIVE = CODEX_SLASH_COMMANDS.filter((cmd) => import.meta.env.DEV || !cmd.debugOnly)
export const CODEX_SLASH_COMMANDS_BY_TRIGGER = new Map(CODEX_SLASH_COMMANDS_ACTIVE.map((cmd) => [cmd.trigger, cmd]))
export const CODEX_SLASH_COMMAND_TRIGGERS = new Set(CODEX_SLASH_COMMANDS_ACTIVE.map((cmd) => cmd.trigger))
export const CODEX_SLASH_INSERT_TRIGGERS = new Set(
  CODEX_SLASH_COMMANDS_ACTIVE.filter((cmd) => !cmd.action).map((cmd) => cmd.trigger),
)
export const CODEX_SLASH_DISABLED = new Set([...CODEX_SLASH_COMMAND_TRIGGERS, ...CODEX_SLASH_HIDDEN])

// Claude Code slash command - full definition similar to CodexSlashCommand
type ClaudeCodeSlashCommand = {
  trigger: string
  title: string
  description: string
  nested?: NestedOptionView
}

export const CLAUDE_CODE_SLASH_COMMANDS: ClaudeCodeSlashCommand[] = [
  // === Simple Commands (no nested options) ===
  { trigger: "clear", title: "Clear", description: "clear conversation history" },
  { trigger: "config", title: "Config", description: "open the Settings interface" },
  { trigger: "context", title: "Context", description: "visualize current context usage" },
  { trigger: "cost", title: "Cost", description: "show token usage statistics" },
  { trigger: "doctor", title: "Doctor", description: "check installation health" },
  { trigger: "exit", title: "Exit", description: "exit the REPL" },
  { trigger: "help", title: "Help", description: "get usage help" },
  { trigger: "init", title: "Init", description: "initialize project with CLAUDE.md" },
  { trigger: "install-github-app", title: "Install GitHub App", description: "setup Claude GitHub Actions" },
  { trigger: "login", title: "Login", description: "switch Anthropic accounts" },
  { trigger: "logout", title: "Logout", description: "sign out from your account" },
  { trigger: "plan", title: "Plan", description: "enter plan mode" },
  { trigger: "pr-comments", title: "PR Comments", description: "view pull request comments" },
  { trigger: "privacy-settings", title: "Privacy Settings", description: "update privacy settings" },
  { trigger: "release-notes", title: "Release Notes", description: "view release notes" },
  { trigger: "remote-env", title: "Remote Env", description: "configure remote environment" },
  { trigger: "sandbox", title: "Sandbox", description: "enable sandboxed bash tool" },
  { trigger: "security-review", title: "Security Review", description: "complete security review of pending changes" },
  { trigger: "stats", title: "Stats", description: "visualize daily usage and session history" },
  { trigger: "status", title: "Status", description: "show version, model, account info" },
  { trigger: "statusline", title: "Statusline", description: "setup status line UI" },
  { trigger: "todos", title: "Todos", description: "list current TODO items" },
  { trigger: "usage", title: "Usage", description: "show plan usage limits" },
  { trigger: "vim", title: "Vim", description: "enter vim mode" },

  // === Commands with Nested Options ===
  // === Code Review ===
  {
    trigger: "review",
    title: "Review",
    description: "request code review",
    nested: {
      type: "static",
      title: "Select review type",
      options: [
        {
          id: "review-uncommitted",
          label: "Review uncommitted changes",
          description: "Review all staged and unstaged changes",
          result: "/review",
        },
        {
          id: "review-branch",
          label: "Review against a branch",
          description: "Compare current branch to another",
          nested: { type: "dynamic", title: "Select base branch", loaderId: "branches", searchable: true },
        },
        {
          id: "review-commit",
          label: "Review a specific commit",
          description: "Review changes in a specific commit",
          nested: { type: "dynamic", title: "Select commit", loaderId: "commits", searchable: true },
        },
        {
          id: "review-custom",
          label: "Custom review target",
          description: "Enter branch, commit SHA, or PR URL",
          nested: { type: "input", title: "Enter review target", placeholder: "branch name, commit SHA, or PR URL..." },
        },
      ],
    },
  },

  // === Session Management ===
  {
    trigger: "compact",
    title: "Compact",
    description: "compact conversation to save context",
    nested: {
      type: "static",
      title: "Compact options",
      options: [
        { id: "compact-default", label: "Compact conversation", description: "Summarize to save context", result: "/compact" },
        {
          id: "compact-focus",
          label: "Compact with focus",
          description: "Summarize with focus instructions",
          nested: { type: "input", title: "Focus instructions", placeholder: "What aspects to preserve..." },
        },
      ],
    },
  },
  {
    trigger: "resume",
    title: "Resume",
    description: "resume a previous conversation",
    nested: { type: "dynamic", title: "Select session to resume", loaderId: "sessions", searchable: true },
  },
  {
    trigger: "rename",
    title: "Rename",
    description: "rename the current session",
    nested: { type: "input", title: "Rename session", placeholder: "Enter new session name..." },
  },
  {
    trigger: "rewind",
    title: "Rewind",
    description: "rewind conversation and/or code",
    nested: { type: "dynamic", title: "Select rewind point", loaderId: "rewind-points", searchable: false },
  },
  {
    trigger: "teleport",
    title: "Teleport",
    description: "resume a remote session from claude.ai",
    nested: { type: "dynamic", title: "Select remote session", loaderId: "sessions", searchable: true },
  },

  // === Model & Output ===
  {
    trigger: "model",
    title: "Model",
    description: "select or change the AI model",
    nested: { type: "dynamic", title: "Select model", loaderId: "models", searchable: true },
  },
  {
    trigger: "output-style",
    title: "Output Style",
    description: "set the output style",
    nested: { type: "dynamic", title: "Select output style", loaderId: "output-styles", searchable: false },
  },
  {
    trigger: "theme",
    title: "Theme",
    description: "change the color theme",
    nested: { type: "dynamic", title: "Select theme", loaderId: "themes", searchable: true },
  },

  // === Project & Config ===
  {
    trigger: "add-dir",
    title: "Add Dir",
    description: "add additional working directories",
    nested: { type: "input", title: "Add directory", placeholder: "Enter directory path..." },
  },
  {
    trigger: "memory",
    title: "Memory",
    description: "edit CLAUDE.md memory files",
    nested: { type: "dynamic", title: "Select memory file", loaderId: "memory-files", searchable: true },
  },
  {
    trigger: "export",
    title: "Export",
    description: "export the current conversation",
    nested: {
      type: "static",
      title: "Export options",
      options: [
        { id: "export-clipboard", label: "Copy to clipboard", description: "Export to clipboard", result: "/export clipboard" },
        { id: "export-markdown", label: "Export as Markdown", description: "Save as .md file", result: "/export conversation.md" },
        {
          id: "export-custom",
          label: "Custom filename",
          description: "Specify filename",
          nested: { type: "input", title: "Enter filename", placeholder: "filename.md" },
        },
      ],
    },
  },

  // === Integrations ===
  {
    trigger: "agents",
    title: "Agents",
    description: "manage custom AI subagents",
    nested: { type: "dynamic", title: "Select agent", loaderId: "agents", searchable: true },
  },
  {
    trigger: "mcp",
    title: "MCP",
    description: "manage MCP server connections",
    nested: { type: "dynamic", title: "Select MCP server", loaderId: "mcp-servers", searchable: true },
  },
  {
    trigger: "plugin",
    title: "Plugin",
    description: "manage Claude Code plugins",
    nested: { type: "dynamic", title: "Select plugin", loaderId: "plugins", searchable: true },
  },
  {
    trigger: "hooks",
    title: "Hooks",
    description: "manage hook configurations",
    nested: { type: "dynamic", title: "Select hook", loaderId: "hooks", searchable: true },
  },
  {
    trigger: "ide",
    title: "IDE",
    description: "manage IDE integrations",
    nested: { type: "dynamic", title: "Select IDE", loaderId: "ides", searchable: false },
  },
  {
    trigger: "bashes",
    title: "Bashes",
    description: "list and manage background tasks",
    nested: { type: "dynamic", title: "Select background task", loaderId: "bashes", searchable: false },
  },

  // === Permissions ===
  {
    trigger: "permissions",
    title: "Permissions",
    description: "view or update permissions",
    nested: {
      type: "static",
      title: "Permission actions",
      options: [
        { id: "permissions-view", label: "View permissions", description: "Show current permissions", result: "/permissions" },
        { id: "permissions-reset", label: "Reset permissions", description: "Reset to defaults", result: "/permissions reset" },
      ],
    },
  },

  // === Setup ===
  {
    trigger: "terminal-setup",
    title: "Terminal Setup",
    description: "install Shift+Enter key binding",
    nested: {
      type: "static",
      title: "Select terminal",
      options: [
        { id: "terminal-vscode", label: "VS Code", description: "Install for VS Code terminal", result: "/terminal-setup vscode" },
        { id: "terminal-alacritty", label: "Alacritty", description: "Install for Alacritty", result: "/terminal-setup alacritty" },
        { id: "terminal-zed", label: "Zed", description: "Install for Zed", result: "/terminal-setup zed" },
        { id: "terminal-warp", label: "Warp", description: "Install for Warp", result: "/terminal-setup warp" },
      ],
    },
  },

  // === Bug Reporting ===
  {
    trigger: "bug",
    title: "Bug",
    description: "report bugs to Anthropic",
    nested: {
      type: "static",
      title: "Report a bug",
      options: [
        { id: "bug-report", label: "Report current issue", description: "File bug report with context", result: "/bug" },
        {
          id: "bug-describe",
          label: "Describe the bug",
          description: "Enter a description",
          nested: { type: "input", title: "Bug description", placeholder: "Describe the issue..." },
        },
      ],
    },
  },
]

export const CLAUDE_CODE_SLASH_COMMANDS_BY_TRIGGER = new Map(
  CLAUDE_CODE_SLASH_COMMANDS.map((cmd) => [cmd.trigger, cmd]),
)
