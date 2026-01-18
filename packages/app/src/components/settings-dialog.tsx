import { Component, Show, Match, Switch as SolidSwitch, createMemo, createSignal, onMount } from "solid-js"
import { Dialog } from "@opencode-ai/ui/dialog"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { ProgressCircle } from "@opencode-ai/ui/progress-circle"
import { Select } from "@opencode-ai/ui/select"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useVoice } from "@/context/voice"
import { usePlatform } from "@/context/platform"
import { formatKeybind } from "@/context/command"
import { useKeybindCapture } from "@/hooks/use-keybind-capture"
import { McpSettingsPanel } from "@/components/dialog-select-mcp"
import { ClaudePluginsPanel } from "@/components/settings/claude-plugins-panel"
import { OpenCodePluginsPanel } from "@/components/settings/opencode-plugins-panel"
import { SkillsPanel } from "@/components/settings/skills-panel"

export const SettingsDialogButton: Component = () => {
  const dialog = useDialog()

  return (
    <IconButton
      icon="settings-gear"
      variant="ghost"
      class="size-6"
      onClick={() => dialog.show(() => <SettingsDialog />)}
    />
  )
}

type SettingsTab = "plugins" | "mcp" | "skills" | "voice"

export type SettingsDialogProps = {
  initialTab?: SettingsTab
}

const VoiceSettingsPanel: Component = () => {
  const voice = useVoice()
  const platform = usePlatform()

  const {
    isCapturing: isCapturingKeybind,
    setIsCapturing: setIsCapturingKeybind,
    setCapturedKeybind,
    handleKeyDown: handleKeybindKeyDown,
  } = useKeybindCapture(voice.settings.keybind(), {
    onCapture: (keybind) => voice.settings.setKeybind(keybind),
  })

  const isDesktop = () => platform.platform === "desktop"
  const deviceOptions = createMemo(() => {
    const devices = voice.state.availableDevices()
    return [
      { id: "default", label: "System Default" },
      ...devices.map((device) => ({ id: device.id, label: device.label })),
    ]
  })
  const currentDevice = createMemo(() => {
    const options = deviceOptions()
    const currentId = voice.settings.deviceId() ?? "default"
    const match = options.find((option) => option.id === currentId)
    if (match) return match
    return options[0]
  })

  onMount(() => {
    voice.actions.refreshDevices()
  })

  return (
    <Show when={isDesktop()}>
      <div class="flex flex-col gap-2">
        <div class="text-12-medium text-text-strong">Voice Input</div>

        <div class="flex items-center gap-2">
          <SolidSwitch>
            <Match when={voice.state.modelStatus() === "not-downloaded"}>
              <div class="flex items-center gap-2 flex-1">
                <Icon name="microphone" size="small" class="text-icon-subtle" />
                <span class="text-13-regular text-text-base flex-1">Model not downloaded</span>
                <Button variant="primary" size="small" onClick={() => voice.actions.downloadModel()}>
                  Download
                </Button>
              </div>
            </Match>
            <Match when={voice.state.modelStatus() === "downloading"}>
              <div class="flex items-center gap-2 flex-1">
                <ProgressCircle percentage={voice.state.downloadProgress() * 100} size={16} />
                <span class="text-13-regular text-text-base">
                  Downloading... {Math.round(voice.state.downloadProgress() * 100)}%
                </span>
              </div>
            </Match>
            <Match when={voice.state.modelStatus() === "ready"}>
              <div class="flex items-center gap-2 flex-1">
                <Icon name="check" size="small" class="text-icon-success-base" />
                <span class="text-13-regular text-text-success-base">Model ready</span>
              </div>
            </Match>
            <Match when={voice.state.modelStatus() === "error"}>
              <div class="flex items-center gap-2 flex-1">
                <Icon name="circle-x" size="small" class="text-icon-critical-base" />
                <span class="text-13-regular text-text-critical-base flex-1 truncate">
                  {voice.state.error() || "Error"}
                </span>
                <Button variant="ghost" size="small" onClick={() => voice.actions.downloadModel()}>
                  Retry
                </Button>
              </div>
            </Match>
          </SolidSwitch>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-12-regular text-text-subtle">Microphone:</span>
          <div class="flex-1">
            <Select
              options={deviceOptions()}
              current={currentDevice()}
              value={(option) => option.id}
              label={(option) => option.label}
              onSelect={(option) => {
                const deviceId = option?.id ?? "default"
                voice.settings.setDeviceId(deviceId === "default" ? null : deviceId)
              }}
              variant="ghost"
              size="small"
              class="justify-between"
              disabled={!voice.state.isSupported()}
            />
          </div>
          <Button
            variant="ghost"
            size="small"
            onClick={() => voice.actions.refreshDevices()}
            disabled={!voice.state.isSupported()}
          >
            Refresh
          </Button>
        </div>

        <Show when={voice.state.modelStatus() === "ready"}>
          <div class="flex items-center gap-2">
            <span class="text-12-regular text-text-subtle">Hotkey:</span>
            <button
              type="button"
              class="px-2 py-1 border border-border-base text-12-regular text-text-base font-mono"
              classList={{
                "border-border-focus-base": isCapturingKeybind(),
              }}
              onClick={() => {
                setCapturedKeybind(voice.settings.keybind())
                setIsCapturingKeybind(true)
              }}
              onKeyDown={handleKeybindKeyDown}
              onBlur={() => setIsCapturingKeybind(false)}
            >
              <Show when={!isCapturingKeybind()} fallback={<span class="text-text-subtle">Press keys...</span>}>
                {formatKeybind(voice.settings.keybind())}
              </Show>
            </button>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-12-regular text-text-subtle">Mode:</span>
            <div class="flex gap-1">
              <button
                type="button"
                class="px-2 py-1 text-12-regular"
                classList={{
                  "text-text-strong": voice.settings.mode() === "toggle",
                  "text-text-subtle hover:text-text-base": voice.settings.mode() !== "toggle",
                }}
                onClick={() => voice.settings.setMode("toggle")}
              >
                Toggle
              </button>
              <button
                type="button"
                class="px-2 py-1 text-12-regular"
                classList={{
                  "text-text-strong": voice.settings.mode() === "push-to-talk",
                  "text-text-subtle hover:text-text-base": voice.settings.mode() !== "push-to-talk",
                }}
                onClick={() => voice.settings.setMode("push-to-talk")}
              >
                Push to Talk
              </button>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  )
}

