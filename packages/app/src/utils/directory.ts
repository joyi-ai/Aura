export function normalizeDirectoryKey(input: string | undefined): string {
  if (!input) return ""
  const normalized = input.replace(/\\/g, "/").replace(/\/+$/, "")
  if (!normalized) return ""
  if (!/[a-zA-Z]:/.test(normalized) && !input.includes("\\")) return normalized
  return normalized.toLowerCase()
}
