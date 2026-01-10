import { createMemo } from "solid-js"
import { useGlobalSync } from "@/context/global-sync"

export function usePreferredProject() {
  const globalSync = useGlobalSync()

  const mostRecent = createMemo(() => {
    const sorted = globalSync.data.project.toSorted(
      (a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created),
    )
    return sorted[0]?.worktree
  })
  const fallback = createMemo(() => globalSync.data.path.directory)

  return createMemo(() => mostRecent() || fallback())
}
