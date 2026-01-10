import { Storage } from "../storage/storage"

export namespace CodexSession {
  export async function getThreadID(sessionID: string): Promise<string | undefined> {
    return Storage.read<string>(["codex-thread", sessionID]).catch((error) => {
      if (Storage.NotFoundError.isInstance(error)) return undefined
      throw error
    })
  }

  export async function setThreadID(sessionID: string, threadID: string): Promise<void> {
    await Storage.write(["codex-thread", sessionID], threadID)
  }

  export async function clearThreadID(sessionID: string): Promise<void> {
    await Storage.remove(["codex-thread", sessionID])
  }
}
