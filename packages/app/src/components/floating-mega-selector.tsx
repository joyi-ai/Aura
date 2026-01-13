import { Component, createMemo, For, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { useLocal } from "@/context/local"
import { useFloatingSelector } from "@/context/floating-selector"

// Prevent focus steal on mousedown
const preventFocus = (e: MouseEvent) => e.preventDefault()

// ============================================================================
// Floating Card Clusters Selector
// ============================================================================
const FloatingCardClusters: Component = () => {
  const local = useLocal()
  const floatingSelector = useFloatingSelector()

  const modes = createMemo(() => local.mode.list())
  const agents = createMemo(() => local.agent.list())
  const models = createMemo(() => local.model.list().slice(0, 5))
  const variants = createMemo(() => local.model.variant.list())

  const currentMode = createMemo(() => local.mode.current())
  const currentAgent = createMemo(() => local.agent.current())
  const currentModel = createMemo(() => local.model.current())
  const currentVariant = createMemo(() => local.model.variant.current())

  return (
    <div
      class="flex gap-3 p-3 bg-[var(--surface-raised-stronger-non-alpha)] rounded-lg border border-[var(--border-base)] shadow-lg"
      onMouseDown={preventFocus}
    >
      {/* Modes Card */}
      <div class="flex flex-col gap-1 min-w-[100px]">
        <div class="text-[10px] uppercase text-[var(--text-subtle)] px-2">Modes</div>
        <div class="flex flex-col">
          <For each={modes()}>
            {(mode) => {
              const handleClick = () => local.mode.set(mode.id)
              return (
                <button
                  tabIndex={-1}
                  class="px-2 py-1 text-left text-[12px] rounded hover:bg-[var(--surface-raised-base-hover)] transition-colors"
                  classList={{
                    "bg-[var(--surface-info-base)] text-[var(--text-info-base)]": currentMode()?.id === mode.id,
                    "text-[var(--text-strong)]": currentMode()?.id !== mode.id,
                  }}
                  onClick={handleClick}
                  onMouseEnter={() => floatingSelector.setHoveredAction(handleClick)}
                  onMouseLeave={() => floatingSelector.setHoveredAction(null)}
                >
                  {mode.name}
                </button>
              )
            }}
          </For>
        </div>
      </div>

      {/* Agents Card */}
      <div class="flex flex-col gap-1 min-w-[80px]">
        <div class="text-[10px] uppercase text-[var(--text-subtle)] px-2">Agents</div>
        <div class="flex flex-col">
          <For each={agents()}>
            {(agent) => {
              const handleClick = () => local.agent.set(agent.name)
              return (
                <button
                  tabIndex={-1}
                  class="px-2 py-1 text-left text-[12px] rounded capitalize hover:bg-[var(--surface-raised-base-hover)] transition-colors"
                  classList={{
                    "bg-[var(--surface-info-base)] text-[var(--text-info-base)]": currentAgent()?.name === agent.name,
                    "text-[var(--text-strong)]": currentAgent()?.name !== agent.name,
                  }}
                  onClick={handleClick}
                  onMouseEnter={() => floatingSelector.setHoveredAction(handleClick)}
                  onMouseLeave={() => floatingSelector.setHoveredAction(null)}
                >
                  {agent.name}
                </button>
              )
            }}
          </For>
        </div>
      </div>

      {/* Models Card */}
      <div class="flex flex-col gap-1 min-w-[120px]">
        <div class="text-[10px] uppercase text-[var(--text-subtle)] px-2">Models</div>
        <div class="flex flex-col">
          <For each={models()}>
            {(model) => {
              const handleClick = () => local.model.set({ modelID: model.id, providerID: model.provider.id })
              return (
                <button
                  tabIndex={-1}
                  class="px-2 py-1 text-left text-[12px] rounded hover:bg-[var(--surface-raised-base-hover)] transition-colors truncate"
                  classList={{
                    "bg-[var(--surface-info-base)] text-[var(--text-info-base)]":
                      currentModel()?.id === model.id && currentModel()?.provider.id === model.provider.id,
                    "text-[var(--text-strong)]": !(
                      currentModel()?.id === model.id && currentModel()?.provider.id === model.provider.id
                    ),
                  }}
                  onClick={handleClick}
                  onMouseEnter={() => floatingSelector.setHoveredAction(handleClick)}
                  onMouseLeave={() => floatingSelector.setHoveredAction(null)}
                >
                  {model.name}
                </button>
              )
            }}
          </For>
        </div>
      </div>

      {/* Variants Card */}
      <Show when={variants().length > 0}>
        <div class="flex flex-col gap-1 min-w-[80px]">
          <div class="text-[10px] uppercase text-[var(--text-subtle)] px-2">Variant</div>
          <div class="flex flex-col">
            {(() => {
              const handleDefaultClick = () => local.model.variant.set(undefined)
              return (
                <button
                  tabIndex={-1}
                  class="px-2 py-1 text-left text-[12px] rounded hover:bg-[var(--surface-raised-base-hover)] transition-colors"
                  classList={{
                    "bg-[var(--surface-info-base)] text-[var(--text-info-base)]": currentVariant() === undefined,
                    "text-[var(--text-strong)]": currentVariant() !== undefined,
                  }}
                  onClick={handleDefaultClick}
                  onMouseEnter={() => floatingSelector.setHoveredAction(handleDefaultClick)}
                  onMouseLeave={() => floatingSelector.setHoveredAction(null)}
                >
                  Default
                </button>
              )
            })()}
            <For each={variants()}>
              {(variant) => {
                const handleClick = () => local.model.variant.set(variant)
                return (
                  <button
                    tabIndex={-1}
                    class="px-2 py-1 text-left text-[12px] rounded capitalize hover:bg-[var(--surface-raised-base-hover)] transition-colors"
                    classList={{
                      "bg-[var(--surface-info-base)] text-[var(--text-info-base)]": currentVariant() === variant,
                      "text-[var(--text-strong)]": currentVariant() !== variant,
                    }}
                    onClick={handleClick}
                    onMouseEnter={() => floatingSelector.setHoveredAction(handleClick)}
                    onMouseLeave={() => floatingSelector.setHoveredAction(null)}
                  >
                    {variant}
                  </button>
                )
              }}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT: Floating Mega Selector
// ============================================================================
export const FloatingMegaSelector: Component = () => {
  const floatingSelector = useFloatingSelector()

  const positionStyle = createMemo(() => {
    const pos = floatingSelector.position()
    // Position above the click point
    return {
      position: "fixed" as const,
      left: `${pos.x}px`,
      top: `${pos.y}px`,
      transform: "translate(-50%, -100%)",
      "z-index": "9999",
    }
  })

  return (
    <Show when={floatingSelector.isOpen()}>
      <Portal>
        <div
          data-floating-selector
          tabIndex={-1}
          style={positionStyle()}
          class="animate-in fade-in zoom-in-95 duration-150"
          onMouseDown={preventFocus}
        >
          <FloatingCardClusters />
        </div>
      </Portal>
    </Show>
  )
}
