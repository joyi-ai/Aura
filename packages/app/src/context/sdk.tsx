import { createOpencodeClient, type Event } from "@opencode-ai/sdk/v2/client"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { createGlobalEmitter } from "@solid-primitives/event-bus"
import { createEffect, createRoot, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useGlobalSDK } from "./global-sdk"
import { usePlatform } from "./platform"

type EventEmitter = ReturnType<typeof createGlobalEmitter<{
  [key in Event["type"]]: Extract<Event, { type: key }>
}>>

type EmitterEntry = {
  emitter: EventEmitter
  refs: number
  unsubscribe: VoidFunction
  dispose: () => void
}

const emitterCache = new Map<string, EmitterEntry>()

function releaseEmitter(directory: string) {
  const entry = emitterCache.get(directory)
  if (!entry) return
  const next = entry.refs - 1
  if (next > 0) {
    entry.refs = next
    return
  }
  emitterCache.delete(directory)
  entry.unsubscribe()
  entry.dispose()
}

function acquireEmitter(directory: string, globalSDK: ReturnType<typeof useGlobalSDK>) {
  const existing = emitterCache.get(directory)
  if (existing) {
    existing.refs += 1
    return { emitter: existing.emitter, release: () => releaseEmitter(directory) }
  }

  const created = createRoot((dispose) => {
    const emitter = createGlobalEmitter<{
      [key in Event["type"]]: Extract<Event, { type: key }>
    }>()
    const unsubscribe = globalSDK.event.on(directory, (event) => {
      emitter.emit(event.type, event)
    })
    return { emitter, unsubscribe, dispose }
  })

  emitterCache.set(directory, {
    emitter: created.emitter,
    refs: 1,
    unsubscribe: created.unsubscribe,
    dispose: created.dispose,
  })

  return { emitter: created.emitter, release: () => releaseEmitter(directory) }
}

export const { use: useSDK, provider: SDKProvider } = createSimpleContext({
  name: "SDK",
  init: (props: { directory: string }) => {
    const platform = usePlatform()
    const globalSDK = useGlobalSDK()
    const event = createGlobalEmitter<{
      [key in Event["type"]]: Extract<Event, { type: key }>
    }>()
    const attachEmitter = (directory: string) => {
      const entry = acquireEmitter(directory, globalSDK)
      const stop = entry.emitter.listen((payload) => {
        event.emit(payload.name, payload.details)
      })
      return { release: entry.release, stop }
    }
    const entry = attachEmitter(props.directory)
    const releaseRef = { value: entry.release }
    const stopRef = { value: entry.stop }
    const state = { directory: props.directory }

    const createClient = (directory: string, url: string) =>
      createOpencodeClient({
        baseUrl: url,
        fetch: platform.fetch,
        directory,
        throwOnError: true,
      })

    const [store, setStore] = createStore({
      directory: props.directory,
      client: createClient(props.directory, globalSDK.url),
      event,
      url: globalSDK.url,
    })

    const bindEmitter = (directory: string) => {
      if (state.directory === directory) return
      state.directory = directory
      const stop = stopRef.value
      if (stop) stop()
      const release = releaseRef.value
      if (release) release()
      const next = attachEmitter(directory)
      releaseRef.value = next.release
      stopRef.value = next.stop
    }

    createEffect(() => {
      const directory = props.directory
      const url = globalSDK.url
      setStore("directory", directory)
      setStore("url", url)
      setStore("client", createClient(directory, url))
      bindEmitter(directory)
    })

    onCleanup(() => {
      const stop = stopRef.value
      if (stop) stop()
      const release = releaseRef.value
      if (release) release()
    })

    return store
  },
})
