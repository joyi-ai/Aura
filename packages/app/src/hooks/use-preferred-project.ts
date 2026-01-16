import { createMemo } from "solid-js"
import { useGlobalSync } from "@/context/global-sync"
import { useLayout } from "@/context/layout"

export function usePreferredProject() {
  const globalSync = useGlobalSync()
  const layout = useLayout()

  const mostRecent = createMemo(() => {
    const recent = layout.projects.recent(1)
    if (recent.length > 0) return recent[0].worktree
    return layout.projects.list()[0]?.worktree
  })
  const fallback = createMemo(() => globalSync.data.path.directory)

  return createMemo(() => mostRecent() || fallback())
}
