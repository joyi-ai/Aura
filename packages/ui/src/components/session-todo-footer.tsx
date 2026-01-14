import { type Todo } from "@opencode-ai/sdk/v2/client"
import { createMemo, For, Show } from "solid-js"
import { Icon } from "./icon"
import { Spinner } from "./spinner"
import "./session-todo-footer.css"

export interface SessionTodoFooterProps {
  todos: Todo[]
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function SessionTodoFooter(props: SessionTodoFooterProps) {
  // Filter out completed todos for visibility check
  const activeTodos = createMemo(() => props.todos.filter((t) => t.status !== "completed"))

  // Count by status
  const counts = createMemo(() => {
    const completed = props.todos.filter((t) => t.status === "completed").length
    return { completed, total: props.todos.length }
  })

  // Find in-progress task for collapsed view
  const inProgressTodo = createMemo(() => props.todos.find((t) => t.status === "in_progress"))

  // Hide footer when no active todos
  const shouldShow = createMemo(() => activeTodos().length > 0)

  const collapsed = () => props.collapsed ?? false

  return (
    <Show when={shouldShow()}>
      <div data-component="session-todo-footer" data-collapsed={collapsed()}>
        <div data-slot="session-todo-footer-container">
          {/* Header with progress and collapse toggle */}
          <button data-slot="session-todo-footer-header" onClick={() => props.onToggleCollapse?.()} type="button">
            <div data-slot="session-todo-footer-progress">
              <div data-slot="session-todo-footer-progress-bar">
                <div
                  data-slot="session-todo-footer-progress-fill"
                  style={{ width: `${(counts().completed / counts().total) * 100}%` }}
                />
              </div>
              <span data-slot="session-todo-footer-progress-text">
                {counts().completed}/{counts().total}
              </span>
            </div>
            <Icon name="chevron-down" size="small" data-slot="session-todo-footer-chevron" />
          </button>

          {/* Todo list - full view when expanded */}
          <Show when={!collapsed()}>
            <div data-slot="session-todo-footer-list">
              <For each={props.todos}>
                {(todo) => (
                  <div data-slot="session-todo-footer-item" data-status={todo.status}>
                    <div data-slot="session-todo-footer-item-indicator">
                      <Show when={todo.status === "completed"}>
                        <Icon name="check" size="small" />
                      </Show>
                      <Show when={todo.status === "in_progress"}>
                        <Spinner data-slot="session-todo-footer-spinner" />
                      </Show>
                      <Show when={todo.status === "pending"}>
                        <div data-slot="session-todo-footer-item-dot" />
                      </Show>
                    </div>
                    <span data-slot="session-todo-footer-item-text">{todo.content}</span>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Collapsed view - only show in-progress task */}
          <Show when={collapsed() && inProgressTodo()}>
            <div data-slot="session-todo-footer-list">
              <div data-slot="session-todo-footer-item" data-status="in_progress">
                <div data-slot="session-todo-footer-item-indicator">
                  <Spinner data-slot="session-todo-footer-spinner" />
                </div>
                <span data-slot="session-todo-footer-item-text">{inProgressTodo()!.content}</span>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  )
}
