import { For, createMemo, Show, type JSX } from "solid-js"
import { useLayout, getAvatarColors, type LocalProject } from "@/context/layout"
import { useNotification } from "@/context/notification"
import { Avatar } from "@opencode-ai/ui/avatar"
import { truncateDirectoryPrefix, getFilename } from "@opencode-ai/util/path"
import { ProjectSessionsPopover } from "./project-sessions-popover"

function ProjectAvatar(props: {
  project: LocalProject
  class?: string
  notify?: boolean
}): JSX.Element {
  const notification = useNotification()
  const notifications = createMemo(() => notification.project.unseen(props.project.worktree))
  const hasError = createMemo(() => notifications().some((n) => n.type === "error"))
  const name = createMemo(() => props.project.name || truncateDirectoryPrefix(props.project.worktree))
  const mask = "radial-gradient(circle 5px at calc(100% - 2px) 2px, transparent 5px, black 5.5px)"
  const opencode = "4b0ea68d7af9a6031a7ffda7ad66e0cb83315750"

  return (
    <div class="relative size-6 shrink-0 rounded-sm">
      <Avatar
        fallback={name()}
        src={props.project.id === opencode ? "https://opencode.ai/favicon.svg" : props.project.icon?.url}
        {...getAvatarColors(props.project.icon?.color)}
        class={`size-full ${props.class ?? ""}`}
        style={
          notifications().length > 0 && props.notify ? { "-webkit-mask-image": mask, "mask-image": mask } : undefined
        }
      />
      <Show when={notifications().length > 0 && props.notify}>
        <div
          classList={{
            "absolute -top-0.5 -right-0.5 size-1.5 rounded-full": true,
            "bg-icon-critical-base": hasError(),
            "bg-text-interactive-base": !hasError(),
          }}
        />
      </Show>
    </div>
  )
}

function ProjectItem(props: { project: LocalProject }) {
  return (
    <ProjectSessionsPopover project={props.project}>
      <button
        type="button"
        class="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-raised-base-hover transition-colors cursor-pointer"
      >
        <ProjectAvatar project={props.project} notify />
        <span class="text-13-medium text-text-base whitespace-nowrap max-w-24 truncate">
          {props.project.name || getFilename(props.project.worktree)}
        </span>
      </button>
    </ProjectSessionsPopover>
  )
}

export function ProjectsList() {
  const layout = useLayout()
  const projects = createMemo(() => layout.projects.list())

  return (
    <div class="flex flex-wrap-reverse items-end content-end gap-1">
      <For each={projects()}>{(project) => <ProjectItem project={project} />}</For>
    </div>
  )
}
