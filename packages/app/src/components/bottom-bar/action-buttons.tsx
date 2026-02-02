import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogSelectProvider } from "@/components/dialog-select-provider"
import { SkillsPopover } from "./skills-popover"
import { SettingsPopover } from "./settings-popover"

export function ActionButtons() {
  const dialog = useDialog()

  return (
    <div class="flex items-center gap-1 shrink-0">
      <Button
        variant="ghost"
        size="small"
        icon="plug"
        class="text-text-base"
        onClick={() => dialog.show(() => <DialogSelectProvider />)}
      >
        Provider
      </Button>

      <SkillsPopover>
        <Button variant="ghost" size="small" icon="brain" class="text-text-base">
          Skills
        </Button>
      </SkillsPopover>

      <SettingsPopover>
        <Button variant="ghost" size="small" icon="settings-gear" class="text-text-base">
          Settings
        </Button>
      </SettingsPopover>
    </div>
  )
}
