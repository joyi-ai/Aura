import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogSelectProvider } from "@/components/dialog-select-provider"
import { SkillsPopover } from "./skills-popover"
import { SettingsPopover } from "./settings-popover"
import { useMultiPane } from "@/context/multi-pane"

export function ActionButtons() {
  const dialog = useDialog()
  const multiPane = useMultiPane()

  return (
    <div class="flex items-center gap-1 shrink-0">
      <Button
        variant="ghost"
        size="small"
        icon={multiPane.viewMode() === "single" ? "task" : "dot-grid"}
        class="text-text-base"
        onClick={() => multiPane.toggleViewMode()}
      >
        {multiPane.viewMode() === "single" ? "Single" : "Multi"}
      </Button>

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
