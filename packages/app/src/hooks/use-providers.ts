import { useGlobalSync } from "@/context/global-sync"
import { base64Decode } from "@opencode-ai/util/encode"
import { useParams } from "@solidjs/router"
import { createMemo } from "solid-js"

export const popularProviders = [
  "claude-agent",
  "codex",
  "opencode",
  "anthropic",
  "github-copilot",
  "openai",
  "google",
  "openrouter",
  "vercel",
]

export function useProviders() {
  const globalSync = useGlobalSync()
  const params = useParams()
  const currentDirectory = createMemo(() => base64Decode(params.dir ?? ""))
  const hasProviderData = (data: { all: unknown[]; connected: unknown[]; default: Record<string, unknown> }) =>
    data.all.length > 0 || data.connected.length > 0 || Object.keys(data.default ?? {}).length > 0
  const providers = createMemo(() => {
    if (currentDirectory()) {
      const [projectStore] = globalSync.child(currentDirectory())
      if (!hasProviderData(projectStore.provider) && hasProviderData(globalSync.data.provider)) {
        return globalSync.data.provider
      }
      return projectStore.provider
    }
    return globalSync.data.provider
  })
  const connected = createMemo(() => providers().all.filter((p) => providers().connected.includes(p.id)))
  const paid = createMemo(() =>
    connected().filter((p) => p.id !== "opencode" || Object.values(p.models).find((m) => m.cost?.input)),
  )
  const popular = createMemo(() => providers().all.filter((p) => popularProviders.includes(p.id)))
  return {
    all: createMemo(() => providers().all),
    default: createMemo(() => providers().default),
    popular,
    connected,
    paid,
  }
}
