import { APIEvent } from "@solidjs/start"
import { DownloadPlatform } from "./types"

const assetNames: Record<string, string> = {
  "darwin-aarch64-dmg": "Aura-desktop-darwin-aarch64.dmg",
  "darwin-x64-dmg": "Aura-desktop-darwin-x64.dmg",
  "windows-x64-nsis": "Aura-desktop-windows-x64.exe",
  "linux-x64-deb": "Aura-desktop-linux-amd64.deb",
  "linux-x64-appimage": "Aura-desktop-linux-amd64.AppImage",
  "linux-x64-rpm": "Aura-desktop-linux-x86_64.rpm",
} satisfies Record<DownloadPlatform, string>

// Doing this on the server lets us preserve the original name for platforms we don't care to rename for
const downloadNames: Record<string, string> = {
  "darwin-aarch64-dmg": "Aura Desktop.dmg",
  "darwin-x64-dmg": "Aura Desktop.dmg",
  "windows-x64-nsis": "Aura Desktop Installer.exe",
} satisfies { [K in DownloadPlatform]?: string }

export async function GET({ params: { platform } }: APIEvent) {
  const assetName = assetNames[platform]
  if (!assetName) return new Response("Not Found", { status: 404 })

  const resp = await fetch(`https://github.com/joyi-ai/Aura/releases/latest/download/${assetName}`, {
    cf: {
      // in case gh releases has rate limits
      cacheTtl: 60 * 5,
      cacheEverything: true,
    },
  } as any)

  const downloadName = downloadNames[platform]

  const headers = new Headers(resp.headers)
  if (downloadName) headers.set("content-disposition", `attachment; filename="${downloadName}"`)

  return new Response(resp.body, { ...resp, headers })
}
