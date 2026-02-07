import { createEffect, createMemo, createSignal, For, onCleanup, Show, batch } from "solid-js"
import { DateTime } from "luxon"
import { Portal } from "solid-js/web"
import { useGlobalSync } from "@/context/global-sync"
import { useNotification } from "@/context/notification"
import { normalizeDirectoryKey } from "@/utils/directory"
import { Icon } from "@opencode-ai/ui/icon"
import { Spinner } from "@opencode-ai/ui/spinner"
import { DiffChanges } from "@opencode-ai/ui/diff-changes"
import type { Session, Project } from "@opencode-ai/sdk/v2/client"
import "./single-view-overlay.css"

interface SingleViewOverlayProps {
  x: number
  y: number
  currentDirectory?: string
  currentWorktree?: string
  onSessionSelect: (sessionId: string, directory: string, worktree?: string) => void
  onNewSession: () => void
  onClose: () => void
}

type GroupedSession = {
  session: Session
  directory: string
  worktree?: string
}

type ProjectGroup = {
  project: Project
  directory: string
  sessions: GroupedSession[]
  isCurrent: boolean
}

function sameDirectory(a: string | undefined, b: string | undefined) {
  return normalizeDirectoryKey(a) === normalizeDirectoryKey(b)
}

function sortSessions(a: Session, b: Session) {
  const now = Date.now()
  const oneMinuteAgo = now - 60 * 1000
  const aUpdated = a.time.updated ?? a.time.created
  const bUpdated = b.time.updated ?? b.time.created
  const aRecent = aUpdated > oneMinuteAgo
  const bRecent = bUpdated > oneMinuteAgo
  if (aRecent && bRecent) return a.id.localeCompare(b.id)
  if (aRecent && !bRecent) return -1
  if (!aRecent && bRecent) return 1
  return bUpdated - aUpdated
}

function SessionItem(props: {
  session: Session
  directory: string
  worktree?: string
  isHighlighted: boolean
  onSelect: () => void
  onMouseEnter: () => void
}) {
  const notification = useNotification()
  const globalSync = useGlobalSync()
  const [relative, setRelative] = createSignal("")

  const formatRelative = (value: number | undefined) => {
    if (!value) return ""
    const valueTime = DateTime.fromMillis(value)
    const raw =
      Math.abs(valueTime.diffNow().as("seconds")) < 60
        ? "Now"
        : valueTime.toRelative({
            style: "short",
            unit: ["days", "hours", "minutes"],
          })
    if (!raw) return ""
    return raw.replace(" ago", "").replace(/ days?/, "d").replace(" min.", "m").replace(" hr.", "h")
  }

  createEffect(() => {
    const value = props.session.time.updated ?? props.session.time.created
    setRelative(formatRelative(value))
    const timer = setInterval(() => setRelative(formatRelative(value)), 60_000)
    onCleanup(() => clearInterval(timer))
  })

  const activeDirectory = createMemo(() => props.worktree ?? props.directory)
  const notifications = createMemo(() => notification.session.unseen(props.session.id))
  const hasError = createMemo(() => notifications().some((n) => n.type === "error"))
  const [sessionStore] = globalSync.child(activeDirectory())

  const hasPermissions = createMemo(() => {
    const permissions = sessionStore.permission?.[props.session.id] ?? []
    if (permissions.length > 0) return true
    const childSessions = sessionStore.session.filter((s) => s.parentID === props.session.id)
    for (const child of childSessions) {
      const childPermissions = sessionStore.permission?.[child.id] ?? []
      if (childPermissions.length > 0) return true
    }
    return false
  })

  const isWorking = createMemo(() => {
    if (hasPermissions()) return false
    const status = sessionStore.session_status[props.session.id]
    return status?.type === "busy" || status?.type === "retry"
  })

  return (
    <div
      data-session-id={props.session.id}
      class="single-view-overlay-session"
      classList={{ "single-view-overlay-session--highlighted": props.isHighlighted }}
      onClick={props.onSelect}
      onMouseEnter={props.onMouseEnter}
    >
      <div class="single-view-overlay-session__content">
        <div class="single-view-overlay-session__header">
          <span
            class="single-view-overlay-session__title"
            classList={{ "single-view-overlay-session__title--working": isWorking() }}
          >
            {props.session.title}
          </span>
          <div class="single-view-overlay-session__status">
            <Show when={isWorking()}>
              <Spinner class="size-2.5 mr-0.5" />
            </Show>
            <Show when={!isWorking() && hasPermissions()}>
              <div class="single-view-overlay-session__dot single-view-overlay-session__dot--warning" />
            </Show>
            <Show when={!isWorking() && !hasPermissions() && hasError()}>
              <div class="single-view-overlay-session__dot single-view-overlay-session__dot--error" />
            </Show>
            <Show when={!isWorking() && !hasPermissions() && !hasError() && notifications().length > 0}>
              <div class="single-view-overlay-session__dot single-view-overlay-session__dot--info" />
            </Show>
            <Show when={!isWorking() && !hasPermissions() && !hasError() && notifications().length === 0}>
              <span class="single-view-overlay-session__time">{relative()}</span>
            </Show>
          </div>
        </div>
        <Show when={props.session.summary?.files}>
          <div class="single-view-overlay-session__summary">
            <span class="single-view-overlay-session__files">
              {`${props.session.summary?.files || "No"} file${props.session.summary?.files !== 1 ? "s" : ""} changed`}
            </span>
            <Show when={props.session.summary}>{(summary) => <DiffChanges changes={summary()} />}</Show>
          </div>
        </Show>
      </div>
    </div>
  )
}

