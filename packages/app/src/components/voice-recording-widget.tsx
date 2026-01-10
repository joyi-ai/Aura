import { Show } from "solid-js"
import { Spinner } from "@opencode-ai/ui/spinner"
import { AudioWaveform } from "./audio-waveform"
import { useVoice } from "@/context/voice"

export function VoiceRecordingWidget() {
  const voice = useVoice()

  const isListening = () => voice.state.isRecording()
  const isProcessing = () => voice.state.isTranscribing()
  const levels = () => voice.state.audioLevels()

  return (
    <Show when={isListening() || isProcessing()}>
      <div class="flex items-center justify-center">
        <div
          class="relative flex items-center justify-center px-4 py-1.5 rounded-full min-w-32 h-8 pointer-events-none overflow-hidden"
          style={{
            "background-color": "rgba(0, 0, 0, 0.92)",
            "backdrop-filter": "blur(14px)",
            "box-shadow": "0 10px 35px rgba(0, 0, 0, 0.36)",
          }}
        >
          <div class="relative w-32 h-6">
            <Show
              when={!isProcessing()}
              fallback={
                <div class="flex items-center justify-center w-full h-full">
                  <Spinner class="size-4 text-white" />
                </div>
              }
            >
              <AudioWaveform
                levels={levels()}
                active={isListening()}
                processing={isProcessing()}
                strokeColor="white"
                width={120}
                height={36}
                class="transition-opacity duration-150"
                classList={{
                  "opacity-0": isProcessing(),
                }}
              />
            </Show>
            {/* Gradient fade edges */}
            <div
              class="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, rgba(0, 0, 0, 0.9) 0%, transparent 18%, transparent 85%, rgba(0, 0, 0, 0.9) 100%)",
              }}
            />
          </div>
        </div>
      </div>
    </Show>
  )
}
