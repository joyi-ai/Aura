import { Show, createMemo, createSignal } from "solid-js"
import { useMultiPane, type PaneConfig } from "@/context/multi-pane"
import { useSingleViewOverlay } from "@/hooks/use-single-view-overlay"
import { SingleViewOverlay } from "@/components/single-view-overlay"

type SingleViewPaneProps = {
  pane: PaneConfig | undefined
  renderPane: (pane: PaneConfig) => any
}

export function SingleViewPane(props: SingleViewPaneProps) {
  const multiPane = useMultiPane()

  const [overlayOpen, setOverlayOpen] = createSignal(false)

  const overlay = useSingleViewOverlay({
    onOpen: () => setOverlayOpen(true),
    onClose: () => setOverlayOpen(false),
  })

  const handleSessionSelect = (sessionId: string, directory: string, worktree?: string) => {
    const pane = props.pane
    if (!pane) return
    multiPane.updatePane(pane.id, {
      sessionId,
      directory,
      worktree,
    })
    overlay.close()
  }

  const handleNewSession = () => {
    const pane = props.pane
    if (!pane) return
    multiPane.updatePane(pane.id, {
      sessionId: undefined,
    })
    overlay.close()
  }

  return (
    <div
      class="flex-1 min-h-0 relative"
      onMouseDown={overlay.handlers.onMouseDown}
      onMouseMove={overlay.handlers.onMouseMove}
      onMouseUp={overlay.handlers.onMouseUp}
      onContextMenu={overlay.handlers.onContextMenu}
    >
      <Show when={props.pane}>
        {(pane) => (
          <div class="size-full">
            {props.renderPane(pane())}
          </div>
        )}
      </Show>

      <Show when={overlayOpen()}>
        <SingleViewOverlay
          x={overlay.centerX()}
          y={overlay.centerY()}
          currentDirectory={props.pane?.directory}
          currentWorktree={props.pane?.worktree}
          onSessionSelect={handleSessionSelect}
          onNewSession={handleNewSession}
          onClose={overlay.close}
        />
      </Show>
    </div>
  )
}
