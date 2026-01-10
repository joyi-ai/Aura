import path from "path"
import { Global } from "../global"
import fs from "fs/promises"
import z from "zod"

export namespace ProviderRouting {
  // OpenRouter routing options
  export const OpenRouterSettings = z.object({
    order: z.array(z.string()).optional(),
    allow_fallbacks: z.boolean().optional(),
    require_parameters: z.boolean().optional(),
    data_collection: z.enum(["allow", "deny"]).optional(),
  })
  export type OpenRouterSettings = z.infer<typeof OpenRouterSettings>

  // Vercel AI Gateway routing options
  export const VercelGatewaySettings = z.object({
    order: z.array(z.string()).optional(),
    only: z.array(z.string()).optional(),
  })
  export type VercelGatewaySettings = z.infer<typeof VercelGatewaySettings>

  // Union of all routing settings
  export const Settings = z.object({
    openrouter: OpenRouterSettings.optional(),
    vercel: VercelGatewaySettings.optional(),
  })
  export type Settings = z.infer<typeof Settings>

  const filepath = path.join(Global.Path.data, "provider-routing.json")

  export async function get(providerID: "openrouter"): Promise<OpenRouterSettings | undefined>
  export async function get(providerID: "vercel"): Promise<VercelGatewaySettings | undefined>
  export async function get(providerID: string): Promise<OpenRouterSettings | VercelGatewaySettings | undefined>
  export async function get(providerID: string): Promise<OpenRouterSettings | VercelGatewaySettings | undefined> {
    const all = await getAll()
    if (providerID === "openrouter") return all.openrouter
    if (providerID === "vercel") return all.vercel
    return undefined
  }

  export async function getAll(): Promise<Settings> {
    const file = Bun.file(filepath)
    const data = await file.json().catch(() => ({}))
    const parsed = Settings.safeParse(data)
    return parsed.success ? parsed.data : {}
  }

  export async function set(
    providerID: "openrouter" | "vercel",
    settings: OpenRouterSettings | VercelGatewaySettings,
  ): Promise<void> {
    const file = Bun.file(filepath)
    const data = await getAll()
    if (providerID === "openrouter") {
      data.openrouter = settings as OpenRouterSettings
    } else if (providerID === "vercel") {
      data.vercel = settings as VercelGatewaySettings
    }
    await Bun.write(file, JSON.stringify(data, null, 2))
    await fs.chmod(file.name!, 0o600)
  }

  export async function remove(providerID: "openrouter" | "vercel"): Promise<void> {
    const file = Bun.file(filepath)
    const data = await getAll()
    if (providerID === "openrouter") {
      delete data.openrouter
    } else if (providerID === "vercel") {
      delete data.vercel
    }
    await Bun.write(file, JSON.stringify(data, null, 2))
    await fs.chmod(file.name!, 0o600)
  }

  // Known providers for OpenRouter
  export const OPENROUTER_PROVIDERS = [
    "Anthropic",
    "OpenAI",
    "Google",
    "Google AI Studio",
    "Azure",
    "AWS Bedrock",
    "Google Vertex",
    "Together",
    "Fireworks",
    "DeepInfra",
    "Lepton",
    "Novita",
    "Avian",
    "Lambda",
    "Cloudflare",
    "Mistral",
    "Groq",
    "Cohere",
    "Perplexity",
    "Hyperbolic",
    "xAI",
    "Cerebras",
    "SambaNova",
    "Mancer",
    "Mancer 2",
    "Lynn 2",
    "Lynn",
    "AI21",
    "DeepSeek",
    "Infermatic",
    "Featherless",
    "Inflection",
    "Replicate",
    "01.AI",
    "Parasail",
    "Klusterai",
    "Nebius",
  ] as const

  // Known providers for Vercel AI Gateway
  export const VERCEL_GATEWAY_PROVIDERS = [
    "anthropic",
    "openai",
    "azure",
    "google",
    "google-vertex",
    "amazon-bedrock",
    "mistral",
    "xai",
    "deepseek",
    "groq",
    "perplexity",
    "fireworks",
    "cohere",
    "together",
  ] as const
}
