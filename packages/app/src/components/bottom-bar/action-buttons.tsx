import { Button } from "@opencode-ai/ui/button"
import { SkillsPopover } from "./skills-popover"
import { McpPopover } from "./mcp-popover"
import { PluginsPopover } from "./plugins-popover"
import { SettingsPopover } from "./settings-popover"

export function ActionButtons() {
  return (
    <div class="flex items-center gap-1 shrink-0">
      <SkillsPopover>
        <Button variant="ghost" size="small" icon="brain" class="text-text-base">
          Skills
        </Button>
      </SkillsPopover>

      <McpPopover>
        <Button variant="ghost" size="small" icon="mcp" class="text-text-base">
          MCP
        </Button>
      </McpPopover>

      <PluginsPopover>
        <Button variant="ghost" size="small" icon="code" class="text-text-base">
          Plugins
        </Button>
      </PluginsPopover>

      <SettingsPopover>
        <Button variant="ghost" size="small" icon="settings-gear" class="text-text-base">
          Settings
        </Button>
      </SettingsPopover>
    </div>
  )
}
