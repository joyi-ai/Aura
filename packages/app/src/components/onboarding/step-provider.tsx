import { Dialog as Kobalte } from "@kobalte/core/dialog"
import { createMemo, Show } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import { ProviderIcon } from "@opencode-ai/ui/provider-icon"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import type { IconName } from "@opencode-ai/ui/icons/provider"
import { List } from "@opencode-ai/ui/list"
import { useOnboarding } from "./context"
import { useProviders } from "@/hooks/use-providers"
import { DialogConnectProvider } from "../dialog-connect-provider"
import "./step-provider.css"

interface Provider {
  id: string
  icon: string
  name: string
  description: string
}

const PROVIDERS: Provider[] = [
  {
    id: "codex",
    icon: "openai",
    name: "Codex",
    description: "ChatGPT & GPT models",
  },
  {
    id: "anthropic",
    icon: "anthropic",
    name: "Claude Code",
    description: "Claude models",
  },
  {
    id: "opencode",
    icon: "opencode",
    name: "OpenCode Zen",
    description: "Free unified platform",
  },
  {
    id: "openrouter",
    icon: "openrouter",
    name: "OpenRouter",
    description: "Multi-provider gateway",
  },
  {
    id: "vercel",
    icon: "vercel",
    name: "Vercel AI Gateway",
    description: "Enterprise AI gateway",
  },
]

export function StepProvider() {
  const onboarding = useOnboarding()
  const dialog = useDialog()
  const providers = useProviders()

  const connectedIds = createMemo(() => providers.connected().map((p) => p.id))
  const hasConnected = createMemo(() => connectedIds().length > 0)
  const connectedSet = createMemo(() => new Set(connectedIds()))

  const handleSelect = (provider: Provider) => {
    onboarding.setSelectedProvider(provider.id)
    dialog.show(() => <DialogConnectProvider provider={provider.id} onBack={() => dialog.close()} />)
  }

  const handleContinue = () => {
    onboarding.nextStep()
  }

  const handleSkip = () => {
    onboarding.nextStep()
  }

  return (
    <Show when={onboarding.active() && onboarding.step() === 1}>
      <Kobalte open={true} modal={true}>
        <Kobalte.Portal>
          <Kobalte.Overlay data-component="dialog-overlay" />
          <Dialog
            title="Welcome to Aura"
            description="Select your AI provider to get started"
            class="onboarding-provider-dialog"
          >
            <List
              items={() => PROVIDERS}
              key={(p) => p?.id}
              activeIcon="plus-small"
              onSelect={(p) => {
                if (p) handleSelect(p)
              }}
            >
              {(provider) => (
                <div class="px-1.25 w-full flex items-center gap-x-3">
                  <ProviderIcon data-slot="list-item-extra-icon" id={provider.icon as IconName} />
                  <span>{provider.name}</span>
                  <span class="text-14-regular text-text-weak">{provider.description}</span>
                  <Show when={connectedSet().has(provider.id)}>
                    <Icon name="circle-check" class="size-4 text-icon-success-base" />
                  </Show>
                </div>
              )}
            </List>
            <div data-slot="dialog-footer">
              <Show
                when={hasConnected()}
                fallback={
                  <Button variant="ghost" size="small" onClick={handleSkip}>
                    Skip for now
                  </Button>
                }
              >
                <Button variant="primary" size="small" onClick={handleContinue}>
                  Continue
                </Button>
              </Show>
            </div>
          </Dialog>
        </Kobalte.Portal>
      </Kobalte>
    </Show>
  )
}
