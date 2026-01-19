import { type ParentProps } from "solid-js"
import { ProjectsList } from "./projects-list"
import { ActionButtons } from "./action-buttons"

export function BottomBar(props: ParentProps) {
  return (
    <div class="grid grid-cols-[1fr_minmax(0,2fr)_1fr] items-end gap-3 px-3">
      {/* Left: Projects list - equal column width with right */}
      <div class="justify-self-start hidden md:block">
        <ProjectsList />
      </div>

      {/* Center: Prompt (passed as children) - centered, shrinks as needed */}
      <div class="min-w-0">{props.children}</div>

      {/* Right: Action buttons - equal column width with left */}
      <div class="justify-self-end hidden md:block">
        <ActionButtons />
      </div>
    </div>
  )
}
