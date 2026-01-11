import { BusEvent } from "@/bus/bus-event"
import z from "zod"
import { NamedError } from "@opencode-ai/util/error"
import { APICallError, convertToModelMessages, LoadAPIKeyError, type ModelMessage, type UIMessage } from "ai"
import { Identifier } from "../id/id"
import { LSP } from "../lsp"
import { Snapshot } from "@/snapshot"
import { fn } from "@/util/fn"
import { Storage } from "@/storage/storage"
import { ProviderTransform } from "@/provider/transform"
import { STATUS_CODES } from "http"
import { iife } from "@/util/iife"
import { type SystemError } from "bun"
import { Log } from "@/util/log"

export namespace MessageV2 {
  export const OutputLengthError = NamedError.create("MessageOutputLengthError", z.object({}))
  export const AbortedError = NamedError.create("MessageAbortedError", z.object({ message: z.string() }))
  export const AuthError = NamedError.create(
    "ProviderAuthError",
    z.object({
      providerID: z.string(),
      message: z.string(),
    }),
  )
  export const APIError = NamedError.create(
    "APIError",
    z.object({
      message: z.string(),
      statusCode: z.number().optional(),
      isRetryable: z.boolean(),
      responseHeaders: z.record(z.string(), z.string()).optional(),
      responseBody: z.string().optional(),
      metadata: z.record(z.string(), z.string()).optional(),
    }),
  )
  export type APIError = z.infer<typeof APIError.Schema>

  const PartBase = z.object({
    id: z.string(),
    sessionID: z.string(),
    messageID: z.string(),
  })

  export const SnapshotPart = PartBase.extend({
    type: z.literal("snapshot"),
    snapshot: z.string(),
  }).meta({
    ref: "SnapshotPart",
  })
  export type SnapshotPart = z.infer<typeof SnapshotPart>

  export const PatchPart = PartBase.extend({
    type: z.literal("patch"),
    hash: z.string(),
    files: z.string().array(),
  }).meta({
    ref: "PatchPart",
  })
  export type PatchPart = z.infer<typeof PatchPart>

  export const TextPart = PartBase.extend({
    type: z.literal("text"),
    text: z.string(),
    synthetic: z.boolean().optional(),
    ignored: z.boolean().optional(),
    time: z
      .object({
        start: z.number(),
        end: z.number().optional(),
      })
      .optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }).meta({
    ref: "TextPart",
  })
  export type TextPart = z.infer<typeof TextPart>

  export const ReasoningPart = PartBase.extend({
    type: z.literal("reasoning"),
    text: z.string(),
    metadata: z.record(z.string(), z.any()).optional(),
    time: z.object({
      start: z.number(),
      end: z.number().optional(),
    }),
  }).meta({
    ref: "ReasoningPart",
  })
  export type ReasoningPart = z.infer<typeof ReasoningPart>

  const FilePartSourceBase = z.object({
    text: z
      .object({
        value: z.string(),
        start: z.number().int(),
        end: z.number().int(),
      })
      .meta({
        ref: "FilePartSourceText",
      }),
  })

  export const FileSource = FilePartSourceBase.extend({
    type: z.literal("file"),
    path: z.string(),
  }).meta({
    ref: "FileSource",
  })

  export const SymbolSource = FilePartSourceBase.extend({
    type: z.literal("symbol"),
    path: z.string(),
    range: LSP.Range,
    name: z.string(),
    kind: z.number().int(),
  }).meta({
    ref: "SymbolSource",
  })

  export const ResourceSource = FilePartSourceBase.extend({
    type: z.literal("resource"),
    clientName: z.string(),
    uri: z.string(),
  }).meta({
    ref: "ResourceSource",
  })

  export const FilePartSource = z.discriminatedUnion("type", [FileSource, SymbolSource, ResourceSource]).meta({
    ref: "FilePartSource",
  })

  export const FilePart = PartBase.extend({
    type: z.literal("file"),
    mime: z.string(),
    filename: z.string().optional(),
    url: z.string(),
    source: FilePartSource.optional(),
  }).meta({
    ref: "FilePart",
  })
  export type FilePart = z.infer<typeof FilePart>

  export const AgentPart = PartBase.extend({
    type: z.literal("agent"),
    name: z.string(),
    source: z
      .object({
        value: z.string(),
        start: z.number().int(),
        end: z.number().int(),
      })
      .optional(),
  }).meta({
    ref: "AgentPart",
  })
  export type AgentPart = z.infer<typeof AgentPart>

