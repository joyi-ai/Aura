import type { ModeDefinition, ModeId } from "./types"
import { OH_MY_OPENCODE_DEFAULT_SETTINGS } from "./oh-my-opencode"

export const DEFAULT_MODE_ID: ModeId = "claude-code"

export const BUILTIN_MODES: ModeDefinition[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    description: "Claude Code workflows with the claude-agent provider.",
    icon: "speech-bubble",
    color: "#E07A5F",
    providerOverride: "claude-agent",
    defaultAgent: "build",
    allowedAgents: ["build", "plan"],
    builtin: true,
  },
  {
    id: "codex",
    name: "Codex",
    description: "Codex workflows powered by the Codex app-server.",
    icon: "pencil-line",
    color: "#10A37F",
    providerOverride: "codex",
    defaultAgent: "build",
    allowedAgents: ["build", "plan"],
    builtin: true,
  },
  {
    id: "opencode",
    name: "OpenCode",
    description: "Standard OpenCode behavior with your preferred provider.",
    icon: "code",
    color: "#3D405B",
    defaultAgent: "build",
    disabledAgents: [
      "Sisyphus",
      "OpenCode-Builder",
      "Planner-Sisyphus",
      "oracle",
      "librarian",
      "frontend-ui-ux-engineer",
      "document-writer",
      "multimodal-looker",
    ],
    builtin: true,
  },
  {
    id: "oh-my-opencode",
    name: "Oh My OpenCode",
    description: "Sisyphus orchestration with enhanced specialist agents.",
    icon: "brain",
    color: "#00CED1",
    defaultAgent: "Sisyphus",
    requiresPlugins: ["oh-my-opencode"],
    settings: {
      ohMyOpenCode: OH_MY_OPENCODE_DEFAULT_SETTINGS,
    },
    builtin: true,
  },
]
