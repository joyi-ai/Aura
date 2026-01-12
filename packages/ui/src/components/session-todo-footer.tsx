import { type Todo } from "@opencode-ai/sdk/v2/client"
import { createMemo, For, Show } from "solid-js"
import { Icon } from "./icon"
import { Spinner } from "./spinner"
import "./session-todo-footer.css"

export interface SessionTodoFooterProps {
  todos: Todo[]
}

export function SessionTodoFooter(props: SessionTodoFooterProps) {
  // Filter out completed todos for visibility check
  const activeTodos = createMemo(() => props.todos.filter((t) => t.status !== "completed"))

  // Count by status
  const counts = createMemo(() => {
    const completed = props.todos.filter((t) => t.status === "completed").length
    return { completed, total: props.todos.length }
  })

  // Hide footer when no active todos
  const shouldShow = createMemo(() => activeTodos().length > 0)

  return (
    <Show when={shouldShow()}>
      <div data-component="session-todo-footer">
        <div data-slot="session-todo-footer-container">
          {/* Progress indicator */}
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

          {/* Todo list */}
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
        </div>
      </div>
    </Show>
  )
}
