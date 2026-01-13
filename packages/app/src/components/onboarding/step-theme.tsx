import { Dialog as Kobalte } from "@kobalte/core/dialog"
import { createMemo, createSignal, For, Show } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Icon } from "@opencode-ai/ui/icon"
import { useTheme } from "@opencode-ai/ui/theme"
import type { ColorScheme, GradientMode, GradientColor } from "@opencode-ai/ui/theme/context"
import { useOnboarding } from "./context"
import { AdvancedThemePanel } from "../advanced-theme-panel"
import "./step-theme.css"

const COLOR_SCHEMES: { id: ColorScheme; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
]

const GRADIENT_MODES: { id: GradientMode; label: string }[] = [
  { id: "soft", label: "Soft" },
  { id: "crisp", label: "Crisp" },
]

const GRADIENT_COLORS: { id: GradientColor; label: string }[] = [
  { id: "relative", label: "Relative" },
  { id: "strong", label: "Strong" },
]

export function StepTheme() {
  const onboarding = useOnboarding()
  const theme = useTheme()
  const [advancedOpen, setAdvancedOpen] = createSignal(false)

  const items = createMemo(() =>
    Object.entries(theme.themes())
      .map(([id, definition]) => ({
        id,
        name: definition.name ?? id,
      }))
      .toSorted((a, b) => a.name.localeCompare(b.name)),
  )

  const handleThemeSelect = (themeId: string) => {
    theme.setTheme(themeId)
    theme.cancelPreview()
  }

  const handleContinue = () => {
    theme.cancelPreview()
    onboarding.nextStep()
  }

  const handleBack = () => {
    theme.cancelPreview()
    onboarding.prevStep()
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      theme.cancelPreview()
    }
  }

  return (
    <Show when={onboarding.active() && onboarding.step() === 2}>
      <Kobalte open={true} onOpenChange={handleOpenChange} modal={false}>
        <Kobalte.Portal>
          <div data-component="onboarding-theme-panel">
            <Kobalte.Content data-slot="panel-content">
              <div data-slot="panel-header">
                <Kobalte.Title data-slot="panel-title">Choose Your Theme</Kobalte.Title>
                <IconButton icon="close" variant="ghost" onClick={handleContinue} />
              </div>

              <div data-slot="panel-body">
                <div data-slot="section">
                  <label data-slot="section-label">Appearance</label>
                  <div data-slot="scheme-buttons">
                    <For each={COLOR_SCHEMES}>
                      {(scheme) => {
                        const selected = () => scheme.id === theme.colorScheme()
                        return (
                          <Button
                            size="small"
                            variant={selected() ? "secondary" : "ghost"}
                            class="flex-1 justify-center"
                            onClick={() => theme.setColorScheme(scheme.id)}
                          >
                            {scheme.label}
                          </Button>
                        )
                      }}
                    </For>
                  </div>
                </div>

                <div data-slot="section">
                  <label data-slot="section-label">Gradient</label>
                  <div data-slot="scheme-buttons" onMouseLeave={() => theme.cancelGradientModePreview()}>
                    <For each={GRADIENT_MODES}>
                      {(mode) => {
                        const selected = () => mode.id === theme.gradientMode()
                        return (
                          <Button
                            size="small"
                            variant={selected() ? "secondary" : "ghost"}
                            class="flex-1 justify-center"
                            onClick={() => theme.setGradientMode(mode.id)}
                            onMouseEnter={() => theme.previewGradientMode(mode.id)}
                          >
                            {mode.label}
                          </Button>
                        )
                      }}
                    </For>
                  </div>
                </div>

                <div data-slot="section">
                  <label data-slot="section-label">Color</label>
                  <div data-slot="scheme-buttons" onMouseLeave={() => theme.cancelGradientColorPreview()}>
                    <For each={GRADIENT_COLORS}>
                      {(color) => {
                        const selected = () => color.id === theme.gradientColor()
                        return (
                          <Button
                            size="small"
                            variant={selected() ? "secondary" : "ghost"}
                            class="flex-1 justify-center"
                            onClick={() => theme.setGradientColor(color.id)}
                            onMouseEnter={() => theme.previewGradientColor(color.id)}
                          >
                            {color.label}
                          </Button>
                        )
                      }}
                    </For>
                  </div>
                </div>

                <div data-slot="section">
                  <label data-slot="section-label">Theme</label>
                  <div data-slot="theme-list" onMouseLeave={() => theme.cancelThemePreview()}>
                    <For each={items()}>
                      {(item) => {
                        const selected = () => item.id === theme.themeId()
                        return (
                          <Button
                            size="normal"
                            variant={selected() ? "secondary" : "ghost"}
                            class="justify-between px-2"
                            onClick={() => handleThemeSelect(item.id)}
                            onMouseEnter={() => theme.previewTheme(item.id)}
                          >
                            <span class="truncate">{item.name}</span>
                            <Show when={selected()}>
                              <Icon name="check-small" size="small" class="text-text-accent-base" />
                            </Show>
                          </Button>
                        )
                      }}
                    </For>
                  </div>
                </div>

                <Button size="small" variant="ghost" class="justify-center mt-2" onClick={() => setAdvancedOpen(true)}>
                  Advanced Customization
                </Button>
              </div>

              <div data-slot="panel-footer">
                <Button variant="ghost" size="small" onClick={handleBack}>
                  Back
                </Button>
                <Button variant="primary" size="small" onClick={handleContinue}>
                  Continue
                </Button>
              </div>
            </Kobalte.Content>
          </div>
        </Kobalte.Portal>
      </Kobalte>

      <AdvancedThemePanel open={advancedOpen()} onOpenChange={setAdvancedOpen} editGradient={null} />
    </Show>
  )
}
