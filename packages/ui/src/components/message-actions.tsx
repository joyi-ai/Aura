import { Show, splitProps, type ComponentProps } from "solid-js"
import { IconButton } from "./icon-button"

export type MessageActionHandlers = {
  onEdit?: () => void
  onRetry?: () => void
  onDelete?: () => void
}

export function MessageActions(props: ComponentProps<"div"> & MessageActionHandlers) {
  const [local, others] = splitProps(props, ["onEdit", "onRetry", "onDelete", "class", "classList"])
  const hasEdit = () => !!local.onEdit
  const hasRetry = () => !!local.onRetry
  const hasDelete = () => !!local.onDelete
  const hasActions = () => hasEdit() || hasRetry() || hasDelete()

  return (
    <Show when={hasActions()}>
      <div
        {...others}
        data-component="message-actions"
        classList={{
          ...(local.classList ?? {}),
          [local.class ?? ""]: !!local.class,
        }}
      >
        <Show when={hasEdit()}>
          <IconButton
            variant="ghost"
            icon="edit-small-2"
            aria-label="Edit message"
            title="Edit"
            onClick={() => local.onEdit?.()}
          />
        </Show>
        <Show when={hasRetry()}>
          <IconButton
            variant="ghost"
            icon="chevron-double-right"
            aria-label="Retry message"
            title="Retry"
            onClick={() => local.onRetry?.()}
          />
        </Show>
        <Show when={hasDelete()}>
          <IconButton
            variant="ghost"
            icon="circle-x"
            aria-label="Delete message"
            title="Delete"
            onClick={() => local.onDelete?.()}
          />
        </Show>
      </div>
    </Show>
  )
}
