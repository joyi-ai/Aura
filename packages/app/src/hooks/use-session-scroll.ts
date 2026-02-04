import { createEffect, createSignal, on, onCleanup, type Accessor } from "solid-js"

/** Breathing room below header when snapping new message to top */
const HEADER_BREATHING_ROOM = 48
/** Distance from bottom to consider "near bottom" for auto-scroll re-engagement */
const NEAR_BOTTOM_THRESHOLD = 50
/** Maximum retry attempts for snap when waiting for target message */
const MAX_SNAP_RETRIES = 10
/** Debounce delay for container resize scroll restoration (ms) */
const RESIZE_DEBOUNCE_MS = 100

export interface UseSessionScrollOptions {
  /** Whether the session is currently streaming/working */
  working: Accessor<boolean>
  /** Current composer height in pixels */
  composerHeight: Accessor<number>
  /** Signal indicating snap was requested */
  snapRequested: Accessor<boolean>
  /** Target message ID for snap (if provided, snap to this specific message) */
  snapTargetId: Accessor<string | undefined>
  /** Clear the snap request after handling */
  clearSnapRequest: () => void
  /** Callback when user scrolls away during streaming */
  onUserScrolledAway: (value: boolean) => void
  /** Optional callback when content height changes */
  onContentResize?: () => void
}

export interface UseSessionScrollResult {
  /** Ref setter for the scroll container */
  scrollRef: (el: HTMLElement | undefined) => void
  /** Ref setter for the content container (observed for resize) */
  contentRef: (el: HTMLElement | undefined) => void
  /** Handle scroll events (call from onScroll) */
  handleScroll: (e: Event) => void
  /** Current height of the scroll container viewport */
  containerHeight: Accessor<number>
}

