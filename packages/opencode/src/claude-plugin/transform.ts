/**
 * Tool name and case conversion utilities for Claude Code compatibility
 */
export namespace ClaudePluginTransform {
  // Special mappings for tool names that don't follow simple PascalCase
  const SPECIAL_MAPPINGS: Record<string, string> = {
    webfetch: "WebFetch",
    websearch: "WebSearch",
    todoread: "TodoRead",
    todowrite: "TodoWrite",
    multiedit: "MultiEdit",
    notebookedit: "NotebookEdit",
  }

  /**
   * Convert tool name to PascalCase for Claude Code compatibility
   * Examples: bash -> Bash, web_fetch -> WebFetch
   */
  export function toPascalCase(toolName: string): string {
    const lower = toolName.toLowerCase()
    if (SPECIAL_MAPPINGS[lower]) return SPECIAL_MAPPINGS[lower]

    // Handle snake_case and kebab-case
    if (toolName.includes("-") || toolName.includes("_")) {
      return toolName
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join("")
    }

    // Otherwise capitalize first letter
    return toolName.charAt(0).toUpperCase() + toolName.slice(1)
  }

  /**
   * Convert a string from camelCase to snake_case
   */
  export function toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .replace(/^_/, "")
      .replace(/-/g, "_")
  }

  /**
   * Convert a string from snake_case to camelCase
   */
  export function toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
  }

  /**
   * Check if value is a plain object (not array, null, etc.)
   */
  function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
  }

  /**
   * Recursively convert object keys to snake_case
   */
  export function objectToSnakeCase(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj
    if (Array.isArray(obj)) return obj.map(objectToSnakeCase)
    if (!isPlainObject(obj)) return obj

    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[toSnakeCase(key)] = objectToSnakeCase(value)
    }
    return result
  }

  /**
   * Recursively convert object keys to camelCase
   */
  export function objectToCamelCase(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj
    if (Array.isArray(obj)) return obj.map(objectToCamelCase)
    if (!isPlainObject(obj)) return obj

    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[toCamelCase(key)] = objectToCamelCase(value)
    }
    return result
  }

  /**
   * Check if a tool name matches a pattern (supports wildcards)
   */
  export function matchesPattern(toolName: string, pattern: string): boolean {
    if (!pattern) return true

    const patterns = pattern.split("|").map((p) => p.trim())
    return patterns.some((p) => {
      if (p.includes("*")) {
        const regex = new RegExp(`^${p.replace(/\*/g, ".*")}$`, "i")
        return regex.test(toolName)
      }
      return p.toLowerCase() === toolName.toLowerCase()
    })
  }
}
