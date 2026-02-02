import { type ParentProps, Show, createMemo } from "solid-js"
import { Popover } from "@opencode-ai/ui/popover"
import { SDKProvider } from "@/context/sdk"
import { SyncProvider } from "@/context/sync"
import { useMultiPane } from "@/context/multi-pane"
import { SkillsPanel } from "@/components/settings/skills-panel"

function SkillsContent() {
  return (
    <div class="w-80 max-h-80 overflow-y-auto no-scrollbar p-px -m-px">
      <SkillsPanel />
    </div>
  )
}

function SkillsPopoverInner(props: ParentProps) {
  return (
    <Popover gutter={8} placement="top-end" modal={false} trigger={props.children} title="Skills">
      <SkillsContent />
    </Popover>
  )
}

export function SkillsPopover(props: ParentProps) {
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
            <SkillsPopoverInner>{props.children}</SkillsPopoverInner>
          </SyncProvider>
        </SDKProvider>
      )}
    </Show>
  )
}
