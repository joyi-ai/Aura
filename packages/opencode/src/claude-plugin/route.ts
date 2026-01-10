import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { ClaudePlugin } from "./index"
import { ClaudePluginSchema } from "./schema"
import { errors } from "@/server/error"

// Response schemas
const LoadedPluginResponse = z
  .object({
    id: z.string(),
    name: z.string(),
    path: z.string(),
    manifest: ClaudePluginSchema.Manifest,
    commandCount: z.number(),
    agentCount: z.number(),
    hookCount: z.number(),
    mcpCount: z.number(),
    lspCount: z.number(),
  })
  .meta({ ref: "ClaudePluginLoaded" })

const InstalledPluginResponse = ClaudePluginSchema.InstalledPlugin

const MarketplaceEntryResponse = ClaudePluginSchema.MarketplaceEntry

export const ClaudePluginRoute = new Hono()
  // List loaded plugins
  .get(
    "/",
    describeRoute({
      summary: "List loaded plugins",
      description: "Get all currently loaded Claude Code plugins.",
      operationId: "claude-plugin.list",
      responses: {
        200: {
          description: "List of loaded plugins",
          content: {
            "application/json": {
              schema: resolver(LoadedPluginResponse.array()),
            },
          },
        },
      },
    }),
    async (c) => {
      const plugins = await ClaudePlugin.list()
      return c.json(
        plugins.map((p) => ({
          id: p.id,
          name: p.name,
          path: p.path,
          manifest: p.manifest,
          commandCount: p.commands.length,
          agentCount: p.agents.length,
          hookCount: p.hooks.length,
          mcpCount: p.mcp.length,
          lspCount: p.lsp.length,
        })),
      )
    },
  )

  // List installed plugins (includes disabled)
  .get(
    "/installed",
    describeRoute({
      summary: "List installed plugins",
      description: "Get all installed Claude Code plugins, including disabled ones.",
      operationId: "claude-plugin.installed",
      responses: {
        200: {
          description: "List of installed plugins",
          content: {
            "application/json": {
              schema: resolver(InstalledPluginResponse.array()),
            },
          },
        },
      },
    }),
    async (c) => {
      const plugins = await ClaudePlugin.Storage.list()
      return c.json(plugins)
    },
  )

  // Get marketplace plugins
  .get(
    "/marketplace",
    describeRoute({
      summary: "List marketplace plugins",
      description: "Get available plugins from the Claude Code marketplace.",
      operationId: "claude-plugin.marketplace",
      responses: {
        200: {
          description: "List of marketplace plugins",
          content: {
            "application/json": {
              schema: resolver(MarketplaceEntryResponse.array()),
            },
          },
        },
      },
    }),
    async (c) => {
      const plugins = await ClaudePlugin.Marketplace.list()
      return c.json(plugins)
    },
  )

  // Search marketplace
  .get(
    "/marketplace/search",
    describeRoute({
      summary: "Search marketplace",
      description: "Search for plugins in the marketplace.",
      operationId: "claude-plugin.marketplace.search",
      responses: {
        200: {
          description: "Search results",
          content: {
            "application/json": {
              schema: resolver(MarketplaceEntryResponse.array()),
            },
          },
        },
        ...errors(400),
      },
    }),
    validator("query", z.object({ q: z.string() })),
    async (c) => {
      const { q } = c.req.valid("query")
      const results = await ClaudePlugin.Marketplace.search(q)
      return c.json(results)
    },
  )

  // Install plugin
  .post(
    "/install",
    describeRoute({
      summary: "Install plugin",
      description: "Install a plugin from the marketplace.",
      operationId: "claude-plugin.install",
      responses: {
        200: {
          description: "Installed plugin",
          content: {
            "application/json": {
              schema: resolver(LoadedPluginResponse),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator("json", z.object({ id: z.string() })),
    async (c) => {
      const { id } = c.req.valid("json")
      const plugin = await ClaudePlugin.install(id)
      return c.json({
        id: plugin.id,
        name: plugin.name,
        path: plugin.path,
        manifest: plugin.manifest,
        commandCount: plugin.commands.length,
        agentCount: plugin.agents.length,
        hookCount: plugin.hooks.length,
        mcpCount: plugin.mcp.length,
        lspCount: plugin.lsp.length,
      })
    },
  )

  // Uninstall plugin
  .post(
    "/uninstall",
    describeRoute({
      summary: "Uninstall plugin",
      description: "Remove an installed plugin.",
      operationId: "claude-plugin.uninstall",
      responses: {
        200: {
          description: "Plugin uninstalled",
          content: {
            "application/json": {
              schema: resolver(z.boolean()),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator("json", z.object({ id: z.string() })),
    async (c) => {
      const { id } = c.req.valid("json")
      await ClaudePlugin.uninstall(id)
      return c.json(true)
    },
  )

  // Enable plugin
  .post(
    "/enable",
    describeRoute({
      summary: "Enable plugin",
      description: "Enable a disabled plugin.",
      operationId: "claude-plugin.enable",
      responses: {
        200: {
          description: "Plugin enabled",
          content: {
            "application/json": {
              schema: resolver(z.boolean()),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator("json", z.object({ id: z.string() })),
    async (c) => {
      const { id } = c.req.valid("json")
      await ClaudePlugin.enable(id)
      return c.json(true)
    },
  )

  // Disable plugin
  .post(
    "/disable",
    describeRoute({
      summary: "Disable plugin",
      description: "Disable an enabled plugin.",
      operationId: "claude-plugin.disable",
      responses: {
        200: {
          description: "Plugin disabled",
          content: {
            "application/json": {
              schema: resolver(z.boolean()),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator("json", z.object({ id: z.string() })),
    async (c) => {
      const { id } = c.req.valid("json")
      await ClaudePlugin.disable(id)
      return c.json(true)
    },
  )

  // Get plugin commands
  .get(
    "/commands",
    describeRoute({
      summary: "List plugin commands",
      description: "Get all commands from loaded plugins.",
      operationId: "claude-plugin.commands",
      responses: {
        200: {
          description: "List of commands",
          content: {
            "application/json": {
              schema: resolver(
                z.array(
                  z.object({
                    pluginId: z.string(),
                    pluginName: z.string(),
                    name: z.string(),
                    fullName: z.string(),
                    description: z.string().optional(),
                  }),
                ),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const commands = await ClaudePlugin.commands()
      return c.json(
        commands.map((cmd) => ({
          pluginId: cmd.pluginId,
          pluginName: cmd.pluginName,
          name: cmd.name,
          fullName: cmd.fullName,
          description: cmd.description,
        })),
      )
    },
  )

  // Get plugin agents
  .get(
    "/agents",
    describeRoute({
      summary: "List plugin agents",
      description: "Get all agents from loaded plugins.",
      operationId: "claude-plugin.agents",
      responses: {
        200: {
          description: "List of agents",
          content: {
            "application/json": {
              schema: resolver(
                z.array(
                  z.object({
                    pluginId: z.string(),
                    pluginName: z.string(),
                    name: z.string(),
                    fullName: z.string(),
                    description: z.string().optional(),
                  }),
                ),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const agents = await ClaudePlugin.agents()
      return c.json(
        agents.map((agent) => ({
          pluginId: agent.pluginId,
          pluginName: agent.pluginName,
          name: agent.name,
          fullName: agent.fullName,
          description: agent.description,
        })),
      )
    },
  )

  // Refresh marketplace cache
  .post(
    "/marketplace/refresh",
    describeRoute({
      summary: "Refresh marketplace",
      description: "Clear the marketplace cache and fetch fresh data.",
      operationId: "claude-plugin.marketplace.refresh",
      responses: {
        200: {
          description: "Marketplace refreshed",
          content: {
            "application/json": {
              schema: resolver(MarketplaceEntryResponse.array()),
            },
          },
        },
      },
    }),
    async (c) => {
      ClaudePlugin.Marketplace.clearCache()
      const plugins = await ClaudePlugin.Marketplace.list(true)
      return c.json(plugins)
    },
  )

  // Get plugin stats from community registry
  .get(
    "/stats",
    describeRoute({
      summary: "Get plugin stats",
      description: "Get download statistics from the community plugin registry.",
      operationId: "claude-plugin.stats",
      responses: {
        200: {
          description: "Plugin statistics",
          content: {
            "application/json": {
              schema: resolver(
                z.record(
                  z.string(),
                  z.object({
                    name: z.string(),
                    downloads: z.number(),
                    stars: z.number(),
                    version: z.string().optional(),
                  }),
                ),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const stats = await ClaudePlugin.Stats.fetch()
      // Convert Map to plain object for JSON serialization
      const obj: Record<string, { name: string; downloads: number; stars: number; version?: string }> = {}
      for (const [key, value] of stats) {
        obj[key] = value
      }
      return c.json(obj)
    },
  )
