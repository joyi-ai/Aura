import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Icon } from "@opencode-ai/ui/icon"

export function DialogDeleteWorktree(props: { worktreePath: string; onConfirm: () => void; onCancel?: () => void }) {
  const dialog = useDialog()

  function handleDelete() {
    props.onConfirm()
    dialog.close()
  }

  function handleCancel() {
    props.onCancel?.()
    dialog.close()
  }

  return (
    <Dialog title="Delete Worktree">
      <div class="flex flex-col gap-4 px-2.5 pb-3">
        <div class="flex items-start gap-3">
          <div class="p-2 rounded-lg bg-surface-warning-base/20">
            <Icon name="branch" size="normal" class="text-icon-warning-base" />
          </div>
          <div class="flex flex-col gap-1">
            <div class="text-14-medium text-text-strong">Delete this worktree?</div>
            <div class="text-13-regular text-text-base">
              This will remove the git worktree and its branch. Any uncommitted changes will be lost.
            </div>
            <div class="text-12-regular text-text-subtle break-all font-mono bg-surface-raised-base px-2 py-1 rounded mt-1">
              {props.worktreePath}
            </div>
          </div>
        </div>

        <div class="flex gap-2 pt-2 border-t border-border-base justify-end">
          <Button variant="ghost" size="normal" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="normal"
            class="bg-surface-critical-base hover:bg-surface-critical-base-hover"
            onClick={handleDelete}
          >
            <Icon name="close" size="small" />
            Delete worktree
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