export function useSessionScroll(options: UseSessionScrollOptions): UseSessionScrollResult {
  let scrollEl: HTMLElement | undefined
  let contentEl: HTMLElement | undefined
  let resizeObserver: ResizeObserver | undefined
  let containerResizeObserver: ResizeObserver | undefined
  let mutationObserver: MutationObserver | undefined
  let userScrolled = false
  let lastContentHeight = 0
  let pendingSnap = false
  let lastMessageCount = 0
  let messageCount = 0
  let mutationFrame = 0
  let resizeFrame = 0
  let retryCount = 0
  let snapInProgress = false
  let snapTargetIdValue: string | undefined
  let resizeInProgress = false
  let wasAtBottom = true // Track if user was at bottom (for resize restoration)
  let resizeDebounceTimer: ReturnType<typeof setTimeout> | undefined
  const lastMessageId = { value: "" }
  const lastMessageIdAtSnap = { value: "" }
  const [containerHeight, setContainerHeight] = createSignal(0)

  function isNearBottom() {
    if (!scrollEl) return true
    const threshold = NEAR_BOTTOM_THRESHOLD
    return scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < threshold
  }

  function scrollToBottom() {
    if (!scrollEl) return
    requestAnimationFrame(() => {
      if (!scrollEl) return
      scrollEl.scrollTop = scrollEl.scrollHeight
    })
  }

  function getMessageElements() {
    if (!scrollEl) return []
    return scrollEl.querySelectorAll("[data-message-id]")
  }

  function updateMessageState() {
    const messages = getMessageElements()
    const currentCount = messages.length
    const lastMessage = messages[messages.length - 1] as HTMLElement | undefined
    const currentId = lastMessage?.dataset.messageId ?? ""
    const countChanged = currentCount !== messageCount
    const idChanged = currentId !== lastMessageId.value
    if (!countChanged && !idChanged) return
    if (countChanged) {
      messageCount = currentCount
    }
    if (idChanged) lastMessageId.value = currentId
  }

  function snapToElement(el: HTMLElement) {
    if (!scrollEl) return
    snapInProgress = true
    // Wait for element layout to stabilize with double RAF
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!scrollEl) {
          snapInProgress = false
          return
        }
        const targetScroll = Math.max(0, el.offsetTop - HEADER_BREATHING_ROOM)
        scrollEl.scrollTo({ top: targetScroll, behavior: "smooth" })
        // Clear snapInProgress after animation completes (~300ms for smooth scroll)
        setTimeout(() => {
          snapInProgress = false
        }, 350)
      })
    })
  }

  function snapNewMessageToTop() {
    if (!scrollEl) return
    // Find the last message element
    const messages = scrollEl.querySelectorAll("[data-message-id]")
    const lastMessage = messages[messages.length - 1] as HTMLElement | undefined
    if (!lastMessage) {
      scrollToBottom()
      return
    }
    snapToElement(lastMessage)
  }

  function checkForNewMessageAndSnap() {
    if (!pendingSnap) return
    if (!scrollEl) return

    // If we have a target ID, look for that specific message
    if (snapTargetIdValue) {
      const targetEl = scrollEl.querySelector(`[data-message-id="${snapTargetIdValue}"]`) as HTMLElement | null
      if (!targetEl) {
        // Message not in DOM yet - schedule retry
        retryCount++
        if (retryCount < MAX_SNAP_RETRIES) {
          requestAnimationFrame(() => checkForNewMessageAndSnap())
          return
        }
        // Give up after max retries, fall back to last message
        pendingSnap = false
        retryCount = 0
        snapTargetIdValue = undefined
        userScrolled = false
        options.onUserScrolledAway(false)
        snapNewMessageToTop()
        return
      }
      // Found target, snap to it
      pendingSnap = false
      retryCount = 0
      snapTargetIdValue = undefined
      userScrolled = false
      options.onUserScrolledAway(false)
      snapToElement(targetEl)
      return
    }

    // Fallback to existing count/ID logic for backward compat
    const currentCount = messageCount
    const countAdvanced = currentCount > lastMessageCount
    const idChanged = lastMessageId.value !== lastMessageIdAtSnap.value
    if (!countAdvanced && !idChanged) return

    // Wait until we have more messages or the last message id changes
    if (countAdvanced || idChanged) {
      // Set pendingSnap false immediately to prevent double-snap from multiple observers
      pendingSnap = false
      userScrolled = false
      options.onUserScrolledAway(false)
      snapNewMessageToTop()
    }
  }

  function handleContentResize(entries: ResizeObserverEntry[]) {
    const entry = entries[0]
    if (!entry) return
    const newHeight = entry.contentRect.height
    const heightGrew = newHeight > lastContentHeight
    lastContentHeight = newHeight

    // Check if we should snap to new message
    if (pendingSnap && heightGrew) {
      checkForNewMessageAndSnap()
    }

    // Throttle resize callbacks to one per animation frame
    if (resizeFrame) return
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0
      options.onContentResize?.()
    })
  }

  function handleMutation() {
    // Throttle mutations to one update per animation frame
    if (mutationFrame) return
    mutationFrame = requestAnimationFrame(() => {
      mutationFrame = 0
      // Check for new messages when DOM changes
      updateMessageState()
      if (pendingSnap) {
        checkForNewMessageAndSnap()
      }
    })
  }

  function handleScroll(e: Event) {
    if (!scrollEl) return
    const el = e.target as HTMLElement
    if (el !== scrollEl) return

    // Ignore scroll events during snap animation or container resize
    if (snapInProgress || resizeInProgress) return

    // Track at-bottom state for resize restoration
    wasAtBottom = isNearBottom()

    // Check if user scrolled away during streaming
    if (options.working()) {
      if (!wasAtBottom) {
        if (!userScrolled) {
          userScrolled = true
          options.onUserScrolledAway(true)
        }
      } else if (userScrolled) {
        // User scrolled back to bottom, re-engage auto-scroll
        userScrolled = false
        options.onUserScrolledAway(false)
      }
    }
  }

  function handleWheel(e: WheelEvent) {
    // Ignore wheel events during snap animation or container resize
    if (snapInProgress || resizeInProgress) return
    // Detect intentional scroll up during streaming
    if (options.working() && e.deltaY < 0 && !userScrolled) {
      userScrolled = true
      options.onUserScrolledAway(true)
    }
  }

  function scrollRef(el: HTMLElement | undefined) {
    // Cleanup old listeners
    if (scrollEl) {
      scrollEl.removeEventListener("wheel", handleWheel)
    }
    if (mutationObserver) {
      mutationObserver.disconnect()
      mutationObserver = undefined
    }
    if (containerResizeObserver) {
      containerResizeObserver.disconnect()
      containerResizeObserver = undefined
    }

    scrollEl = el

    if (el) {
      el.addEventListener("wheel", handleWheel, { passive: true })
      // Watch for DOM changes to detect new messages
      mutationObserver = new MutationObserver(handleMutation)
      mutationObserver.observe(el, { childList: true, subtree: true })
      // Initialize message state
      const messages = getMessageElements()
      messageCount = messages.length
      lastMessageCount = messageCount
      const lastMsg = messages[messages.length - 1] as HTMLElement | undefined
      lastMessageId.value = lastMsg?.dataset.messageId ?? ""
      // Track container height for spacer calculation
      setContainerHeight(el.clientHeight)
      containerResizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (!entry) return

        // Mark resize in progress to ignore scroll events
        resizeInProgress = true
        setContainerHeight(entry.contentRect.height)

        // Debounce scroll restoration to let spacer/layout settle
        clearTimeout(resizeDebounceTimer)
        resizeDebounceTimer = setTimeout(() => {
          resizeInProgress = false
          // Restore to bottom if user was at bottom before resize started
          if (wasAtBottom && scrollEl) {
            scrollEl.scrollTop = scrollEl.scrollHeight
          }
        }, RESIZE_DEBOUNCE_MS)
      })
      containerResizeObserver.observe(el)
    }
  }

  function contentRef(el: HTMLElement | undefined) {
    // Cleanup old observer
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = undefined
    }
    contentEl = el
    if (el) {
      resizeObserver = new ResizeObserver(handleContentResize)
      resizeObserver.observe(el)
      lastContentHeight = el.getBoundingClientRect().height
    }
  }

  // Watch for snap requests reactively
  createEffect(() => {
    const requested = options.snapRequested()
    if (requested) {
      // Capture target ID before clearing (must read while signal is set)
      snapTargetIdValue = options.snapTargetId()
      // Clear the request immediately so we don't process it again
      options.clearSnapRequest()
      // Reset retry counter
      retryCount = 0
      // Snapshot current message state so we only snap on the next new message
      updateMessageState()
      lastMessageCount = messageCount
      lastMessageIdAtSnap.value = lastMessageId.value
      pendingSnap = true
      userScrolled = false
      options.onUserScrolledAway(false)
      checkForNewMessageAndSnap()
    }
  })

  // Reset user scrolled state when streaming ends
  createEffect(
    on(
      () => options.working(),
      (isWorking, wasWorking) => {
        if (!isWorking && wasWorking) {
          userScrolled = false
          options.onUserScrolledAway(false)
          pendingSnap = false
        }
      },
    ),
  )

  onCleanup(() => {
    if (scrollEl) {
      scrollEl.removeEventListener("wheel", handleWheel)
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
    if (mutationObserver) {
      mutationObserver.disconnect()
    }
    if (containerResizeObserver) {
      containerResizeObserver.disconnect()
    }
    if (mutationFrame) {
      cancelAnimationFrame(mutationFrame)
    }
    if (resizeFrame) {
      cancelAnimationFrame(resizeFrame)
    }
    if (resizeDebounceTimer) {
      clearTimeout(resizeDebounceTimer)
    }
  })

  return {
    scrollRef,
    contentRef,
    handleScroll,
    containerHeight,
  }
}
