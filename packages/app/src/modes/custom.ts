import { showToast } from "@opencode-ai/ui/toast"
import type { ModeDefinition } from "./types"

export function saveCustomMode(_mode: ModeDefinition) {
  showToast({
    variant: "default",
    title: "Custom modes coming soon",
    description: "Custom mode creation will be available in a future update.",
  })
}

export function deleteCustomMode(_modeId: string) {
  showToast({
    variant: "default",
    title: "Custom modes coming soon",
    description: "Custom mode deletion will be available in a future update.",
  })
}
