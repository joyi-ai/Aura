import { Show, For, Match, Switch, createMemo, createResource } from "solid-js"
import { Dynamic } from "solid-js/web"
import {
  DragDropProvider,
  DragDropSensors,
  DragOverlay,
  SortableProvider,
  closestCenter,
  createSortable,
} from "@thisbeyond/solid-dnd"
import type { DragEvent } from "@thisbeyond/solid-dnd"
import type { JSX } from "solid-js"
import { Tabs } from "@opencode-ai/ui/tabs"
import { Tooltip, TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { DiffChanges } from "@opencode-ai/ui/diff-changes"
import { SessionReview } from "@opencode-ai/ui/session-review"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { useCodeComponent } from "@opencode-ai/ui/context/code"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useLocal, type LocalFile } from "@/context/local"
import { useLayout } from "@/context/layout"
import { useCommand } from "@/context/command"
import { DialogSelectFile } from "@/components/dialog-select-file"
import { SessionContextUsage } from "@/components/session-context-usage"
import { ConstrainDragYAxis, getDraggableId } from "@/utils/solid-dnd"
import { checksum } from "@opencode-ai/util/encode"
import type { FileDiff } from "@opencode-ai/sdk/v2"

export interface ReviewPanelProps {
  sessionKey: string
  sessionId?: string
  diffs: FileDiff[]
  sessionInfo?: { summary?: { files?: number }; title?: string }
  onTabClick?: (tab: string) => void
  onDragStart?: (id: string) => void
  onDragEnd?: () => void
  activeDraggable?: string
}

function FileVisual(props: { file: LocalFile; active?: boolean }): JSX.Element {
  return (
    <div class="flex items-center gap-x-1.5">
      <FileIcon
        node={props.file}
        classList={{
          "grayscale-100 group-data-[selected]/tab:grayscale-0": !props.active,
          "grayscale-0": props.active,
        }}
      />
      <span
        classList={{
          "text-14-medium": true,
          "text-primary": !!props.file.status?.status,
          italic: !props.file.pinned,
        }}
      >
        {props.file.name}
      </span>
      <span class="hidden opacity-70">
        <Switch>
          <Match when={props.file.status?.status === "modified"}>
            <span class="text-primary">M</span>
          </Match>
          <Match when={props.file.status?.status === "added"}>
            <span class="text-success">A</span>
          </Match>
          <Match when={props.file.status?.status === "deleted"}>
            <span class="text-error">D</span>
          </Match>
        </Switch>
      </span>
    </div>
  )
}

function SortableTab(props: {
  tab: string
  onTabClick: (tab: string) => void
  onTabClose: (tab: string) => void
}): JSX.Element {
  const local = useLocal()
  const sortable = createSortable(props.tab)
  const [file] = createResource(
    () => props.tab,
    async (tab) => {
      if (tab.startsWith("file://")) {
        return local.file.node(tab.replace("file://", ""))
      }
      return undefined
    },
  )
  return (
    // @ts-ignore
    <div use:sortable classList={{ "h-full": true, "opacity-0": sortable.isActiveDraggable }}>
      <div class="relative h-full">
        <Tabs.Trigger
          value={props.tab}
          closeButton={
            <Tooltip value="Close tab" placement="bottom">
              <IconButton icon="close" variant="ghost" onClick={() => props.onTabClose(props.tab)} />
            </Tooltip>
          }
          hideCloseButton
          onClick={() => props.onTabClick(props.tab)}
        >
          <Switch>
            <Match when={file()}>{(f) => <FileVisual file={f()} />}</Match>
          </Switch>
        </Tabs.Trigger>
      </div>
    </div>
  )
}

