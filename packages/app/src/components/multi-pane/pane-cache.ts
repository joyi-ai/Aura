import type { Prompt } from "@/context/prompt"

export type PaneCache = {
  prompt?: Prompt
  agent?: string
  model?: { providerID: string; modelID: string }
  variant?: string | null
  modeId?: string
}

export const paneCache = new Map<string, PaneCache>()
