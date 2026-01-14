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

  // Find in-progress task (always visible)
  const inProgressTodo = createMemo(() => props.todos.find((t) => t.status === "in_progress"))

  // Other todos (animated collapse/expand)
  const otherTodos = createMemo(() => props.todos.filter((t) => t.status !== "in_progress"))

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

          {/* Todo list with animated expand/collapse */}
          <div data-slot="session-todo-footer-list">
            {/* In-progress item - always visible */}
            <Show when={inProgressTodo()}>
              <div data-slot="session-todo-footer-item" data-status="in_progress">
                <div data-slot="session-todo-footer-item-indicator">
                  <Spinner data-slot="session-todo-footer-spinner" />
                </div>
                <span data-slot="session-todo-footer-item-text">{inProgressTodo()!.content}</span>
              </div>
            </Show>

            {/* Other items - animated collapse/expand */}
            <div data-slot="session-todo-footer-other-wrapper">
              <div data-slot="session-todo-footer-other-items">
                <For each={otherTodos()}>
                  {(todo) => (
                    <div data-slot="session-todo-footer-item" data-status={todo.status}>
                      <div data-slot="session-todo-footer-item-indicator">
                        <Show when={todo.status === "completed"}>
                          <Icon name="check" size="small" />
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
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
