import { createMemo, Show, type ParentProps } from "solid-js"
import { useParams } from "@solidjs/router"
import { SDKProvider, useSDK } from "@/context/sdk"
import { SyncProvider, useSync } from "@/context/sync"
import { LocalProvider } from "@/context/local"

import { base64Decode } from "@opencode-ai/util/encode"
import { DataProvider } from "@opencode-ai/ui/context"
import { iife } from "@opencode-ai/util/iife"
import { useGlobalSDK } from "@/context/global-sdk"

export default function Layout(props: ParentProps) {
  const params = useParams()
  const directory = createMemo(() => {
    return base64Decode(params.dir!)
  })
  return (
    <Show when={params.dir}>
      <SDKProvider directory={directory()}>
        <SyncProvider>
          {iife(() => {
            const sync = useSync()
            const sdk = useSDK()
            const globalSDK = useGlobalSDK()

            const respondToPermission = (input: {
              sessionID: string
              permissionID: string
              response: "once" | "always" | "reject"
            }) => sdk.client.permission.respond(input)

            const respondToAskUser = async (input: { requestID: string; answers: Record<string, string> }) => {
              const response = await fetch(`${globalSDK.url}/askuser/${input.requestID}/reply`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-opencode-directory": directory(),
                },
                body: JSON.stringify({ answers: input.answers }),
              })
              return response.json()
            }

            const respondToPlanMode = async (input: { requestID: string; approved: boolean }) => {
              const response = await fetch(`${globalSDK.url}/planmode/${input.requestID}/reply`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-opencode-directory": directory(),
                },
                body: JSON.stringify({ approved: input.approved }),
              })
              return response.json()
            }

            return (
              <DataProvider
                data={sync.data}
                directory={directory()}
                onPermissionRespond={respondToPermission}
                onAskUserRespond={respondToAskUser}
                onPlanModeRespond={respondToPlanMode}
              >
                <LocalProvider>{props.children}</LocalProvider>
              </DataProvider>
            )
          })}
        </SyncProvider>
      </SDKProvider>
    </Show>
  )
}
