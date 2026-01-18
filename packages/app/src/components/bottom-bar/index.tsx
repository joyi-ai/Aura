import { type ParentProps } from "solid-js"
import { ProjectsList } from "./projects-list"
import { ActionButtons } from "./action-buttons"

export function BottomBar(props: ParentProps) {
  return (
    <div class="flex items-end gap-3 px-3">
      {/* Left: Projects list */}
      <ProjectsList />

      {/* Center: Prompt (passed as children) */}
      <div class="flex-1 min-w-0">{props.children}</div>

      {/* Right: Action buttons */}
      <ActionButtons />
    </div>
  )
}
