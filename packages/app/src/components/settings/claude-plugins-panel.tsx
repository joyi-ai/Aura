import { createMemo, createResource, createSignal, For, Show, type Component } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { Tag } from "@opencode-ai/ui/tag"
import { Switch as ToggleSwitch } from "@opencode-ai/ui/switch"
import { useSDK } from "@/context/sdk"

interface InstalledPlugin {
  id: string
  path: string
  enabled: boolean
  manifest: {
    name: string
    version: string
    description?: string
    author?: { name: string; email?: string } | string
  }
  installedAt: number
}

export type ClaudePluginsPanelProps = {
  variant?: "dialog" | "page"
}

function getAuthorName(author: { name: string; email?: string } | string | undefined): string {
  if (!author) return ""
  if (typeof author === "string") return author
  return author.name
}

export const ClaudePluginsPanel: Component<ClaudePluginsPanelProps> = (props) => {
  const sdk = useSDK()
  const [loading, setLoading] = createSignal<string | null>(null)
  const [searchQuery, setSearchQuery] = createSignal("")

  const isPage = () => props.variant === "page"

  const buildUrl = (path: string) => {
    const url = new URL(path, sdk.url)
    url.searchParams.set("directory", sdk.directory)
    return url.toString()
  }

  const [installed, { refetch: refetchInstalled }] = createResource(async () => {
    const response = await fetch(buildUrl("/claude-plugin/installed")).catch(() => undefined)
    if (!response || !response.ok) return []
    const data = await response.json().catch(() => [])
    if (Array.isArray(data)) return data as InstalledPlugin[]
    return []
  })

  const filteredInstalled = createMemo(() => {
    const query = searchQuery().toLowerCase()
    if (!query) return installed() ?? []
    return (installed() ?? []).filter(
      (plugin) =>
        plugin.manifest.name.toLowerCase().includes(query) ||
        plugin.manifest.description?.toLowerCase().includes(query),
    )
  })

  const installedCount = createMemo(() => installed()?.length ?? 0)

  async function uninstallPlugin(id: string) {
    setLoading(id)
    try {
      await fetch(buildUrl("/claude-plugin/uninstall"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      await refetchInstalled()
    } finally {
      setLoading(null)
    }
  }

  async function togglePlugin(id: string, enabled: boolean) {
    setLoading(id)
    try {
      const endpoint = enabled ? "enable" : "disable"
      await fetch(buildUrl(`/claude-plugin/${endpoint}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      await refetchInstalled()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div class={isPage() ? "size-full flex flex-col" : "flex flex-col gap-3"}>
      <div
        classList={{
          "flex items-center justify-between border-b border-border-base": true,
          "p-6": isPage(),
          "px-2.5 pt-1 pb-2": !isPage(),
        }}
      >
        <div class="flex flex-col gap-1">
          <div class={isPage() ? "text-18-medium text-text-strong" : "text-14-medium text-text-strong"}>
            Claude Code Plugins
          </div>
          <Show when={isPage()}>
            <p class="text-14-regular text-text-base">Manage installed Claude Code plugins</p>
          </Show>
        </div>
      </div>

      <div
        classList={{
          "flex gap-4 items-center border-b border-border-base": true,
          "px-6 py-4": isPage(),
          "px-2.5 pb-2": !isPage(),
        }}
      >
        <div class="flex items-center gap-2 text-12-regular text-text-weak">
          <span>Installed</span>
          <Tag>{installedCount()}</Tag>
        </div>
        <div class="flex-1" />
        <input
          type="text"
          placeholder="Search plugins..."
          class="px-3 py-2 w-64 rounded-md bg-surface-raised-base border border-border-base text-14-regular text-text-base placeholder:text-text-weak focus:outline-none focus:border-border-strong-base"
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
        />
      </div>

      <div
        classList={{
          "overflow-auto": true,
          "flex-1 p-6": isPage(),
          "max-h-[52vh] px-2.5 pb-2": !isPage(),
        }}
      >
        <Show
          when={!installed.loading}
          fallback={
            <div class="flex flex-col items-center justify-center py-12 text-text-weak">
              <Icon name="magnifying-glass" class="size-8 animate-pulse opacity-50" />
              <p class="mt-4 text-14-regular">Loading plugins...</p>
            </div>
          }
        >
          <Show
            when={filteredInstalled().length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center py-12 text-text-weak">
                <Icon name="folder" class="size-12 opacity-50" />
                <p class="mt-4 text-14-regular">No plugins installed</p>
              </div>
            }
          >
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <For each={filteredInstalled()}>
                {(plugin) => (
                  <div class="flex flex-col p-4 rounded-lg bg-surface-raised-base border border-border-base">
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex items-center gap-2 min-w-0 flex-1">
                        <div class="flex items-center justify-center size-8 rounded-md bg-surface-base shrink-0">
                          <Icon name="mcp" class="size-4 text-text-weak" />
                        </div>
                        <div class="min-w-0 flex-1">
                          <h3 class="text-14-medium text-text-strong truncate">{plugin.manifest.name}</h3>
                          <Show when={getAuthorName(plugin.manifest.author)}>
                            <p class="text-12-regular text-text-weak truncate">
                              by {getAuthorName(plugin.manifest.author)}
                            </p>
                          </Show>
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={plugin.enabled}
                        disabled={loading() === plugin.id}
                        onChange={() => togglePlugin(plugin.id, !plugin.enabled)}
                      />
                    </div>

                    <Show when={plugin.manifest.description}>
                      <p class="mt-3 text-13-regular text-text-base line-clamp-2">{plugin.manifest.description}</p>
                    </Show>

                    <div class="mt-3 pt-3 border-t border-border-base flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <Tag>{plugin.manifest.version}</Tag>
                      </div>
                      <Button
                        variant="ghost"
                        size="small"
                        disabled={loading() === plugin.id}
                        onClick={() => uninstallPlugin(plugin.id)}
                      >
                        Uninstall
                      </Button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  )
}
