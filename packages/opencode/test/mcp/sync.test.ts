import { describe, expect, test } from "bun:test"
import path from "path"
import fs from "fs/promises"
import { tmpdir } from "../fixture/fixture"
import { McpSync } from "../../src/mcp/sync"
import { Global } from "../../src/global"

describe("McpSync", () => {
  test("syncs servers to claude and codex settings", async () => {
    await using tmp = await tmpdir()
    const mcp = {
      local: {
        type: "local" as const,
        command: ["npx", "@playwright/mcp@latest"],
        environment: { FOO: "bar" },
      },
      remote: {
        type: "remote" as const,
        url: "https://example.com/mcp",
        headers: { Authorization: "Bearer token" },
      },
    }

    await McpSync.apply(mcp, tmp.path)

    const claudePath = path.join(tmp.path, ".claude", "settings.json")
    const codexPath = path.join(Global.Path.data, "codex", "settings.json")
    const claude = JSON.parse(await Bun.file(claudePath).text()) as Record<string, unknown>
    const codex = JSON.parse(await Bun.file(codexPath).text()) as Record<string, unknown>

    const claudeServers = claude.mcpServers as Record<string, unknown>
    const codexServers = codex.mcpServers as Record<string, unknown>

    expect(claudeServers.local).toEqual({
      type: "stdio",
      command: "npx",
      args: ["@playwright/mcp@latest"],
      env: { FOO: "bar" },
    })
    expect(claudeServers.remote).toEqual({
      type: "http",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer token" },
    })
    expect(codexServers).toEqual(claudeServers)
  })

  test("removes previously synced servers without touching external entries", async () => {
    await using tmp = await tmpdir()
    const claudeDir = path.join(tmp.path, ".claude")
    await fs.mkdir(claudeDir, { recursive: true })
    const claudePath = path.join(claudeDir, "settings.json")
    await Bun.write(
      claudePath,
      JSON.stringify(
        {
          mcpServers: {
            external: { type: "http", url: "https://external.example/mcp" },
          },
        },
        null,
        2,
      ),
    )

    await McpSync.apply(
      {
        local: {
          type: "local" as const,
          command: ["node", "server.js"],
        },
      },
      tmp.path,
    )
    await McpSync.apply({}, tmp.path)

    const updated = JSON.parse(await Bun.file(claudePath).text()) as Record<string, unknown>
    const servers = updated.mcpServers as Record<string, unknown>

    expect(servers.external).toEqual({ type: "http", url: "https://external.example/mcp" })
    expect(servers.local).toBeUndefined()
  })
})
