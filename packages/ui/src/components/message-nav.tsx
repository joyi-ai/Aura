import { UserMessage } from "@opencode-ai/sdk/v2"
import { ComponentProps, Match, Show, splitProps, Switch } from "solid-js"
import { DiffChanges } from "./diff-changes"
import { Tooltip } from "@kobalte/core/tooltip"
import { Virtualizer, type CustomContainerComponentProps, type CustomItemComponentProps } from "virtua/solid"

export function MessageNav(
  props: ComponentProps<"ul"> & {
    messages: UserMessage[]
    current?: UserMessage
    size: "normal" | "compact"
    onMessageSelect: (message: UserMessage) => void
  },
) {
  const [local, others] = splitProps(props, ["messages", "current", "size", "onMessageSelect"])

  const Container = (props: CustomContainerComponentProps) => (
    <ul role="list" data-component="message-nav" data-size={local.size} style={props.style} ref={props.ref} {...others}>
      {props.children}
    </ul>
  )

  const Item = (props: CustomItemComponentProps) => (
    <li data-slot="message-nav-item" style={props.style} ref={props.ref}>
      {props.children}
    </li>
  )

  const content = () => (
    <Virtualizer data={local.messages} as={Container} item={Item} overscan={8}>
      {(message) => {
        const handleClick = () => local.onMessageSelect(message)

        return (
          <Switch>
            <Match when={local.size === "compact"}>
              <div data-slot="message-nav-tick-button" data-active={message.id === local.current?.id || undefined}>
                <div data-slot="message-nav-tick-line" />
              </div>
            </Match>
            <Match when={local.size === "normal"}>
              <button data-slot="message-nav-message-button" onClick={handleClick}>
                <DiffChanges changes={message.summary?.diffs ?? []} variant="bars" />
                <div data-slot="message-nav-title-preview" data-active={message.id === local.current?.id || undefined}>
                  <Show when={message.summary?.title} fallback="New message">
                    {message.summary?.title}
                  </Show>
                </div>
              </button>
            </Match>
          </Switch>
        )
      }}
    </Virtualizer>
  )

  return (
    <Switch>
      <Match when={local.size === "compact"}>
        <Tooltip openDelay={0} closeDelay={300} placement="right-start" gutter={-40} shift={-10} overlap>
          <Tooltip.Trigger as="div">{content()}</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content data-slot="message-nav-tooltip">
              <div data-slot="message-nav-tooltip-content">
                <MessageNav {...props} size="normal" class="" />
              </div>
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip>
      </Match>
      <Match when={local.size === "normal"}>{content()}</Match>
    </Switch>
  )
}
