import { createMemo, createSignal, createEffect } from "solid-js"
import { HomeContent } from "@/components/home-content"
import { PromptInput } from "@/components/prompt-input"
import { SDKProvider } from "@/context/sdk"
import { SyncProvider, useSync } from "@/context/sync"
import { LocalProvider } from "@/context/local"
import { TerminalProvider } from "@/context/terminal"
import { PromptProvider } from "@/context/prompt"
import { FileProvider } from "@/context/file"
import { DataProvider } from "@opencode-ai/ui/context"
import { useGlobalSync } from "@/context/global-sync"
import { useLayout } from "@/context/layout"

export interface HomePromptBarProps {
  directory: string
  onSessionCreated?: (sessionId: string) => void
}

export function HomePromptBar(props: HomePromptBarProps) {
  return (
    <SDKProvider directory={props.directory}>
      <SyncProvider>
        <SyncedHomePrompt directory={props.directory} onSessionCreated={props.onSessionCreated} />
      </SyncProvider>
    </SDKProvider>
  )
}

function SyncedHomePrompt(props: HomePromptBarProps) {
  const sync = useSync()

  return (
    <DataProvider data={sync.data} directory={props.directory} onPermissionRespond={() => Promise.resolve()}>
      <LocalProvider>
        <TerminalProvider>
          <FileProvider>
            <PromptProvider>
              <div class="w-full max-w-200 mx-auto px-6 pb-8">
                <PromptInput onSessionCreated={props.onSessionCreated} />
              </div>
            </PromptProvider>
          </FileProvider>
        </TerminalProvider>
      </LocalProvider>
    </DataProvider>
  )
}

export interface HomeScreenProps {
  selectedProject?: string
  hideLogo?: boolean
  onNavigateMulti?: () => void
  onProjectSelected?: (directory: string) => void
  showRelativeTime?: boolean
  showThemePicker?: boolean
}

export function HomeScreen(props: HomeScreenProps) {
  const layout = useLayout()
  const globalSync = useGlobalSync()
  const [selectedProject, setSelectedProject] = createSignal<string | undefined>(undefined)

  const mostRecent = createMemo(() => {
    const sorted = globalSync.data.project.toSorted(
      (a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created),
    )
    return sorted[0]?.worktree
  })
  const defaultDirectory = createMemo(() => globalSync.data.path.directory)
  const preferredProject = createMemo(() => mostRecent() || defaultDirectory())

  createEffect(() => {
    if (props.selectedProject !== undefined) return
    if (selectedProject() !== undefined) return
    const candidate = preferredProject()
    if (!candidate) return
    setSelectedProject(candidate)
  })

  const effectiveProject = createMemo(() => props.selectedProject ?? selectedProject())

  function handleSelectProject(directory: string) {
    if (props.selectedProject === undefined) {
      setSelectedProject(directory)
    }
    layout.projects.open(directory)
    props.onProjectSelected?.(directory)
  }

  return (
    <div class="flex-1 min-h-0 flex flex-col">
      <HomeContent
        variant="page"
        selectedProject={effectiveProject()}
        hideLogo={props.hideLogo}
        onSelectProject={handleSelectProject}
        onNavigateMulti={props.onNavigateMulti}
        showRelativeTime={props.showRelativeTime}
        showThemePicker={props.showThemePicker}
      />
    </div>
  )
}