  export const CompactionPart = PartBase.extend({
    type: z.literal("compaction"),
    auto: z.boolean(),
  }).meta({
    ref: "CompactionPart",
  })
  export type CompactionPart = z.infer<typeof CompactionPart>

  export const SubtaskPart = PartBase.extend({
    type: z.literal("subtask"),
    prompt: z.string(),
    description: z.string(),
    agent: z.string(),
    command: z.string().optional(),
  })
  export type SubtaskPart = z.infer<typeof SubtaskPart>

  export const RetryPart = PartBase.extend({
    type: z.literal("retry"),
    attempt: z.number(),
    error: APIError.Schema,
    time: z.object({
      created: z.number(),
    }),
  }).meta({
    ref: "RetryPart",
  })
  export type RetryPart = z.infer<typeof RetryPart>

  export const StepStartPart = PartBase.extend({
    type: z.literal("step-start"),
    snapshot: z.string().optional(),
  }).meta({
    ref: "StepStartPart",
  })
  export type StepStartPart = z.infer<typeof StepStartPart>

  export const StepFinishPart = PartBase.extend({
    type: z.literal("step-finish"),
    reason: z.string(),
    snapshot: z.string().optional(),
    cost: z.number(),
    tokens: z.object({
      input: z.number(),
      output: z.number(),
      reasoning: z.number(),
      cache: z.object({
        read: z.number(),
        write: z.number(),
      }),
    }),
  }).meta({
    ref: "StepFinishPart",
  })
  export type StepFinishPart = z.infer<typeof StepFinishPart>

  export const ToolStatePending = z
    .object({
      status: z.literal("pending"),
      input: z.record(z.string(), z.any()),
      raw: z.string(),
    })
    .meta({
      ref: "ToolStatePending",
    })

  export type ToolStatePending = z.infer<typeof ToolStatePending>

  export const ToolStateRunning = z
    .object({
      status: z.literal("running"),
      input: z.record(z.string(), z.any()),
      title: z.string().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
      time: z.object({
        start: z.number(),
      }),
    })
    .meta({
      ref: "ToolStateRunning",
    })
  export type ToolStateRunning = z.infer<typeof ToolStateRunning>

  export const ToolStateCompleted = z
    .object({
      status: z.literal("completed"),
      input: z.record(z.string(), z.any()),
      output: z.string(),
      title: z.string(),
      metadata: z.record(z.string(), z.any()),
      time: z.object({
        start: z.number(),
        end: z.number(),
        compacted: z.number().optional(),
      }),
      attachments: FilePart.array().optional(),
    })
    .meta({
      ref: "ToolStateCompleted",
    })
  export type ToolStateCompleted = z.infer<typeof ToolStateCompleted>

  export const ToolStateError = z
    .object({
      status: z.literal("error"),
      input: z.record(z.string(), z.any()),
      error: z.string(),
      metadata: z.record(z.string(), z.any()).optional(),
      time: z.object({
        start: z.number(),
        end: z.number(),
      }),
    })
    .meta({
      ref: "ToolStateError",
    })
  export type ToolStateError = z.infer<typeof ToolStateError>

  export const ToolState = z
    .discriminatedUnion("status", [ToolStatePending, ToolStateRunning, ToolStateCompleted, ToolStateError])
    .meta({
      ref: "ToolState",
    })

  export const ToolPart = PartBase.extend({
    type: z.literal("tool"),
    callID: z.string(),
    tool: z.string(),
    state: ToolState,
    metadata: z.record(z.string(), z.any()).optional(),
  }).meta({
    ref: "ToolPart",
  })
  export type ToolPart = z.infer<typeof ToolPart>

  const Base = z.object({
    id: z.string(),
    sessionID: z.string(),
  })

  export const User = Base.extend({
    role: z.literal("user"),
    time: z.object({
      created: z.number(),
    }),
    summary: z
      .object({
        title: z.string().optional(),
        body: z.string().optional(),
        diffs: Snapshot.FileDiff.array(),
      })
      .optional(),
    agent: z.string(),
    model: z.object({
      providerID: z.string(),
      modelID: z.string(),
    }),
    system: z.string().optional(),
    tools: z.record(z.string(), z.boolean()).optional(),
    variant: z.string().optional(),
    /** Enable extended thinking for Claude Code mode */
    thinking: z.boolean().optional(),
    /** Use Claude Code flow (Agent SDK) - for OpenRouter models in Claude Code mode */
    claudeCodeFlow: z.boolean().optional(),
  }).meta({
    ref: "UserMessage",
  })
  export type User = z.infer<typeof User>

