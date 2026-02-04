import { createSignal, onCleanup, batch, type Accessor } from "solid-js"

export interface UseSingleViewOverlayOptions {
  holdDelay?: number
  onOpen?: () => void
  onClose?: () => void
}

export interface UseSingleViewOverlayReturn {
  isOpen: Accessor<boolean>
  centerX: Accessor<number>
  centerY: Accessor<number>
  handlers: {
    onMouseDown: (e: MouseEvent) => void
    onMouseMove: (e: MouseEvent) => void
    onMouseUp: (e: MouseEvent) => void
    onContextMenu: (e: MouseEvent) => void
  }
  close: () => void
}

export function useSingleViewOverlay(options: UseSingleViewOverlayOptions): UseSingleViewOverlayReturn {
  const holdDelay = options.holdDelay ?? 50

  const [isOpen, setIsOpen] = createSignal(false)
  const [centerX, setCenterX] = createSignal(0)
  const [centerY, setCenterY] = createSignal(0)

  let holdTimer: ReturnType<typeof setTimeout> | null = null
  let isHolding = false

  function cleanup() {
    if (holdTimer) {
      clearTimeout(holdTimer)
      holdTimer = null
    }
    isHolding = false
  }

  onCleanup(cleanup)

  function handleMouseDown(e: MouseEvent) {
    if (e.button === 0) {
      if (isHolding || holdTimer) {
        cleanup()
      }
      return
    }

    if (e.button !== 2) return
    if (e.buttons & 1) return

    e.preventDefault()
    isHolding = true

    holdTimer = setTimeout(() => {
      if (isHolding) {
        batch(() => {
          setCenterX(e.clientX)
          setCenterY(e.clientY)
          setIsOpen(true)
        })
        options.onOpen?.()
      }
    }, holdDelay)
  }

  function handleMouseMove(e: MouseEvent) {
    if (isHolding || isOpen()) {
      if (e.buttons & 1) {
        cleanup()
        if (isOpen()) {
          batch(() => {
            setIsOpen(false)
          })
          options.onClose?.()
        }
        return
      }
    }
  }

  function handleMouseUp(_e: MouseEvent) {
    cleanup()
    // Note: we don't close on mouse up - the overlay stays open for interaction
    // It will be closed when user selects a session or clicks outside
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault()
  }

  function close() {
    cleanup()
    setIsOpen(false)
    options.onClose?.()
  }

  return {
    isOpen,
    centerX,
    centerY,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onContextMenu: handleContextMenu,
    },
    close,
  }
}
