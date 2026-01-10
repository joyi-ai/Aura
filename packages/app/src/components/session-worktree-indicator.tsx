import { createMemo, Show } from "solid-js"
import { useParams } from "@solidjs/router"
import { useSync } from "@/context/sync"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { Icon } from "@opencode-ai/ui/icon"

/** Compact worktree status indicator for the prompt bar area */
export function WorktreeStatusIndicator() {
  const sync = useSync()
  const params = useParams()

  const currentSession = createMemo(() => {
    const sessions = sync.data.session ?? []
    return sessions.find((s) => s.id === params.id)
  })

  // TODO: worktree support pending SDK regeneration
  const hasWorktree = createMemo(() => !!(currentSession() as any)?.worktree)
  const worktreePath = createMemo(() => (currentSession() as any)?.worktree?.path)

  return (
    <Show when={hasWorktree()}>
      <Tooltip placement="top" value={`Worktree: ${worktreePath()}`}>
        <div class="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-info-base/10 text-text-info-base">
          <Icon name="code" size="small" />
          <span class="text-11-medium">Worktree</span>
        </div>
      </Tooltip>
    </Show>
  )
}
