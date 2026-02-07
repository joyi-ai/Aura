import { type ParentProps, Show, createMemo } from "solid-js"
import { Popover } from "@opencode-ai/ui/popover"
import { SDKProvider } from "@/context/sdk"
import { SyncProvider } from "@/context/sync"
import { useMultiPane } from "@/context/multi-pane"
import { McpSettingsPanel } from "@/components/dialog-select-mcp"

function McpContent() {
  return (
    <div class="w-80 max-h-80 overflow-y-auto p-px -m-px">
      <McpSettingsPanel />
    </div>
  )
}

function McpPopoverInner(props: ParentProps) {
  return (
    <Popover gutter={8} placement="top-end" modal={false} trigger={props.children} title="MCP Servers">
      <McpContent />
    </Popover>
  )
}

export function McpPopover(props: ParentProps) {
  const multiPane = useMultiPane()
  const focusedDirectory = createMemo(() => {
    const pane = multiPane.focusedPane()
    if (!pane) return undefined
    return pane.worktree ?? pane.directory
  })

  return (
    <Show when={focusedDirectory()} fallback={props.children}>
      {(directory) => (
        <SDKProvider directory={directory()}>
          <SyncProvider>
            <McpPopoverInner>{props.children}</McpPopoverInner>
          </SyncProvider>
        </SDKProvider>
      )}
    </Show>
  )
}