  export const Part = z
    .discriminatedUnion("type", [
      TextPart,
      SubtaskPart,
      ReasoningPart,
      FilePart,
      ToolPart,
      StepStartPart,
      StepFinishPart,
      SnapshotPart,
      PatchPart,
      AgentPart,
      RetryPart,
      CompactionPart,
    ])
    .meta({
      ref: "Part",
    })
  export type Part = z.infer<typeof Part>

  export const Assistant = Base.extend({
    role: z.literal("assistant"),
    time: z.object({
      created: z.number(),
      completed: z.number().optional(),
    }),
    error: z
      .discriminatedUnion("name", [
        AuthError.Schema,
        NamedError.Unknown.Schema,
        OutputLengthError.Schema,
        AbortedError.Schema,
        APIError.Schema,
      ])
      .optional(),
    parentID: z.string(),
    modelID: z.string(),
    providerID: z.string(),
    /**
     * @deprecated
     */
    mode: z.string(),
    agent: z.string(),
    path: z.object({
      cwd: z.string(),
      root: z.string(),
    }),
    summary: z.boolean().optional(),
    cost: z.number(),
    tokens: z.object({
      input: z.number(),
      output: z.number(),
      reasoning: z.number(),
      cache: z.object({
        read: z.number(),
        write: z.number(),
      }),
    }),
    finish: z.string().optional(),
  }).meta({
    ref: "AssistantMessage",
  })
  export type Assistant = z.infer<typeof Assistant>

  export const Info = z.discriminatedUnion("role", [User, Assistant]).meta({
    ref: "Message",
  })
  export type Info = z.infer<typeof Info>

  export const Event = {
    Updated: BusEvent.define(
      "message.updated",
      z.object({
        info: Info,
      }),
    ),
    Removed: BusEvent.define(
      "message.removed",
      z.object({
        sessionID: z.string(),
        messageID: z.string(),
      }),
    ),
    PartUpdated: BusEvent.define(
      "message.part.updated",
      z.object({
        part: Part,
        delta: z.string().optional(),
      }),
    ),
    PartRemoved: BusEvent.define(
      "message.part.removed",
      z.object({
        sessionID: z.string(),
        messageID: z.string(),
        partID: z.string(),
      }),
    ),
  }

  export const WithParts = z.object({
    info: Info,
    parts: z.array(Part),
  })
  export type WithParts = z.infer<typeof WithParts>

  export function toModelMessage(input: WithParts[]): ModelMessage[] {
    const result: UIMessage[] = []

    for (const msg of input) {
      if (msg.parts.length === 0) continue

      if (msg.info.role === "user") {
        const userMessage: UIMessage = {
          id: msg.info.id,
          role: "user",
          parts: [],
        }
        result.push(userMessage)
        for (const part of msg.parts) {
          if (part.type === "text" && !part.ignored)
            userMessage.parts.push({
              type: "text",
              text: part.text,
            })
          // text/plain and directory files are converted into text parts, ignore them
          if (part.type === "file" && part.mime !== "text/plain" && part.mime !== "application/x-directory")
            userMessage.parts.push({
              type: "file",
              url: part.url,
              mediaType: part.mime,
              filename: part.filename,
            })

          if (part.type === "compaction") {
            userMessage.parts.push({
              type: "text",
              text: "What did we do so far?",
            })
          }
          if (part.type === "subtask") {
            userMessage.parts.push({
              type: "text",
              text: "The following tool was executed by the user",
            })
          }
        }
      }

      if (msg.info.role === "assistant") {
        if (
          msg.info.error &&
          !(
            MessageV2.AbortedError.isInstance(msg.info.error) &&
            msg.parts.some((part) => part.type !== "step-start" && part.type !== "reasoning")
          )
        ) {
          continue
        }
        const assistantMessage: UIMessage = {
          id: msg.info.id,
          role: "assistant",
          parts: [],
        }
        for (const part of msg.parts) {
          if (part.type === "text")
            assistantMessage.parts.push({
              type: "text",
              text: part.text,
              providerMetadata: part.metadata,
            })
          if (part.type === "step-start")
            assistantMessage.parts.push({
              type: "step-start",
            })
          if (part.type === "tool") {
            if (part.state.status === "completed") {
              if (part.state.attachments?.length) {
                result.push({
                  id: Identifier.ascending("message"),
                  role: "user",
                  parts: [
                    {
                      type: "text",
                      text: `Tool ${part.tool} returned an attachment:`,
                    },
                    ...part.state.attachments.map((attachment) => ({
                      type: "file" as const,
                      url: attachment.url,
                      mediaType: attachment.mime,
                      filename: attachment.filename,
                    })),
                  ],
                })
              }
              assistantMessage.parts.push({
                type: ("tool-" + part.tool) as `tool-${string}`,
                state: "output-available",
                toolCallId: part.callID,
                input: part.state.input,
                output: part.state.time.compacted ? "[Old tool result content cleared]" : part.state.output,
                callProviderMetadata: part.metadata,
              })
            }
            if (part.state.status === "error")
              assistantMessage.parts.push({
                type: ("tool-" + part.tool) as `tool-${string}`,
                state: "output-error",
                toolCallId: part.callID,
                input: part.state.input,
                errorText: part.state.error,
                callProviderMetadata: part.metadata,
              })
          }
          if (part.type === "reasoning") {
            assistantMessage.parts.push({
              type: "reasoning",
              text: part.text,
              providerMetadata: part.metadata,
            })
          }
        }
        if (assistantMessage.parts.length > 0) {
          result.push(assistantMessage)
        }
      }
    }

    return convertToModelMessages(result.filter((msg) => msg.parts.some((part) => part.type !== "step-start")))
  }

