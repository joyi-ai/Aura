import { Log } from "@/util/log"
import { $ } from "bun"
import path from "path"
import os from "os"

export namespace ClaudeAgentExecutable {
  const log = Log.create({ service: "claude-agent-executable" })

  /**
   * Find the Claude Code CLI executable path
   * Searches common installation locations across Windows, macOS, and Linux
   */
  export async function find(): Promise<string | undefined> {
    const platform = globalThis.process.platform
    const isWindows = platform === "win32"
    const isMac = platform === "darwin"
    const home = os.homedir()

    const possiblePaths: string[] = []

    if (isWindows) {
      // Windows paths
      possiblePaths.push(
        // Standard install location
        path.join(home, ".local", "bin", "claude.exe"),
        // npm global (default)
        path.join(home, "AppData", "Roaming", "npm", "claude.cmd"),
        path.join(home, "AppData", "Roaming", "npm", "claude.exe"),
        path.join(home, "AppData", "Roaming", "npm", "claude"),
        // pnpm global
        path.join(home, "AppData", "Local", "pnpm", "claude.cmd"),
        path.join(home, "AppData", "Local", "pnpm", "claude.exe"),
        // yarn global
        path.join(home, "AppData", "Local", "Yarn", "bin", "claude.cmd"),
        path.join(home, "AppData", "Local", "Yarn", "bin", "claude.exe"),
        // Scoop
        path.join(home, "scoop", "shims", "claude.exe"),
        // Chocolatey
        "C:\\ProgramData\\chocolatey\\bin\\claude.exe",
      )
    } else {
      // macOS and Linux paths
      possiblePaths.push(
        // Standard install location
        path.join(home, ".local", "bin", "claude"),
        // System paths
        "/usr/local/bin/claude",
        "/usr/bin/claude",
      )

      if (isMac) {
        // macOS-specific paths
        possiblePaths.push(
          // Homebrew on Apple Silicon
          "/opt/homebrew/bin/claude",
          // Homebrew on Intel
          "/usr/local/Cellar/claude-code/bin/claude",
        )
      } else {
        // Linux-specific paths
        possiblePaths.push(
          // Linuxbrew
          "/home/linuxbrew/.linuxbrew/bin/claude",
          path.join(home, ".linuxbrew", "bin", "claude"),
        )
      }

      // Common paths for both macOS and Linux
      possiblePaths.push(
        // npm global (default prefix)
        path.join(home, ".npm-global", "bin", "claude"),
        // npm global (nvm)
        path.join(home, ".nvm", "versions", "node", "**", "bin", "claude"),
        // pnpm global
        path.join(home, ".local", "share", "pnpm", "claude"),
        path.join(home, "Library", "pnpm", "claude"), // macOS pnpm
        // yarn global
        path.join(home, ".yarn", "bin", "claude"),
        path.join(home, ".config", "yarn", "global", "node_modules", ".bin", "claude"),
        // bun global
        path.join(home, ".bun", "bin", "claude"),
        // volta
        path.join(home, ".volta", "bin", "claude"),
        // asdf
        path.join(home, ".asdf", "shims", "claude"),
        // fnm
        path.join(home, ".fnm", "current", "bin", "claude"),
        // n (node version manager)
        "/usr/local/n/versions/node/*/bin/claude",
      )
    }

    // Check each path
    for (const p of possiblePaths) {
      // Skip glob patterns for direct check
      if (p.includes("*")) continue
      if (await Bun.file(p).exists()) {
        log.info("found claude code executable", { path: p })
        return p
      }
    }

    // Try using 'which' or 'where' command as fallback
    const result = await $`${isWindows ? "where" : "which"} claude`.quiet().nothrow().text()
    const found = result
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean)
    if (found) {
      log.info("found claude code via which/where", { path: found })
      return found
    }

    return undefined
  }
}
