import { normalizeDirectoryKey } from "@/utils/directory"

type KeyOptions = {
  directory?: string
  sessionId?: string
  paneId?: string
}

const paneKey = (paneId: string | undefined) => (paneId ? `pane:${paneId}` : "pane:single")

const directoryKey = (directory: string | undefined) => {
  const normalized = normalizeDirectoryKey(directory)
  return normalized ? `dir:${normalized}` : "dir:unknown"
}

export function makeViewKey(options: Pick<KeyOptions, "directory" | "paneId">): string {
  if (options.paneId) return paneKey(options.paneId)
  return directoryKey(options.directory)
}

export function makeContextKey(options: Pick<KeyOptions, "directory" | "paneId">): string {
  const dir = directoryKey(options.directory)
  if (options.paneId) return `${paneKey(options.paneId)}:${dir}:context`
  return `${dir}:context`
}

export function makeSessionKey(options: KeyOptions): string {
  const dir = directoryKey(options.directory)
  const session = options.sessionId ? `session:${options.sessionId}` : "session:new"
  if (options.paneId) return `${paneKey(options.paneId)}:${dir}:${session}`
  return `${dir}:${session}`
}