  export const stream = fn(Identifier.schema("session"), async function* (sessionID) {
    const cursor = { value: undefined as string | undefined }
    const limit = 200
    while (true) {
      const ids = await Storage.listMessageIDs({
        sessionID,
        limit,
        afterID: cursor.value,
      })
      if (ids.length === 0) return
      for (const id of ids) {
        yield await get({
          sessionID,
          messageID: id,
        })
      }
      cursor.value = ids[ids.length - 1]
    }
  })

  // Storage format for messages with inline parts
  const StoredMessage = z.object({
    info: Info,
    parts: z.array(Part),
  })
  type StoredMessage = z.infer<typeof StoredMessage>

  export const parts = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
    }),
    async (input) => {
      return MessageV2.PartStore.getParts(input.sessionID, input.messageID)
    },
  )

  export const get = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
    }),
    async (input) => {
      const stored = await Storage.read<StoredMessage>(["message", input.sessionID, input.messageID])
      // Always use PartStore.getParts to get the latest parts (including cached but not-yet-flushed)
      const cachedParts = await MessageV2.PartStore.getParts(input.sessionID, input.messageID)
      return {
        info: stored.info,
        parts: cachedParts,
      }
    },
  )

  export async function filterCompacted(stream: AsyncIterable<MessageV2.WithParts>) {
    const result = [] as MessageV2.WithParts[]
    const completed = new Set<string>()
    for await (const msg of stream) {
      result.push(msg)
      if (
        msg.info.role === "user" &&
        completed.has(msg.info.id) &&
        msg.parts.some((part) => part.type === "compaction")
      )
        break
      if (msg.info.role === "assistant" && msg.info.summary && msg.info.finish) completed.add(msg.info.parentID)
    }
    result.reverse()
    return result
  }

  export function fromError(e: unknown, ctx: { providerID: string }) {
    switch (true) {
      case e instanceof DOMException && e.name === "AbortError":
        return new MessageV2.AbortedError(
          { message: e.message },
          {
            cause: e,
          },
        ).toObject()
      case MessageV2.OutputLengthError.isInstance(e):
        return e
      case LoadAPIKeyError.isInstance(e):
        return new MessageV2.AuthError(
          {
            providerID: ctx.providerID,
            message: e.message,
          },
          { cause: e },
        ).toObject()
      case (e as SystemError)?.code === "ECONNRESET":
        return new MessageV2.APIError(
          {
            message: "Connection reset by server",
            isRetryable: true,
            metadata: {
              code: (e as SystemError).code ?? "",
              syscall: (e as SystemError).syscall ?? "",
              message: (e as SystemError).message ?? "",
            },
          },
          { cause: e },
        ).toObject()
      case APICallError.isInstance(e):
        const message = iife(() => {
          let msg = e.message
          if (msg === "") {
            if (e.responseBody) return e.responseBody
            if (e.statusCode) {
              const err = STATUS_CODES[e.statusCode]
              if (err) return err
            }
            return "Unknown error"
          }
          const transformed = ProviderTransform.error(ctx.providerID, e)
          if (transformed !== msg) {
            return transformed
          }
          if (!e.responseBody || (e.statusCode && msg !== STATUS_CODES[e.statusCode])) {
            return msg
          }

          try {
            const body = JSON.parse(e.responseBody)
            // try to extract common error message fields
            const errMsg = body.message || body.error || body.error?.message
            if (errMsg && typeof errMsg === "string") {
              return `${msg}: ${errMsg}`
            }
          } catch {}

          return `${msg}: ${e.responseBody}`
        }).trim()

        return new MessageV2.APIError(
          {
            message,
            statusCode: e.statusCode,
            isRetryable: e.isRetryable,
            responseHeaders: e.responseHeaders,
            responseBody: e.responseBody,
          },
          { cause: e },
        ).toObject()
      case e instanceof Error:
        return new NamedError.Unknown({ message: e.toString() }, { cause: e }).toObject()
      default:
        return new NamedError.Unknown({ message: JSON.stringify(e) }, { cause: e })
    }
  }

  // PartStore - embedded to avoid circular dependency
  export namespace PartStore {
    const log = Log.create({ service: "part-store" })

    const DEBOUNCE_MS = 100
    const MAX_CACHE_SIZE = 100 // Max number of messages to cache

    interface StoredMessageWithParts {
      info: Info
      parts: Part[]
    }

    /**
     * Simple LRU cache with eviction callback
     */
    class LRUCache<K, V> {
      private cache = new Map<K, V>()
      private order: K[] = []

      constructor(
        private maxSize: number,
        private onEvict?: (key: K, value: V) => void,
      ) {}

      get(key: K): V | undefined {
        const value = this.cache.get(key)
        if (value !== undefined) {
          // Move to end (most recently used)
          const idx = this.order.indexOf(key)
          if (idx > -1) {
            this.order.splice(idx, 1)
            this.order.push(key)
          }
        }
        return value
      }

      set(key: K, value: V): void {
        if (this.cache.has(key)) {
          const idx = this.order.indexOf(key)
          if (idx > -1) this.order.splice(idx, 1)
        } else if (this.cache.size >= this.maxSize) {
          const oldest = this.order.shift()
          if (oldest !== undefined) {
            const evicted = this.cache.get(oldest)
            this.cache.delete(oldest)
            if (evicted !== undefined && this.onEvict) {
              this.onEvict(oldest, evicted)
            }
          }
        }
        this.cache.set(key, value)
        this.order.push(key)
      }

      has(key: K): boolean {
        return this.cache.has(key)
      }

      delete(key: K): boolean {
        const idx = this.order.indexOf(key)
        if (idx > -1) this.order.splice(idx, 1)
        return this.cache.delete(key)
      }

      clear(): void {
        this.cache.clear()
        this.order = []
      }
    }

    // Pending flush timers by messageID
    const pendingFlush = new Map<string, Timer>()

    // Track dirty messages that need to be written
    const dirtyMessages = new Set<string>()

    // Eviction handler - flush dirty entries before evicting
    function handleEviction(key: string, _parts: Part[]) {
      if (dirtyMessages.has(key)) {
        const [sessionID, messageID] = key.split(":")
        flushMessage(sessionID, messageID).catch((e) => {
          log.error("failed to flush on eviction", { key, error: e })
        })
      }
      messageInfoCache.delete(key)
      dirtyMessages.delete(key)
      const timer = pendingFlush.get(key)
      if (timer) {
        clearTimeout(timer)
        pendingFlush.delete(key)
      }
    }

    // In-memory cache of parts by messageID with LRU eviction
    const partsCache = new LRUCache<string, Part[]>(MAX_CACHE_SIZE, handleEviction)

    // Message info cache (bounded by parts cache eviction)
    const messageInfoCache = new Map<string, Info>()

    function getCacheKey(sessionID: string, messageID: string) {
      return `${sessionID}:${messageID}`
    }

    export function cacheMessageInfo(info: Info) {
      const key = getCacheKey(info.sessionID, info.id)
      messageInfoCache.set(key, info)
    }

    export async function getParts(sessionID: string, messageID: string): Promise<Part[]> {
      const key = getCacheKey(sessionID, messageID)

      // Check cache first
      const cached = partsCache.get(key)
      if (cached) return cached

      // Read from storage (inline parts format)
      const message = await Storage.read<StoredMessageWithParts>(["message", sessionID, messageID]).catch(() => null)
      if (message?.parts) {
        const parts = message.parts.slice().sort((a, b) => (a.id > b.id ? 1 : -1))
        partsCache.set(key, parts)
        messageInfoCache.set(key, message.info)
        return parts
      }

      // No parts found - return empty array and cache it
      partsCache.set(key, [])
      return []
    }

    export async function updatePart(part: Part): Promise<void> {
      const key = getCacheKey(part.sessionID, part.messageID)

      // Get or initialize cache
      let parts = partsCache.get(key)
      if (!parts) {
        parts = await getParts(part.sessionID, part.messageID)
      }

      // Update part in cache
      const idx = parts.findIndex((p) => p.id === part.id)
      if (idx >= 0) {
        parts[idx] = part
      } else {
        parts.push(part)
        parts.sort((a, b) => (a.id > b.id ? 1 : -1))
      }
      partsCache.set(key, parts)
      dirtyMessages.add(key)

      // Debounce the disk write
      scheduleFlush(part.sessionID, part.messageID)
    }

    export async function removePart(sessionID: string, messageID: string, partID: string): Promise<void> {
      const key = getCacheKey(sessionID, messageID)

      // Get cache
      let parts = partsCache.get(key)
      if (!parts) {
        parts = await getParts(sessionID, messageID)
      }

      // Remove from cache
      const idx = parts.findIndex((p) => p.id === partID)
      if (idx >= 0) {
        parts.splice(idx, 1)
        partsCache.set(key, parts)
        dirtyMessages.add(key)
        scheduleFlush(sessionID, messageID)
      }
    }

    function scheduleFlush(sessionID: string, messageID: string) {
      const key = getCacheKey(sessionID, messageID)

      // Clear existing timer
      const existing = pendingFlush.get(key)
      if (existing) clearTimeout(existing)

      // Schedule new flush
      const timer = setTimeout(() => {
        flushMessage(sessionID, messageID).catch((e) => {
          log.error("failed to flush message", { sessionID, messageID, error: e })
        })
      }, DEBOUNCE_MS)

      pendingFlush.set(key, timer)
    }

    async function flushMessage(sessionID: string, messageID: string): Promise<void> {
      const key = getCacheKey(sessionID, messageID)
      pendingFlush.delete(key)

      if (!dirtyMessages.has(key)) return
      dirtyMessages.delete(key)

      const parts = partsCache.get(key)
      if (!parts) return

      // Get message info from cache or storage
      let info: Info | undefined = messageInfoCache.get(key)
      if (!info) {
        const message = await Storage.read<StoredMessageWithParts>(["message", sessionID, messageID]).catch(() => null)
        if (message?.info) {
          info = message.info
        }
      }

      if (!info) {
        log.warn("cannot flush parts - message info not found", { sessionID, messageID })
        return
      }

      // Write message with inline parts
      await Storage.write(["message", sessionID, messageID], {
        info,
        parts: parts.slice().sort((a, b) => (a.id > b.id ? 1 : -1)),
      })
    }

    export async function flush(sessionID: string, messageID: string): Promise<void> {
      const key = getCacheKey(sessionID, messageID)

      // Clear pending timer
      const timer = pendingFlush.get(key)
      if (timer) {
        clearTimeout(timer)
        pendingFlush.delete(key)
      }

      // Force flush if dirty
      if (dirtyMessages.has(key)) {
        await flushMessage(sessionID, messageID)
      }
    }

    export async function flushAll(): Promise<void> {
      const promises: Promise<void>[] = []
      for (const key of dirtyMessages) {
        const [sessionID, messageID] = key.split(":")
        promises.push(flush(sessionID, messageID))
      }
      await Promise.all(promises)
    }

    export function clearCache(sessionID: string, messageID: string): void {
      const key = getCacheKey(sessionID, messageID)
      partsCache.delete(key)
      messageInfoCache.delete(key)
      dirtyMessages.delete(key)
      const timer = pendingFlush.get(key)
      if (timer) {
        clearTimeout(timer)
        pendingFlush.delete(key)
      }
    }

    export function clearAllCache(): void {
      partsCache.clear()
      messageInfoCache.clear()
      dirtyMessages.clear()
      for (const timer of pendingFlush.values()) {
        clearTimeout(timer)
      }
      pendingFlush.clear()
    }
  }
}
