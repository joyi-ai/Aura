import { createEffect, onCleanup, type Accessor } from "solid-js"
import { useSync } from "@/context/sync"

export interface UseSessionSyncOptions {
  sessionId: Accessor<string | undefined>
  directoryMatches: Accessor<boolean>
  onNotFound?: () => void
}

export function useSessionSync(options: UseSessionSyncOptions): void {
  const sync = useSync()

  createEffect(() => {
    const sessionId = options.sessionId()
    if (!sessionId) return
    if (!options.directoryMatches()) return

    let active = true

    sync.session
      .sync(sessionId)
      .then(() => {
        if (!active || options.sessionId() !== sessionId) return
      })
      .catch((err) => {
        console.error("Failed to sync session:", sessionId, err)
        if (err?.name === "NotFoundError") {
          options.onNotFound?.()
        }
      })

    onCleanup(() => {
      active = false
    })
  })
}
