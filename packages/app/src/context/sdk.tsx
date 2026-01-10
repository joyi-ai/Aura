import { createOpencodeClient, type Event } from "@opencode-ai/sdk/v2/client"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { createGlobalEmitter } from "@solid-primitives/event-bus"
import { createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useGlobalSDK } from "./global-sdk"
import { usePlatform } from "./platform"

export const { use: useSDK, provider: SDKProvider } = createSimpleContext({
  name: "SDK",
  init: (props: { directory: string }) => {
    const platform = usePlatform()
    const globalSDK = useGlobalSDK()

    const emitter = createGlobalEmitter<{
      [key in Event["type"]]: Extract<Event, { type: key }>
    }>()

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
      event: emitter,
      url: globalSDK.url,
    })

    let unsubscribe: VoidFunction | undefined

    const subscribe = (directory: string) => {
      if (unsubscribe) unsubscribe()
      unsubscribe = globalSDK.event.on(directory, (event) => {
        emitter.emit(event.type, event)
      })
    }

    subscribe(props.directory)

    createEffect(() => {
      const directory = props.directory
      const url = globalSDK.url
      setStore("directory", directory)
      setStore("url", url)
      setStore("client", createClient(directory, url))
      subscribe(directory)
    })

    onCleanup(() => {
      if (unsubscribe) unsubscribe()
    })

    return store
  },
})