export const SettingsDialog: Component<SettingsDialogProps> = (props) => {
  const [tab, setTab] = createSignal<SettingsTab>(props.initialTab ?? "skills")

  const tabs: Array<{ id: SettingsTab; label: string; icon?: string }> = [
    { id: "skills", label: "Skills", icon: "sparkles" },
    { id: "mcp", label: "MCP", icon: "plug" },
    { id: "plugins", label: "Plugins", icon: "puzzle" },
    { id: "voice", label: "Voice" },
  ]

  return (
    <Dialog title="Settings" description="Manage skills, MCP servers, plugins, and voice." size="xl">
      <div class="flex gap-4 px-2.5 pb-3 min-h-[520px]">
        <nav class="flex flex-col gap-1 w-40 shrink-0 border-r border-border-base pr-4">
          {tabs.map((item) => (
            <button
              type="button"
              class="flex items-center gap-2.5 px-3 py-2 text-left text-13-medium transition-colors"
              classList={{
                "text-text-strong": tab() === item.id,
                "text-text-subtle hover:text-text-base": tab() !== item.id,
              }}
              onClick={() => setTab(item.id)}
            >
              <Show when={item.icon}>
                <Icon name={item.icon as any} size="small" class="shrink-0" />
              </Show>
              {item.label}
            </button>
          ))}
        </nav>
        <div class="flex-1 min-w-0 overflow-y-auto">
          <SolidSwitch>
            <Match when={tab() === "skills"}>
              <SkillsPanel />
            </Match>
            <Match when={tab() === "mcp"}>
              <McpSettingsPanel />
            </Match>
            <Match when={tab() === "plugins"}>
              <div class="flex flex-col gap-4">
                <ClaudePluginsPanel />
                <OpenCodePluginsPanel />
              </div>
            </Match>
            <Match when={tab() === "voice"}>
              <VoiceSettingsPanel />
            </Match>
          </SolidSwitch>
        </div>
      </div>
    </Dialog>
  )
}
