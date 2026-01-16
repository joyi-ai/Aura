import { For, Show, createMemo, createEffect, on, createSignal, type Accessor } from "solid-js"
import { createStore } from "solid-js/store"
import { SessionTurn } from "@opencode-ai/ui/session-turn"
import { SessionTodoFooter } from "@opencode-ai/ui/session-todo-footer"
import { SessionMessageRail } from "@opencode-ai/ui/session-message-rail"
import { Icon } from "@opencode-ai/ui/icon"
import { createAutoScroll } from "@opencode-ai/ui/hooks"
import { DateTime } from "luxon"
import { createDraggable, createDroppable } from "@thisbeyond/solid-dnd"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import { useLayout } from "@/context/layout"
import { useMultiPane } from "@/context/multi-pane"
import { useHeaderOverlay } from "@/hooks/use-header-overlay"
import { useSessionMessages } from "@/hooks/use-session-messages"
import { useSessionSync } from "@/hooks/use-session-sync"
import { useSessionCommands } from "@/hooks/use-session-commands"
import { useMessageActions } from "@/hooks/use-message-actions"
import { ThemeDropup } from "@/components/theme-dropup"
import { SessionPaneHeader } from "./header"
import { MobileView } from "./mobile-view"
import { ContextTab } from "./context-tab"
import { getDirectory, getFilename } from "@opencode-ai/util/path"
import { useNotification } from "@/context/notification"
import type { UserMessage } from "@opencode-ai/sdk/v2"
import { makeContextKey, makeSessionKey, makeViewKey } from "@/utils/layout-key"

export interface SessionPaneProps {
  paneId?: string
  directory: string
  projectDirectory?: string
  worktree?: string
  sessionId?: string
  isFocused?: Accessor<boolean>
  onSessionChange?: (sessionId: string | undefined) => void
  onDirectoryChange?: (directory: string) => void
  onWorktreeChange?: (worktree: string | undefined) => void
  onClose?: () => void
}

