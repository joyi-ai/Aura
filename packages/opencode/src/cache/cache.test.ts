import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { Cache } from "./index"
import { Database } from "bun:sqlite"
import fs from "fs"
import path from "path"
import os from "os"

// Use temp directory for test database
const testDir = path.join(os.tmpdir(), "opencode-cache-test")
const testDbPath = path.join(testDir, "test-cache.db")

describe("Cache", () => {
  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true })
    // Override the cache path for testing
    const db = new Database(testDbPath, { create: true })
    db.run("PRAGMA journal_mode = WAL")
    db.close()
  })

  afterAll(() => {
    Cache.close()
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  describe("Session", () => {
    test("upsert and read session", () => {
      Cache.init()

      const session = {
        id: "test-session-1",
        projectID: "test-project",
        title: "Test Session",
        directory: "/test/path",
        time: { created: Date.now(), updated: Date.now() },
      }

      Cache.Session.upsert(session)
      const result = Cache.Session.read("test-session-1")

      expect(result).not.toBeNull()
      expect(result?.title).toBe("Test Session")
      expect(result?.projectID).toBe("test-project")
    })

    test("list sessions for project", () => {
      Cache.Session.upsert({
        id: "session-a",
        projectID: "project-1",
        title: "Session A",
        directory: "/path/a",
        time: { created: Date.now(), updated: Date.now() },
      })

      Cache.Session.upsert({
        id: "session-b",
        projectID: "project-1",
        title: "Session B",
        directory: "/path/b",
        time: { created: Date.now(), updated: Date.now() + 1000 },
      })

      Cache.Session.upsert({
        id: "session-c",
        projectID: "project-2",
        title: "Session C",
        directory: "/path/c",
        time: { created: Date.now(), updated: Date.now() },
      })

      const project1Sessions = Cache.Session.list("project-1")
      expect(project1Sessions.length).toBe(2)

      const project2Sessions = Cache.Session.list("project-2")
      expect(project2Sessions.length).toBe(1)
    })

    test("count sessions", () => {
      const count = Cache.Session.count("project-1")
      expect(count).toBeGreaterThanOrEqual(2)
    })

    test("remove session", () => {
      Cache.Session.remove("session-a")
      const result = Cache.Session.read("session-a")
      expect(result).toBeNull()
    })
  })

  describe("Message", () => {
    test("upsert and read message", () => {
      const message = {
        id: "msg-1",
        sessionID: "session-b",
        role: "user" as const,
        agent: "default",
        time: { created: Date.now() },
      }

      Cache.Message.upsert(message)
      const result = Cache.Message.read("msg-1")

      expect(result).not.toBeNull()
      expect(result?.role).toBe("user")
      expect(result?.sessionID).toBe("session-b")
    })

    test("list messages for session", () => {
      Cache.Message.upsert({
        id: "msg-2",
        sessionID: "session-b",
        parentID: "msg-1",
        role: "assistant",
        cost: 0.01,
        tokens: { input: 100, output: 50 },
        time: { created: Date.now() + 1000, completed: Date.now() + 2000 },
      })

      const messages = Cache.Message.list("session-b")
      expect(messages.length).toBe(2)
    })
  })

  describe("Config", () => {
    test("write and read config", () => {
      const config = { theme: "dark", fontSize: 14 }
      Cache.Config.write("user-prefs", config)

      const result = Cache.Config.read("user-prefs")
      expect(result).not.toBeNull()

      const parsed = JSON.parse(result!)
      expect(parsed.theme).toBe("dark")
      expect(parsed.fontSize).toBe(14)
    })

    test("loadedAt returns timestamp", () => {
      const before = Date.now()
      Cache.Config.write("test-key", { value: 1 })
      const loadedAt = Cache.Config.loadedAt("test-key")

      expect(loadedAt).not.toBeNull()
      expect(loadedAt).toBeGreaterThanOrEqual(before)
    })
  })

  describe("Sync", () => {
    test("mark and check sync status", () => {
      const mtime = Date.now()
      Cache.Sync.mark("session", "sync-test-1", mtime)

      // Same mtime should not need sync
      expect(Cache.Sync.needsSync("session", "sync-test-1", mtime)).toBe(false)

      // Newer mtime should need sync
      expect(Cache.Sync.needsSync("session", "sync-test-1", mtime + 1000)).toBe(true)

      // Unknown entity should need sync
      expect(Cache.Sync.needsSync("session", "unknown", mtime)).toBe(true)
    })
  })

  describe("stats", () => {
    test("returns cache statistics", () => {
      const stats = Cache.stats()
      expect(stats.sessions).toBeGreaterThan(0)
      expect(stats.messages).toBeGreaterThan(0)
      expect(stats.config).toBeGreaterThan(0)
    })
  })
})