function ProjectGroupSection(props: {
  group: ProjectGroup
  highlightedId: string | null
  onSessionSelect: (session: GroupedSession) => void
  onHighlight: (id: string | null) => void
}) {
  const projectName = createMemo(() => {
    const worktree = props.group.project.worktree
    return worktree.split(/[/\\]/).pop() ?? worktree
  })

  return (
    <div class="single-view-overlay-group">
      <div class="single-view-overlay-group__header">
        <Icon name="folder" size="small" class="single-view-overlay-group__icon" />
        <span class="single-view-overlay-group__name">{projectName()}</span>
        <Show when={props.group.isCurrent}>
          <span class="single-view-overlay-group__current">current</span>
        </Show>
      </div>
      <div class="single-view-overlay-group__sessions">
        <For each={props.group.sessions}>
          {(item) => (
            <SessionItem
              session={item.session}
              directory={item.directory}
              worktree={item.worktree}
              isHighlighted={props.highlightedId === item.session.id}
              onSelect={() => props.onSessionSelect(item)}
              onMouseEnter={() => props.onHighlight(item.session.id)}
            />
          )}
        </For>
      </div>
    </div>
  )
}

export function SingleViewOverlay(props: SingleViewOverlayProps) {
  const globalSync = useGlobalSync()
  let contentRef: HTMLDivElement | undefined
  const [highlightedId, setHighlightedId] = createSignal<string | null>(null)
  const [newSessionHighlighted, setNewSessionHighlighted] = createSignal(false)

  // Group sessions by project
  const groupedSessions = createMemo(() => {
    const projects = globalSync.data.project
    const currentKey = normalizeDirectoryKey(props.currentWorktree ?? props.currentDirectory)
    const groups: ProjectGroup[] = []

    for (const project of projects) {
      const projectKey = normalizeDirectoryKey(project.worktree)
      const [store] = globalSync.child(project.worktree)

      // Get sessions for this project
      const sessions = store.session
        .filter((s) => !s.parentID && !s.time?.archived)
        .toSorted(sortSessions)
        .slice(0, 10) // Limit per project

      if (sessions.length === 0) continue

      const groupedSessionList: GroupedSession[] = sessions.map((session) => {
        // Determine if session is in a worktree
        const sessionDir = normalizeDirectoryKey(session.directory)
        const isInWorktree = sessionDir !== projectKey &&
          (project.sandboxes ?? []).some((s) => normalizeDirectoryKey(s) === sessionDir)

        return {
          session,
          directory: project.worktree,
          worktree: isInWorktree ? session.directory : undefined,
        }
      })

      const isCurrent = currentKey === projectKey ||
        (project.sandboxes ?? []).some((s) => normalizeDirectoryKey(s) === currentKey)

      groups.push({
        project,
        directory: project.worktree,
        sessions: groupedSessionList,
        isCurrent,
      })
    }

    // Sort: current project first, then alphabetically by project name
    return groups.sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1
      if (!a.isCurrent && b.isCurrent) return 1
      return a.project.worktree.localeCompare(b.project.worktree)
    })
  })

  // Get tasks in progress (busy sessions) across all projects
  const tasksInProgress = createMemo(() => {
    const tasks: Array<GroupedSession & { projectName: string }> = []

    for (const group of groupedSessions()) {
      const [store] = globalSync.child(group.directory)

      for (const item of group.sessions) {
        const status = store.session_status[item.session.id]
        if (status?.type === "busy" || status?.type === "retry") {
          const projectName = group.project.worktree.split(/[/\\]/).pop() ?? group.project.worktree
          tasks.push({ ...item, projectName })
        }
      }
    }

    return tasks
  })

  const handleSessionSelect = (item: GroupedSession) => {
    props.onSessionSelect(item.session.id, item.directory, item.worktree)
  }

  const handleNewSession = () => {
    props.onNewSession()
  }

  createEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (contentRef?.contains(target)) return
      props.onClose()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        props.onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    onCleanup(() => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    })
  })

  // Calculate position to the left of click point
  const overlayStyle = createMemo(() => {
    const maxWidth = 320
    const maxHeight = 480
    const padding = 16
    const gutter = 8

    // Position to the left of the click point
    let left = props.x - maxWidth - gutter
    let top = props.y - maxHeight / 2

    // If would go off left edge, position to the right of click instead
    if (left < padding) {
      left = props.x + gutter
    }

    // Clamp to viewport
    left = Math.max(padding, Math.min(left, window.innerWidth - maxWidth - padding))
    top = Math.max(padding, Math.min(top, window.innerHeight - maxHeight - padding))

    return {
      left: `${left}px`,
      top: `${top}px`,
      "max-width": `${maxWidth}px`,
      "max-height": `${maxHeight}px`,
    }
  })

  return (
    <Portal>
      <div class="single-view-overlay-backdrop" onClick={props.onClose} />
      <div
        ref={contentRef}
        class="single-view-overlay"
        style={overlayStyle()}
      >
        {/* New Session Button */}
        <div
          class="single-view-overlay-new"
          classList={{ "single-view-overlay-new--highlighted": newSessionHighlighted() }}
          onClick={handleNewSession}
          onMouseEnter={() => {
            setNewSessionHighlighted(true)
            setHighlightedId(null)
          }}
          onMouseLeave={() => setNewSessionHighlighted(false)}
        >
          <Icon name="plus" size="small" class="single-view-overlay-new__icon" />
          <span class="single-view-overlay-new__label">New Session</span>
        </div>

        {/* Tasks In Progress */}
        <Show when={tasksInProgress().length > 0}>
          <div class="single-view-overlay-section">
            <div class="single-view-overlay-section__header">
              <Spinner class="size-3" />
              <span class="single-view-overlay-section__title">In Progress</span>
            </div>
            <div class="single-view-overlay-section__content">
              <For each={tasksInProgress()}>
                {(item) => (
                  <div
                    class="single-view-overlay-task"
                    classList={{ "single-view-overlay-task--highlighted": highlightedId() === item.session.id }}
                    onClick={() => handleSessionSelect(item)}
                    onMouseEnter={() => {
                      setHighlightedId(item.session.id)
                      setNewSessionHighlighted(false)
                    }}
                  >
                    <div class="single-view-overlay-task__info">
                      <span class="single-view-overlay-task__title">{item.session.title}</span>
                      <span class="single-view-overlay-task__project">{item.projectName}</span>
                    </div>
                    <Spinner class="size-2.5" />
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Sessions by Project */}
        <div class="single-view-overlay-section">
          <div class="single-view-overlay-section__content">
            <Show
              when={groupedSessions().length > 0}
              fallback={
                <div class="single-view-overlay-empty">No sessions yet</div>
              }
            >
              <For each={groupedSessions()}>
                {(group) => (
                  <ProjectGroupSection
                    group={group}
                    highlightedId={highlightedId()}
                    onSessionSelect={handleSessionSelect}
                    onHighlight={(id) => {
                      setHighlightedId(id)
                      setNewSessionHighlighted(false)
                    }}
                  />
                )}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </Portal>
  )
}
