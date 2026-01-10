import { Log } from "@/util/log"

/**
 * Fetches plugin download statistics from the community registry
 * at claude-plugins.dev
 */
export namespace ClaudePluginStats {
  const log = Log.create({ service: "claude-plugin.stats" })

  const STATS_API_URL = "https://claude-plugins.dev/api/plugins"
  const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

  export interface PluginStats {
    name: string
    downloads: number
    stars: number
    version?: string
  }

  interface StatsCache {
    stats: Map<string, PluginStats>
    fetchedAt: number
  }

  let cache: StatsCache | undefined

  /**
   * Fetch a page of plugin stats
   */
  async function fetchPage(offset: number, limit: number): Promise<{ plugins: PluginStats[]; total: number }> {
    const url = `${STATS_API_URL}?offset=${offset}&limit=${limit}`
    const response = await globalThis.fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; OpenCode/1.0)",
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const text = await response.text()
    if (!text || text.startsWith("<")) {
      throw new Error("HTML response")
    }

    const data = JSON.parse(text)
    return {
      plugins: data.plugins ?? [],
      total: data.total ?? 0,
    }
  }

  /**
   * Fetch plugin stats from the community registry
   */
  export async function fetch(forceRefresh = false): Promise<Map<string, PluginStats>> {
    // Check cache
    if (!forceRefresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      return cache.stats
    }

    try {
      // Fetch first page to get total count
      const firstPage = await fetchPage(0, 100)
      const allPlugins: PluginStats[] = [...firstPage.plugins]

      // Fetch remaining pages (limit to first 500 plugins for performance)
      const maxPlugins = Math.min(firstPage.total, 500)
      for (let offset = 100; offset < maxPlugins; offset += 100) {
        const page = await fetchPage(offset, 100)
        allPlugins.push(...page.plugins)
      }

      const stats = new Map<string, PluginStats>()
      for (const plugin of allPlugins) {
        if (plugin.name) {
          stats.set(plugin.name.toLowerCase(), {
            name: plugin.name,
            downloads: plugin.downloads ?? 0,
            stars: plugin.stars ?? 0,
            version: plugin.version,
          })
        }
      }

      cache = {
        stats,
        fetchedAt: Date.now(),
      }

      log.info("fetched plugin stats", { count: stats.size })
      return stats
    } catch (error) {
      log.warn("failed to fetch plugin stats", {
        error: error instanceof Error ? error.message : String(error),
      })
      return cache?.stats ?? new Map()
    }
  }

  /**
   * Get stats for a specific plugin by name
   */
  export async function get(name: string): Promise<PluginStats | undefined> {
    const stats = await fetch()
    return stats.get(name.toLowerCase())
  }

  /**
   * Get download count for a plugin
   */
  export async function getDownloads(name: string): Promise<number> {
    const stats = await get(name)
    return stats?.downloads ?? 0
  }

  /**
   * Clear the stats cache
   */
  export function clearCache(): void {
    cache = undefined
  }
}
