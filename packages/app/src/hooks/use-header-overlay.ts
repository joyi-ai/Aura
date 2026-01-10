import { createMemo, createSignal, type Accessor } from "solid-js"

export type HeaderMode = "scroll" | "overlay"

export interface UseHeaderOverlayOptions {
  mode: HeaderMode
  isFocused?: Accessor<boolean>
}

export interface UseHeaderOverlayReturn {
  containerRef: (el: HTMLDivElement) => void
  headerRef: (el: HTMLDivElement) => void
  showHeader: Accessor<boolean>
  setIsHovering: (value: boolean) => void
  setIsNearTop: (value: boolean) => void
  setHeaderHasFocus: (value: boolean) => void
  setIsOverHeader: (value: boolean) => void
  handleMouseMove: (e: MouseEvent) => void
  handleMouseEnter: () => void
  handleMouseLeave: () => void
}

export function useHeaderOverlay(options: UseHeaderOverlayOptions): UseHeaderOverlayReturn {
  const [isHovering, setIsHovering] = createSignal(false)
  const [isNearTop, setIsNearTop] = createSignal(false)
  const [headerHasFocus, setHeaderHasFocus] = createSignal(false)
  const [isOverHeader, setIsOverHeader] = createSignal(false)
  let containerEl: HTMLDivElement | undefined

  // In scroll mode, header is always visible
  // In overlay mode, show header when: (mouse over header) OR (not focused AND hovering) OR (near top) OR (header has focus-within)
  const showHeader = createMemo(() => {
    if (options.mode === "scroll") return true
    if (headerHasFocus()) return true
    if (isOverHeader()) return true
    const focused = options.isFocused?.() ?? true
    if (!focused && isHovering()) return true
    if (isNearTop()) return true
    return false
  })

  function handleMouseMove(e: MouseEvent) {
    if (options.mode === "scroll") return
    if (!containerEl) return
    const rect = containerEl.getBoundingClientRect()
    const relativeY = e.clientY - rect.top
    setIsNearTop(relativeY <= 40)
  }

  function handleMouseEnter() {
    setIsHovering(true)
  }

  function handleMouseLeave() {
    setIsHovering(false)
    setIsNearTop(false)
  }

  function containerRef(el: HTMLDivElement) {
    containerEl = el
  }

  function headerRef(_el: HTMLDivElement) {
    // Reserved for future use
  }

  return {
    containerRef,
    headerRef,
    showHeader,
    setIsHovering,
    setIsNearTop,
    setHeaderHasFocus,
    setIsOverHeader,
    handleMouseMove,
    handleMouseEnter,
    handleMouseLeave,
  }
}