export function SessionPane(props: SessionPaneProps) {
  const sync = useSync()
  const sdk = useSDK()
  const layout = useLayout()
  const multiPane = useMultiPane()
  const notification = useNotification()
  const messageActions = useMessageActions()
  const hasMultiplePanes = createMemo(() => multiPane.panes().length > 1)

  // Local state
  const [store, setStore] = createStore({
    stepsExpanded: {} as Record<string, boolean>,
    turnLimit: 30,
    loadingMore: false,
  })

  const sessionId = createMemo(() => props.sessionId)
  const projectDirectory = createMemo(() => props.projectDirectory ?? props.directory)
  const sessionInfo = createMemo(() => {
    const id = sessionId()
    if (!id) return
    return sync.session.get(id)
  })
  const sessionDirectory = createMemo(() => sessionInfo()?.directory)

  // Directory matching
  const expectedDirectory = createMemo(() => props.directory)
  const sdkDirectoryMatches = createMemo(() => expectedDirectory() !== "" && sdk.directory === expectedDirectory())

  const sessionKey = createMemo(() =>
    makeSessionKey({ paneId: props.paneId, directory: props.directory, sessionId: sessionId() }),
  )
  const contextKey = createMemo(() => makeContextKey({ paneId: props.paneId, directory: props.directory }))
  const viewKey = createMemo(() => makeViewKey({ paneId: props.paneId, directory: props.directory }))

  // Tabs for context panel
  const tabs = createMemo(() => layout.tabs(contextKey()))
  const activeTab = createMemo(() => tabs().active())

  // Todos
  const todos = createMemo(() => {
    const id = sessionId()
    return id ? (sync.data.todo[id] ?? []) : []
  })

  // Session messages hook
  const sessionMessages = useSessionMessages({
    sessionId,
  })

  const renderedUserMessages = createMemo(() => {
    const messages = sessionMessages.visibleUserMessages()
    const limit = store.turnLimit
    if (limit <= 0) return []
    if (messages.length <= limit) return messages
    return messages.slice(messages.length - limit)
  })

  // Focus state
  const isFocused = createMemo(() => props.isFocused?.() ?? true)

  // Header overlay hook
  const headerOverlay = useHeaderOverlay({
    mode: "overlay",
    isFocused,
  })
  const paneDraggable = props.paneId ? createDraggable(props.paneId) : undefined
  const paneDroppable = props.paneId ? createDroppable(props.paneId) : undefined
  const paneDragHandlers = paneDraggable ? paneDraggable.dragActivators : {}

  // Session sync hook
  useSessionSync({
    sessionId,
    directoryMatches: sdkDirectoryMatches,
  })

  createEffect(() => {
    const onWorktreeChange = props.onWorktreeChange
    if (!onWorktreeChange) return
    const directory = sessionDirectory()
    if (!directory) return
    const projectDir = projectDirectory()
    if (directory === projectDir) {
      if (props.worktree === undefined) return
      onWorktreeChange(undefined)
      return
    }
    if (props.worktree === directory) return
    onWorktreeChange(directory)
  })

  // Status
  const idle = { type: "idle" as const }
  const status = createMemo(() => sync.data.session_status[sessionId() ?? ""] ?? idle)
  const working = createMemo(
    () => status().type !== "idle" && sessionMessages.activeMessage()?.id === sessionMessages.lastUserMessage()?.id,
  )

  createEffect(() => {
    const session = sessionId()
    if (!session) return

    const visible = renderedUserMessages()
    if (visible.length === 0) return

    const visibleIds = new Set(visible.map((m) => m.id))
    const messages = sync.data.message[session] ?? []
    for (const msg of messages) {
      if (msg.role === "user" && visibleIds.has(msg.id)) {
        void sync.session.ensureParts(session, msg.id)
        continue
      }

      if ("parentID" in msg && visibleIds.has(msg.parentID)) {
        void sync.session.ensureParts(session, msg.id)
      }
    }
  })

  createEffect(
    on(
      () => working(),
      (isWorking, prevWorking) => {
        if (isWorking) return
        if (!prevWorking) return
        const id = sessionMessages.lastUserMessage()?.id
        if (!id) return
        setStore("stepsExpanded", id, false)
      },
    ),
  )

  createEffect(
    on(
      () => sessionId(),
      (id) => {
        if (!id) return
        setStore("turnLimit", 30)
      },
      { defer: true },
    ),
  )

  createEffect(() => {
    if (!isFocused()) return
    const id = sessionId()
    if (!id) return
    notification.session.markViewed(id)
  })

  // Session commands (only if enabled/focused)
  useSessionCommands({
    sessionId,
    viewKey,
    tabsKey: sessionKey,
    isEnabled: isFocused,
    onNavigateMessage: sessionMessages.navigateByOffset,
    onToggleSteps: () => {
      const id = sessionMessages.activeMessage()?.id
      if (!id) return
      setStore("stepsExpanded", id, (x) => !x)
    },
    onResetMessageToLast: sessionMessages.resetToLast,
    setActiveMessage: (msg) => sessionMessages.setActiveMessage(msg as UserMessage | undefined),
    userMessages: sessionMessages.userMessages,
    visibleUserMessages: sessionMessages.visibleUserMessages,
  })

  const sessionTurnPadding = () => "pb-0"

  // Auto-scroll: keep new user messages aligned to the top while tracking bottom state
  const [scrollContainer, setScrollContainer] = createSignal<HTMLDivElement>()
  const [contentContainer, setContentContainer] = createSignal<HTMLDivElement>()
  const [isAtBottom, setIsAtBottom] = createSignal(true)
  const [containerHeight, setContainerHeight] = createSignal(0)
  const [topAnchorId, setTopAnchorId] = createSignal<string | undefined>(undefined)
  const topAnchorGap = 16
  const autoScroll = createAutoScroll({
    working: isAtBottom,
  })

  const updateIsAtBottom = (el: HTMLElement) => {
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 50)
  }

  const setScrollRef = (el: HTMLDivElement | undefined) => {
    setScrollContainer(el)
    autoScroll.scrollRef(el)
    setContainerHeight(el?.clientHeight ?? 0)
  }

  const getMessageOffsetTop = (messageId: string, container: HTMLElement) => {
    const escaped =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(messageId)
        : messageId.replaceAll('"', '\\"')
    const el = container.querySelector(`[data-message-id="${escaped}"]`) as HTMLElement | null
    if (!el) return
    const a = el.getBoundingClientRect()
    const b = container.getBoundingClientRect()
    return a.top - b.top + container.scrollTop
  }

  const scrollToMessageTop = (messageId: string, behavior: ScrollBehavior = "auto") => {
    const container = scrollContainer()
    if (!container) return
    const offsetTop = getMessageOffsetTop(messageId, container)
    if (offsetTop === undefined) return
    const top = Math.max(0, offsetTop - topAnchorGap)
    container.scrollTo({ top, behavior })
    updateIsAtBottom(container)
  }

  const clampTopAnchorScroll = (container: HTMLElement) => {
    const anchorId = topAnchorId()
    if (!anchorId) return
    const offsetTop = getMessageOffsetTop(anchorId, container)
    if (offsetTop === undefined) return
    const maxRealScrollTop = Math.max(0, container.scrollHeight - topAnchorSpacerHeight() - container.clientHeight)
    const targetTop = Math.max(0, offsetTop - topAnchorGap)
    const maxAllowed = Math.max(maxRealScrollTop, targetTop)
    if (container.scrollTop > maxAllowed) {
      container.scrollTop = maxAllowed
    }
  }

  createEffect(() => {
    const container = scrollContainer()
    if (!container) return
    const observer = new ResizeObserver(() => {
      setContainerHeight(container.clientHeight)
      if (!isAtBottom()) return
      autoScroll.forceScrollToBottom()
    })
    observer.observe(container)
    return () => observer.disconnect()
  })

  createEffect(() => {
    const container = scrollContainer()
    const content = contentContainer()
    if (!container || !content) return
    const observer = new ResizeObserver(() => {
      clampTopAnchorScroll(container)
      updateIsAtBottom(container)
    })
    observer.observe(content)
    return () => observer.disconnect()
  })

  createEffect(
    on(
      () => sessionMessages.lastUserMessage()?.id,
      (id, prevId) => {
        if (!id) {
          setTopAnchorId(undefined)
          return
        }
        if (!prevId) {
          if (sessionMessages.visibleUserMessages().length !== 1) return
          setTopAnchorId(id)
          setIsAtBottom(false)
          requestAnimationFrame(() => {
            scrollToMessageTop(id, "smooth")
          })
          return
        }
        if (id <= prevId) return
        setTopAnchorId(id)
        setIsAtBottom(false)
        requestAnimationFrame(() => {
          scrollToMessageTop(id, "smooth")
        })
      },
      { defer: true },
    ),
  )

  createEffect(
    on(
      () => sessionId(),
      () => {
        setTopAnchorId(undefined)
      },
    ),
  )

  // Scroll to bottom when session loads
  createEffect(
    on(
      () => sessionId(),
      () => {
        const container = scrollContainer()
        if (container) {
          requestAnimationFrame(() => {
            autoScroll.forceScrollToBottom()
            setIsAtBottom(true)
          })
        }
      },
    ),
  )

  // Todo footer collapse state
  const [todoCollapsed, setTodoCollapsed] = createSignal(false)

  // Context panel state with enter/exit animation support
  const [contextPanelState, setContextPanelState] = createSignal<"closed" | "entering" | "open" | "closing">("closed")

  createEffect(
    on(
      () => activeTab() === "context",
      (isOpen, wasOpen) => {
        if (isOpen && !wasOpen) {
          // Opening - first mount in "entering" state, then transition to "open"
          setContextPanelState("entering")
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setContextPanelState("open")
            })
          })
        } else if (!isOpen && wasOpen) {
          // Closing - trigger exit animation
          setContextPanelState("closing")
          setTimeout(() => {
            setContextPanelState("closed")
          }, 200) // Match animation duration
        }
      },
    ),
  )

  const closeContextPanel = () => {
    tabs().setActive(undefined)
  }

  // Dynamic spacer height based on todo count and collapse state
  const todoSpacerHeight = createMemo(() => {
    const activeTodos = todos().filter((t) => t.status !== "completed")
    if (activeTodos.length === 0) return 0
    const baseHeight = 50 // header + container padding + border
    const itemHeight = 24
    if (todoCollapsed()) {
      // When collapsed, only in-progress item is visible
      const hasInProgress = activeTodos.some((t) => t.status === "in_progress")
      return baseHeight + (hasInProgress ? itemHeight : 0)
    }
    // When expanded, show all items (capped by CSS max-height of 160px ~= 6 items)
    const itemCount = Math.min(activeTodos.length, 6)
    return baseHeight + itemCount * itemHeight
  })

  const topAnchorSpacerHeight = createMemo(() => {
    if (!topAnchorId()) return 0
    return Math.max(0, containerHeight())
  })

  const handleMessageSelect = (message: UserMessage) => {
    const visible = sessionMessages.visibleUserMessages()
    const index = visible.findIndex((m) => m.id === message.id)
    const needed = index === -1 ? 0 : visible.length - index
    const expandsWindow = needed > store.turnLimit
    if (expandsWindow) setStore("turnLimit", needed + 5)

    const isLastMessage = message.id === sessionMessages.lastUserMessage()?.id
    sessionMessages.setActiveMessage(message)

    const container = scrollContainer()
    const atBottom = container ? container.scrollHeight - container.scrollTop - container.clientHeight < 50 : false

    // Skip scrolling if clicking last message while already at bottom
    if (isLastMessage && atBottom) return

    // Scroll to the message element
    requestAnimationFrame(() => {
      const container = scrollContainer()
      if (!container) return

      // For last message, scroll to bottom instead of scrollIntoView
      // (scrollIntoView with block:start causes visual glitch when there's not enough content below)
      if (isLastMessage) {
        container.scrollTop = container.scrollHeight
        setIsAtBottom(true)
        return
      }

      const el = container.querySelector(`[data-message-id="${message.id}"]`) as HTMLElement | null
      if (el) {
        // Use manual scroll instead of scrollIntoView to avoid ancestor scroll shifts
        const a = el.getBoundingClientRect()
        const b = container.getBoundingClientRect()
        const top = a.top - b.top + container.scrollTop
        container.scrollTop = top
        updateIsAtBottom(container)
      }
    })
  }

  // New session view
  const NewSessionView = () => (
    <div class="relative size-full flex flex-col pb-45 justify-end items-start gap-4 flex-[1_0_0] self-stretch max-w-200 mx-auto px-6">
      <div class="text-20-medium text-text-weaker">New session</div>
      <div class="flex justify-center items-center gap-3">
        <Icon name="folder" size="small" />
        <div class="text-12-medium text-text-weak">
          {getDirectory(sync.data.path.directory)}
          <span class="text-text-strong">{getFilename(sync.data.path.directory)}</span>
        </div>
      </div>
      <Show when={sync.project}>
        {(project) => (
          <div class="flex justify-center items-center gap-3">
            <Icon name="pencil-line" size="small" />
            <div class="text-12-medium text-text-weak">
              Last modified&nbsp;
              <span class="text-text-strong">
                {DateTime.fromMillis(project().time.updated ?? project().time.created).toRelative()}
              </span>
            </div>
          </div>
        )}
      </Show>
      <div class="pointer-events-none absolute inset-x-0 bottom-0 pb-6">
        <div class="pointer-events-auto mx-auto w-full max-w-200 px-6 flex justify-end">
          <ThemeDropup />
        </div>
      </div>
    </div>
  )

  // Desktop session content
  const DesktopSessionContent = () => (
    <Show when={sessionId()} fallback={<NewSessionView />}>
      <div class="relative h-full min-h-0">
        {/* Main session content - always visible */}
        <div class="flex items-stretch justify-start h-full min-h-0">
          <SessionMessageRail
            messages={sessionMessages.visibleUserMessages()}
            current={sessionMessages.activeMessage()}
            onMessageSelect={handleMessageSelect}
            wide={true}
          />
          <div
            ref={setScrollRef}
            class={`${sessionTurnPadding()} flex-1 min-w-0 min-h-0 overflow-y-auto no-scrollbar`}
            onScroll={(e) => {
              autoScroll.handleScroll()
              const el = e.target as HTMLElement
              clampTopAnchorScroll(el)
              updateIsAtBottom(el)
            }}
          >
            <div
              ref={setContentContainer}
              class="flex min-h-full flex-col"
            >
              <div class="flex flex-col gap-4 pt-6">
                <For each={renderedUserMessages()}>
                  {(message) => (
                    <div data-message-id={message.id}>
                      <SessionTurn
                        sessionID={sessionId()!}
                        messageID={message.id}
                        lastUserMessageID={sessionMessages.lastUserMessage()?.id}
                        stepsExpanded={store.stepsExpanded[message.id] ?? false}
                        onStepsExpandedToggle={() => setStore("stepsExpanded", message.id, (x) => !x)}
                        hideTitle={true}
                        actions={{
                          onEdit: messageActions.editMessage,
                          onRestore: messageActions.restoreCheckpoint,
                          onRetry: messageActions.retryMessage,
                          onDelete: messageActions.deleteMessage,
                        }}
                        classes={{
                          root: "min-w-0 w-full relative !h-auto",
                          content: "flex flex-col justify-between !overflow-visible !h-auto [&_[data-slot=session-turn-message-content]]:!mt-0",
                          container: "w-full max-w-200 mx-auto px-6",
                        }}
                      />
                    </div>
                  )}
                </For>
              </div>
              {/* Spacer to prevent content from being hidden behind sticky todo footer */}
              <Show when={todoSpacerHeight() > 0}>
                <div class="shrink-0" style={{ height: `${todoSpacerHeight()}px` }} />
              </Show>
              <Show when={topAnchorSpacerHeight() > 0}>
                <div class="shrink-0" style={{ height: `${topAnchorSpacerHeight()}px` }} />
              </Show>
              {/* Flexible spacer pushes footer to bottom for short content */}
              <div class="flex-1" />
              {/* Todo footer - sticky at bottom, hides when all complete */}
              <SessionTodoFooter
                todos={todos()}
                collapsed={todoCollapsed()}
                onToggleCollapse={() => setTodoCollapsed((c) => !c)}
              />
            </div>
          </div>
        </div>

        {/* Context panel overlay - slides in from right */}
        <Show when={contextPanelState() !== "closed"}>
          {/* Backdrop */}
          <div
            class="context-panel-backdrop absolute inset-0 bg-black/20 z-40"
            data-state={contextPanelState()}
            onClick={closeContextPanel}
          />
          {/* Panel */}
          <div
            class="context-panel absolute top-0 right-0 bottom-0 w-[min(400px,85%)] z-50 bg-surface-raised-stronger-non-alpha border-l border-border-base shadow-lg flex flex-col"
            data-state={contextPanelState()}
          >
            <div class="flex items-center justify-between px-4 py-3 border-b border-border-base shrink-0">
              <div class="text-14-medium text-text-strong">Context</div>
              <button
                type="button"
                class="p-1 rounded hover:bg-surface-raised-base-hover text-text-weak hover:text-text-strong"
                onClick={closeContextPanel}
              >
                <Icon name="close" size="small" />
              </button>
            </div>
            <div class="flex-1 min-h-0 overflow-hidden">
              <ContextTab
                sessionId={sessionId()!}
                sessionInfo={sessionInfo()}
              />
            </div>
          </div>
        </Show>
      </div>
    </Show>
  )

  const containerClass = "relative size-full flex flex-col overflow-hidden transition-all duration-150"
  const containerStyle = () => (hasMultiplePanes() && !isFocused() ? { opacity: 0.5 } : undefined)

  const handleMultiPaneMouseDown = (event: MouseEvent) => {
    if (!props.paneId) return
    const target = event.target as HTMLElement
    const isInteractive = target.closest('button, input, select, textarea, [contenteditable], [role="button"]')
    if (!isInteractive) {
      multiPane.setFocused(props.paneId)
    }
  }

  function setContainerRef(el: HTMLDivElement) {
    headerOverlay.containerRef(el)
    if (paneDroppable) paneDroppable.ref(el)
  }

  function setHeaderDragRef(el: HTMLDivElement) {
    if (paneDraggable) paneDraggable.ref(el)
  }

  return (
    <div
      ref={setContainerRef}
      class={containerClass}
      style={containerStyle()}
      onMouseDown={handleMultiPaneMouseDown}
      onMouseEnter={headerOverlay.handleMouseEnter}
      onMouseLeave={headerOverlay.handleMouseLeave}
      onMouseMove={headerOverlay.handleMouseMove}
    >
      <Show when={hasMultiplePanes()}>
        <div
          class="pointer-events-none absolute inset-0 z-30 border transition-opacity duration-150"
          classList={{
            "border-border-accent-base": isFocused(),
            "border-border-strong-base": !isFocused(),
            "opacity-0": multiPane.maximizedPaneId() === props.paneId,
          }}
        />
      </Show>

      {/* Header */}
      <div
        ref={setHeaderDragRef}
        class="absolute top-0 left-0 right-0 z-40 transition-opacity duration-150"
        classList={{
          "opacity-100 pointer-events-auto": headerOverlay.showHeader(),
          "opacity-0 pointer-events-none": !headerOverlay.showHeader(),
          "cursor-grab": !!paneDraggable,
          "cursor-grabbing": paneDraggable?.isActiveDraggable,
        }}
        {...paneDragHandlers}
        onMouseDown={(e) => {
          // Allow right-click to bubble up to the pane grid so the radial dial
          // can open even when the cursor is over the header overlay.
          if (e.button === 2) return
          e.stopPropagation()
        }}
        onMouseEnter={() => headerOverlay.setIsOverHeader(true)}
        onMouseLeave={() => headerOverlay.setIsOverHeader(false)}
        onFocusIn={() => headerOverlay.setHeaderHasFocus(true)}
        onFocusOut={(e) => {
          const relatedTarget = e.relatedTarget as HTMLElement | null
          if (!e.currentTarget.contains(relatedTarget)) {
            headerOverlay.setHeaderHasFocus(false)
          }
        }}
      >
        <SessionPaneHeader
          paneId={props.paneId}
          directory={props.directory}
          projectDirectory={props.projectDirectory}
          sessionId={sessionId()}
          isFocused={isFocused}
          onSessionChange={props.onSessionChange}
          onDirectoryChange={props.onDirectoryChange}
          onClose={props.onClose}
        />
      </div>

      <div class="relative z-10 flex-1 min-h-0 flex flex-col">
        {/* Mobile view */}
        <MobileView
          sessionId={sessionId()}
          visibleUserMessages={sessionMessages.visibleUserMessages}
          lastUserMessage={sessionMessages.lastUserMessage}
          working={working}
          messageActions={{
            onEdit: messageActions.editMessage,
            onRestore: messageActions.restoreCheckpoint,
            onRetry: messageActions.retryMessage,
            onDelete: messageActions.deleteMessage,
          }}
          newSessionView={NewSessionView}
        />

        {/* Desktop view */}
        <div class="flex-1 min-h-0 flex">
          <div class="@container relative shrink-0 py-3 flex flex-col gap-6 min-h-0 h-full w-full">
            <div class="flex-1 min-h-0 overflow-hidden">
              <DesktopSessionContent />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export { SessionPaneHeader } from "./header"
export { ContextTab } from "./context-tab"
export { MobileView } from "./mobile-view"