export function ReviewPanel(props: ReviewPanelProps) {
  const layout = useLayout()
  const local = useLocal()
  const dialog = useDialog()
  const codeComponent = useCodeComponent()
  const command = useCommand()

  const tabs = createMemo(() => layout.tabs(props.sessionKey))
  const contextOpen = createMemo(() => tabs().active() === "context" || tabs().all().includes("context"))
  const openedTabs = createMemo(() =>
    tabs()
      .all()
      .filter((tab) => tab !== "context"),
  )

  const activeTab = createMemo(() => {
    const active = tabs().active()
    if (active) return active
    if (props.diffs.length > 0) return "review"
    return tabs().all()[0] ?? "review"
  })

  let clickTimer: number | undefined
  let activeDraggable: string | undefined

  function resetClickTimer() {
    if (!clickTimer) return
    clearTimeout(clickTimer)
    clickTimer = undefined
  }

  function startClickTimer() {
    clickTimer = setTimeout(() => {
      clickTimer = undefined
    }, 300) as unknown as number
  }

  function handleTabClick(tab: string) {
    if (clickTimer) {
      resetClickTimer()
    } else {
      if (tab.startsWith("file://")) {
        local.file.open(tab.replace("file://", ""))
      }
      startClickTimer()
    }
    props.onTabClick?.(tab)
  }

  function handleDragStart(event: unknown) {
    const id = getDraggableId(event)
    if (!id) return
    activeDraggable = id
    props.onDragStart?.(id)
  }

  function handleDragOver(event: DragEvent) {
    const { draggable, droppable } = event
    if (draggable && droppable) {
      const currentTabs = tabs().all()
      const fromIndex = currentTabs?.indexOf(draggable.id.toString())
      const toIndex = currentTabs?.indexOf(droppable.id.toString())
      if (fromIndex !== toIndex && toIndex !== undefined) {
        tabs().move(draggable.id.toString(), toIndex)
      }
    }
  }

  function handleDragEnd() {
    activeDraggable = undefined
    props.onDragEnd?.()
  }

  return (
    <div class="relative flex-1 min-w-0 h-full border-l border-border-weak-base">
      <DragDropProvider
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        collisionDetector={closestCenter}
      >
        <DragDropSensors />
        <ConstrainDragYAxis />
        <Tabs value={activeTab()} onChange={tabs().open}>
          <div class="sticky top-0 shrink-0 flex">
            <Tabs.List>
              <Show when={props.diffs.length}>
                <Tabs.Trigger value="review">
                  <div class="flex items-center gap-3">
                    <Show when={props.diffs}>
                      <DiffChanges changes={props.diffs} variant="bars" />
                    </Show>
                    <div class="flex items-center gap-1.5">
                      <div>Review</div>
                      <Show when={props.sessionInfo?.summary?.files}>
                        <div class="text-12-medium text-text-strong h-4 px-2 flex flex-col items-center justify-center rounded-full bg-surface-base">
                          {props.sessionInfo?.summary?.files ?? 0}
                        </div>
                      </Show>
                    </div>
                  </div>
                </Tabs.Trigger>
              </Show>
              <Show when={contextOpen()}>
                <Tabs.Trigger
                  value="context"
                  closeButton={
                    <Tooltip value="Close tab" placement="bottom">
                      <IconButton icon="close" variant="ghost" onClick={() => tabs().close("context")} />
                    </Tooltip>
                  }
                  hideCloseButton
                >
                  <div class="flex items-center gap-2">
                    <SessionContextUsage
                      variant="indicator"
                      sessionId={props.sessionId}
                      sessionKey={props.sessionKey}
                    />
                    <div>Context</div>
                  </div>
                </Tabs.Trigger>
              </Show>
              <SortableProvider ids={openedTabs()}>
                <For each={openedTabs()}>
                  {(tab) => <SortableTab tab={tab} onTabClick={handleTabClick} onTabClose={tabs().close} />}
                </For>
              </SortableProvider>
              <div class="bg-background-base h-full flex items-center justify-center border-b border-border-weak-base px-3">
                <TooltipKeybind title="Open file" keybind={command.keybind("file.open")} class="flex items-center">
                  <IconButton
                    icon="plus-small"
                    variant="ghost"
                    iconSize="large"
                    onClick={() => dialog.show(() => <DialogSelectFile sessionKey={props.sessionKey} />)}
                  />
                </TooltipKeybind>
              </div>
            </Tabs.List>
          </div>
          <Show when={props.diffs.length}>
            <Tabs.Content value="review" class="flex flex-col h-full overflow-hidden contain-strict">
              <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                <SessionReview
                  classes={{
                    root: "pb-40",
                    header: "px-6",
                    container: "px-6",
                  }}
                  diffs={props.diffs}
                  diffStyle={layout.review.diffStyle()}
                  onDiffStyleChange={layout.review.setDiffStyle}
                />
              </div>
            </Tabs.Content>
          </Show>
          <For each={openedTabs()}>
            {(tab) => {
              const [file] = createResource(
                () => tab,
                async (tab) => {
                  if (tab.startsWith("file://")) {
                    return local.file.node(tab.replace("file://", ""))
                  }
                  return undefined
                },
              )
              return (
                <Tabs.Content value={tab} class="mt-3">
                  <Switch>
                    <Match when={file()}>
                      {(f) => (
                        <Dynamic
                          component={codeComponent}
                          file={{
                            name: f().path,
                            contents: f().content?.content ?? "",
                            cacheKey: checksum(f().content?.content ?? ""),
                          }}
                          overflow="scroll"
                          class="select-text pb-40"
                        />
                      )}
                    </Match>
                  </Switch>
                </Tabs.Content>
              )
            }}
          </For>
        </Tabs>
        <DragOverlay>
          <Show when={activeDraggable || props.activeDraggable}>
            {(draggedFile) => {
              const [file] = createResource(
                () => draggedFile(),
                async (tab) => {
                  if (tab.startsWith("file://")) {
                    return local.file.node(tab.replace("file://", ""))
                  }
                  return undefined
                },
              )
              return (
                <div class="relative px-6 h-12 flex items-center bg-background-stronger border-x border-border-weak-base border-b border-b-transparent">
                  <Show when={file()}>{(f) => <FileVisual active file={f()} />}</Show>
                </div>
              )
            }}
          </Show>
        </DragOverlay>
      </DragDropProvider>
    </div>
  )
}
