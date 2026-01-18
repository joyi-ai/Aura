import { type ParentProps } from "solid-js"
import { ProjectsList } from "./projects-list"
import { ActionButtons } from "./action-buttons"

export function BottomBar(props: ParentProps) {
  return (
    <div class="relative px-3">
      {/* Left: Projects list - absolutely positioned */}
      <div class="absolute left-3 bottom-2 z-10">
        <ProjectsList />
      </div>

      {/* Center: Prompt (passed as children) - full width, centers itself */}
      {props.children}

      {/* Right: Action buttons - absolutely positioned */}
      <div class="absolute right-3 bottom-2 z-10">
        <ActionButtons />
      </div>
    </div>
  )
}
