import { type ParentProps, Show, createMemo, createSignal } from "solid-js"
import { Dialog } from "@opencode-ai/ui/dialog"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { SDKProvider } from "@/context/sdk"
import { SyncProvider } from "@/context/sync"
import { useMultiPane } from "@/context/multi-pane"
import { SkillsPanel } from "@/components/settings/skills-panel"
import { McpSettingsPanel } from "@/components/dialog-select-mcp"
import { ClaudePluginsPanel } from "@/components/settings/claude-plugins-panel"
import { OpenCodePluginsPanel } from "@/components/settings/opencode-plugins-panel"

function SkillsContent() {
  const [tab, setTab] = createSignal<"skills" | "mcp" | "plugins">("skills")
  const [plugin, setPlugin] = createSignal<"claude" | "opencode">("claude")
  const items: Array<{ id: "skills" | "mcp" | "plugins"; label: string }> = [
    { id: "skills", label: "Skills" },
    { id: "mcp", label: "MCP" },
    { id: "plugins", label: "Plugins" },
  ]

  return (
    <div class="w-full h-[28rem] overflow-hidden flex gap-4 px-4 py-6">
      <nav class="flex flex-col gap-1 w-28 shrink-0 border-r border-border-base pr-4">
        <div class="flex flex-col gap-1 p-1">
          {items.map((item) => (
            <button
              type="button"
              class="px-2 py-1 rounded text-left text-12-medium transition-colors"
              classList={{
                "bg-background-base text-text-strong shadow-sm": tab() === item.id,
                "text-text-base hover:text-text-strong": tab() !== item.id,
              }}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
      <div class="flex-1 min-w-0 h-full overflow-hidden">
        <Show when={tab() === "skills"}>
          <div class="h-full min-h-0">
            <SkillsPanel />
          </div>
        </Show>
        <Show when={tab() === "mcp"}>
          <div class="h-full overflow-y-auto no-scrollbar p-px -m-px">
            <McpSettingsPanel />
          </div>
        </Show>
        <Show when={tab() === "plugins"}>
          <div class="h-full overflow-y-auto no-scrollbar p-px -m-px">
            <div class="flex flex-col gap-3">
            <div class="flex gap-1 p-0.5 rounded-md">
              <button
                type="button"
                class="flex-1 px-3 py-1 rounded text-12-medium transition-colors"
                  classList={{
                    "bg-background-base text-text-strong shadow-sm": plugin() === "claude",
                    "text-text-base hover:text-text-strong": plugin() !== "claude",
                  }}
                  onClick={() => setPlugin("claude")}
                >
                  Claude
                </button>
                <button
                  type="button"
                  class="flex-1 px-3 py-1 rounded text-12-medium transition-colors"
                  classList={{
                    "bg-background-base text-text-strong shadow-sm": plugin() === "opencode",
                    "text-text-base hover:text-text-strong": plugin() !== "opencode",
                  }}
                  onClick={() => setPlugin("opencode")}
                >
                  OpenCode
                </button>
              </div>
              <Show when={plugin() === "claude"}>
                <ClaudePluginsPanel variant="dialog" />
              </Show>
              <Show when={plugin() === "opencode"}>
                <OpenCodePluginsPanel />
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}

function SkillsDialog(props: { directory: string }) {
  return (
    <SDKProvider directory={props.directory}>
      <SyncProvider>
        <Dialog size="xl">
          <SkillsContent />
        </Dialog>
      </SyncProvider>
    </SDKProvider>
  )
}

export function SkillsPopover(props: ParentProps) {
  const dialog = useDialog()
  const multiPane = useMultiPane()
  const focusedDirectory = createMemo(() => {
    const pane = multiPane.focusedPane()
    if (!pane) return undefined
    return pane.worktree ?? pane.directory
  })

  return (
    <Show when={focusedDirectory()} fallback={props.children}>
      {(directory) => (
        <span class="inline-flex" onClick={() => dialog.show(() => <SkillsDialog directory={directory()} />)}>
          {props.children}
        </span>
      )}
    </Show>
  )
}
