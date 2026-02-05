import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk"

export namespace ClaudeAgentPromptBuilder {
  export interface ImageInput {
    data: string // base64 encoded image data
    mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
  }

  /**
   * Create a streaming prompt for the SDK (always uses AsyncGenerator)
   * This enables full streaming input mode with support for:
   * - Image attachments
   * - Message queueing
   * - Interruption via query.interrupt()
   * - Dynamic permission/model changes
   */
  export async function* createStreamingPrompt(
    text: string,
    images: ImageInput[] | undefined,
    sessionID: string,
  ): AsyncIterable<SDKUserMessage> {
    // Build content array
    const content: Array<
      { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
    > = []

    // Add image blocks first (if any)
    if (images && images.length > 0) {
      for (const image of images) {
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: image.mediaType,
            data: image.data,
          },
        })
      }
    }

    // Add text block
    content.push({
      type: "text",
      text,
    })

    // Yield the user message in SDK format
    yield {
      type: "user",
      session_id: sessionID,
      parent_tool_use_id: null,
      message: {
        role: "user",
        content,
      },
    } as SDKUserMessage
  }
}
