import { Show, createMemo, createResource, createSignal, type Component } from "solid-js"
import { List } from "@opencode-ai/ui/list"
import { Switch } from "@opencode-ai/ui/switch"
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

export const ClaudePluginsPanel: Component<ClaudePluginsPanelProps> = () => {
  const sdk = useSDK()
  const [loading, setLoading] = createSignal<string | null>(null)

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

  const items = createMemo(() =>
    (installed() ?? [])
      .map((plugin) => ({
        ...plugin,
        name: plugin.manifest.name,
        description: plugin.manifest.description,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  )

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
    <div class="flex flex-col gap-2">
      <List
        search={{ placeholder: "Search", autofocus: false }}
        emptyMessage="No plugins installed"
        key={(x) => x?.id ?? ""}
        items={items()}
        filterKeys={["name", "description"]}
        sortBy={(a, b) => a.name.localeCompare(b.name)}
        onSelect={(x) => {
          if (x) togglePlugin(x.id, !x.enabled)
        }}
      >
        {(plugin) => (
          <div class="w-full flex items-center justify-between gap-x-3">
            <div class="flex flex-col gap-0.5 min-w-0">
              <span class="truncate text-13-regular text-text-strong">{plugin.name}</span>
              <Show when={plugin.description}>
                <span class="text-12-regular text-text-weak truncate">{plugin.description}</span>
              </Show>
            </div>
            <Switch
              checked={plugin.enabled}
              disabled={loading() === plugin.id}
              onChange={() => togglePlugin(plugin.id, !plugin.enabled)}
            />
          </div>
        )}
      </List>
    </div>
  )
}
