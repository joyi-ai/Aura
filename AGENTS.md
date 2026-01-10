# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies
bun install

# Run desktop app in development mode
bun run tauri dev

# Type checking
bun turbo typecheck

# Tests - uses Bun's built-in test runner
# IMPORTANT: On Windows, run tests through WSL/Linux (path handling issues)
# From WSL: cd /mnt/c/<path-to-repo>/packages/opencode && bun test
cd packages/opencode && bun test
bun test <file>           # Single test file
bun test --coverage       # Run with coverage report

# Regenerate SDK after API changes
./packages/sdk/js/script/build.ts
# Or from repo root:
./script/generate.ts
```

## Architecture Overview

OpenCode is an AI coding agent with a **client-server architecture**, focused on the desktop app:

- **Server**: Hono HTTP server exposing REST API + SSE for real-time events (`packages/opencode/src/server/`)
- **Desktop**: Tauri desktop app with SolidJS frontend (`packages/desktop/`)
- **SDK**: Auto-generated TypeScript client (`packages/sdk/js/`)
- **Event Bus**: Pub-sub system for component communication (`packages/opencode/src/bus/`)

### Core Packages

| Package | Purpose |
|---------|---------|
| `packages/opencode` | Core server and business logic |
| `packages/desktop` | Tauri desktop app (main UI) |
| `packages/app` | Shared SolidJS app components |
| `packages/ui` | Shared UI component library |
| `packages/sdk/js` | Generated TypeScript SDK |
| `packages/plugin` | `@opencode-ai/plugin` for custom tools |

### Key Source Directories (`packages/opencode/src/`)

| Directory | Purpose |
|-----------|---------|
| `agent/` | Agent definitions with prompts (build, plan, explore) |
| `provider/` | AI provider abstraction (Anthropic, OpenAI, Google, etc.) |
| `tool/` | Built-in tools (bash, read, edit, grep, glob, etc.) |
| `session/` | Session/message management, agentic loop, compaction |
| `permission/` | Permission system for tool execution |
| `mcp/` | Model Context Protocol client integration |
| `lsp/` | Language Server Protocol integration |
| `config/` | Configuration loading (opencode.json) |

### Tool System

Tools are defined with Zod schemas and execute with permission checking:

```typescript
export const MyTool = Tool.define("my-tool", async () => ({
  description: "...",
  parameters: z.object({ ... }),
  async execute(args, ctx) {
    // ctx.ask() for permissions, ctx.metadata() for UI updates
    return { title, output, metadata }
  }
}))
```

Custom tools: `.opencode/tool/` directories or via plugins.

### Agent System

Built-in agents: `build` (full access), `plan` (read-only), `explore` (fast search), `general` (parallel tasks).

Custom agents: `.opencode/agent/*.md` files or `opencode.json` config.

## Code Style

- Write tests for new features and bug fixes in `packages/opencode/test/`
- Keep logic in single functions unless reusable
- Avoid `else` statements, `try/catch`, `let`, and `any`
- Prefer single-word variable names when descriptive
- Use Bun APIs (`Bun.file()`, `Bun.$`, etc.)
- No unnecessary destructuring

## Conventions

- **Namespace modules**: Major components use `export namespace Foo { ... }`
- **Zod schemas**: All data types use Zod for validation and SDK generation
- **Path aliases**: `@/` maps to `src/`
- **Prompts**: Stored as `.txt` files imported as strings
- **Lazy init**: `lazy()` utility for deferred expensive operations

## Testing

Uses **Bun's built-in test runner** (`bun:test`). Tests are located in `packages/opencode/test/`.

```typescript
import { describe, expect, test } from "bun:test"

describe("feature", () => {
  test("behavior", async () => {
    // test code
  })
})
```

- **Config**: `packages/opencode/bunfig.toml` (10s timeout, coverage enabled)
- **Preload**: `test/preload.ts` sets up isolated temp directories
- **Naming**: `*.test.ts` files in `test/` mirroring `src/` structure

### Creating Tests

Use `tmpdir` fixture for isolated test directories with automatic cleanup:

```typescript
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"

test("example", async () => {
  await using tmp = await tmpdir({ git: true })  // auto-cleanup via Symbol.asyncDispose
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // test code runs in isolated project context
    },
  })
})
```

For tool tests, create a mock context:

```typescript
const ctx = {
  sessionID: "test",
  messageID: "",
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  metadata: () => {},
  ask: async () => {},
}
```

`tmpdir` options: `{ git: true }` initializes git repo, `{ config: {...} }` creates `opencode.json`

### When to Write Tests

- New features: Add tests covering the main functionality
- Bug fixes: Add a test that reproduces the bug before fixing
- Run tests through WSL/Linux before committing (Windows has path handling issues)
- To test opencode in the `packages/opencode` directory you can run `bun dev`
- To regenerate the javascript SDK, run ./packages/sdk/js/script/build.ts
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- the default branch in this repo is `main`
