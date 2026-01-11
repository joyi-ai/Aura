import { describe, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import { StorageSqlite } from "../../src/storage/sqlite"

describe("StorageSqlite.listMessagesPage", () => {
  test("paginates newest-first and supports cursors", () => {
    const sessionID = Identifier.ascending("session")
    const ids = [
      Identifier.ascending("message"),
      Identifier.ascending("message"),
      Identifier.ascending("message"),
      Identifier.ascending("message"),
    ]

    for (const id of ids) {
      StorageSqlite.writeMessage({
        info: {
          id,
          sessionID,
          time: { created: Date.now() },
        },
        parts: [],
      })
    }

    const first = StorageSqlite.listMessagesPage({ sessionID, limit: 2 })
    expect(first).toStrictEqual([ids[3], ids[2]])

    const second = StorageSqlite.listMessagesPage({ sessionID, limit: 2, afterID: ids[2] })
    expect(second).toStrictEqual([ids[1], ids[0]])

    expect(StorageSqlite.countMessages(sessionID)).toBe(ids.length)
  })
})
