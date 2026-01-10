import { describe, expect, test } from "bun:test"
import { ClaudePluginTransform } from "../../src/claude-plugin/transform"

describe("claude-plugin.transform", () => {
  describe("toPascalCase", () => {
    test("should convert lowercase to PascalCase", () => {
      expect(ClaudePluginTransform.toPascalCase("bash")).toBe("Bash")
      expect(ClaudePluginTransform.toPascalCase("read")).toBe("Read")
      expect(ClaudePluginTransform.toPascalCase("edit")).toBe("Edit")
    })

    test("should handle snake_case", () => {
      expect(ClaudePluginTransform.toPascalCase("web_fetch")).toBe("WebFetch")
      expect(ClaudePluginTransform.toPascalCase("todo_read")).toBe("TodoRead")
      expect(ClaudePluginTransform.toPascalCase("multi_edit")).toBe("MultiEdit")
    })

    test("should handle kebab-case", () => {
      expect(ClaudePluginTransform.toPascalCase("web-fetch")).toBe("WebFetch")
      expect(ClaudePluginTransform.toPascalCase("todo-read")).toBe("TodoRead")
    })

    test("should use special mappings for known tools", () => {
      expect(ClaudePluginTransform.toPascalCase("webfetch")).toBe("WebFetch")
      expect(ClaudePluginTransform.toPascalCase("websearch")).toBe("WebSearch")
      expect(ClaudePluginTransform.toPascalCase("todoread")).toBe("TodoRead")
      expect(ClaudePluginTransform.toPascalCase("todowrite")).toBe("TodoWrite")
      expect(ClaudePluginTransform.toPascalCase("multiedit")).toBe("MultiEdit")
      expect(ClaudePluginTransform.toPascalCase("notebookedit")).toBe("NotebookEdit")
    })

    test("should preserve already PascalCase", () => {
      expect(ClaudePluginTransform.toPascalCase("Bash")).toBe("Bash")
      expect(ClaudePluginTransform.toPascalCase("WebFetch")).toBe("WebFetch")
    })
  })

  describe("toSnakeCase", () => {
    test("should convert camelCase to snake_case", () => {
      expect(ClaudePluginTransform.toSnakeCase("filePath")).toBe("file_path")
      expect(ClaudePluginTransform.toSnakeCase("sessionId")).toBe("session_id")
      expect(ClaudePluginTransform.toSnakeCase("toolUseId")).toBe("tool_use_id")
    })

    test("should handle single word", () => {
      expect(ClaudePluginTransform.toSnakeCase("path")).toBe("path")
      expect(ClaudePluginTransform.toSnakeCase("command")).toBe("command")
    })

    test("should handle consecutive capitals", () => {
      expect(ClaudePluginTransform.toSnakeCase("userID")).toBe("user_i_d")
      expect(ClaudePluginTransform.toSnakeCase("httpURL")).toBe("http_u_r_l")
    })

    test("should convert kebab-case to snake_case", () => {
      expect(ClaudePluginTransform.toSnakeCase("file-path")).toBe("file_path")
    })
  })

  describe("toCamelCase", () => {
    test("should convert snake_case to camelCase", () => {
      expect(ClaudePluginTransform.toCamelCase("file_path")).toBe("filePath")
      expect(ClaudePluginTransform.toCamelCase("session_id")).toBe("sessionId")
      expect(ClaudePluginTransform.toCamelCase("tool_use_id")).toBe("toolUseId")
    })

    test("should handle single word", () => {
      expect(ClaudePluginTransform.toCamelCase("path")).toBe("path")
      expect(ClaudePluginTransform.toCamelCase("command")).toBe("command")
    })
  })

  describe("objectToSnakeCase", () => {
    test("should convert object keys to snake_case", () => {
      const input = {
        filePath: "/tmp/test",
        sessionId: "123",
        toolUseId: "abc",
      }
      const expected = {
        file_path: "/tmp/test",
        session_id: "123",
        tool_use_id: "abc",
      }
      expect(ClaudePluginTransform.objectToSnakeCase(input)).toEqual(expected)
    })

    test("should handle nested objects", () => {
      const input = {
        outerKey: {
          innerKey: "value",
        },
      }
      const expected = {
        outer_key: {
          inner_key: "value",
        },
      }
      expect(ClaudePluginTransform.objectToSnakeCase(input)).toEqual(expected)
    })

    test("should handle arrays", () => {
      const input = [{ itemName: "first" }, { itemName: "second" }]
      const expected = [{ item_name: "first" }, { item_name: "second" }]
      expect(ClaudePluginTransform.objectToSnakeCase(input)).toEqual(expected)
    })

    test("should preserve primitive values", () => {
      expect(ClaudePluginTransform.objectToSnakeCase("string")).toBe("string")
      expect(ClaudePluginTransform.objectToSnakeCase(123)).toBe(123)
      expect(ClaudePluginTransform.objectToSnakeCase(null)).toBe(null)
      expect(ClaudePluginTransform.objectToSnakeCase(undefined)).toBe(undefined)
    })
  })

  describe("objectToCamelCase", () => {
    test("should convert object keys to camelCase", () => {
      const input = {
        file_path: "/tmp/test",
        session_id: "123",
        tool_use_id: "abc",
      }
      const expected = {
        filePath: "/tmp/test",
        sessionId: "123",
        toolUseId: "abc",
      }
      expect(ClaudePluginTransform.objectToCamelCase(input)).toEqual(expected)
    })

    test("should handle nested objects", () => {
      const input = {
        outer_key: {
          inner_key: "value",
        },
      }
      const expected = {
        outerKey: {
          innerKey: "value",
        },
      }
      expect(ClaudePluginTransform.objectToCamelCase(input)).toEqual(expected)
    })
  })

  describe("matchesPattern", () => {
    test("should match exact tool names (case insensitive)", () => {
      expect(ClaudePluginTransform.matchesPattern("Bash", "Bash")).toBe(true)
      expect(ClaudePluginTransform.matchesPattern("Bash", "bash")).toBe(true)
      expect(ClaudePluginTransform.matchesPattern("bash", "Bash")).toBe(true)
    })

    test("should not match different tool names", () => {
      expect(ClaudePluginTransform.matchesPattern("Bash", "Read")).toBe(false)
      expect(ClaudePluginTransform.matchesPattern("WebFetch", "WebSearch")).toBe(false)
    })

    test("should support wildcard patterns", () => {
      expect(ClaudePluginTransform.matchesPattern("WebFetch", "Web*")).toBe(true)
      expect(ClaudePluginTransform.matchesPattern("WebSearch", "Web*")).toBe(true)
      expect(ClaudePluginTransform.matchesPattern("Bash", "Web*")).toBe(false)
    })

    test("should support multiple patterns with pipe separator", () => {
      expect(ClaudePluginTransform.matchesPattern("Bash", "Bash|Read")).toBe(true)
      expect(ClaudePluginTransform.matchesPattern("Read", "Bash|Read")).toBe(true)
      expect(ClaudePluginTransform.matchesPattern("Edit", "Bash|Read")).toBe(false)
    })

    test("should match any tool when pattern is empty", () => {
      expect(ClaudePluginTransform.matchesPattern("Bash", "")).toBe(true)
      expect(ClaudePluginTransform.matchesPattern("Any", "")).toBe(true)
    })
  })
})
