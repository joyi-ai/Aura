import { createMemo } from "solid-js"
import { useLocal } from "@tui/context/local"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"

export function DialogMode() {
  const local = useLocal()
  const dialog = useDialog()

  const options = createMemo(() =>
    local.mode.list().map((mode) => {
      const missing = local.mode.missingPlugins(mode)
      return {
        value: mode.id,
        title: mode.name,
        description: mode.description,
        footer: missing.length ? `Requires ${missing.join(", ")}` : undefined,
      }
    }),
  )

  return (
    <DialogSelect
      title="Select mode"
      current={local.mode.current().id}
      options={options()}
      onSelect={(option) => {
        const before = local.mode.current().id
        if (option.value === before) {
          dialog.clear()
          return
        }

        local.mode.set(option.value)
        if (local.mode.current().id !== before) dialog.clear()
      }}
    />
  )
}
