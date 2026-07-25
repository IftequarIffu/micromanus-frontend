import { CheckIcon, CopyIcon, FileTextIcon } from "lucide-react"
import { useState } from "react"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources"
import type { UiMessage, UiToolCall } from "@/lib/types"

type ChatThreadProps = {
  messages: UiMessage[]
  emptyTitle?: string
  emptyDescription?: string
}

function liveToolLabel(toolName: string): string {
  switch (toolName) {
    case "web_search":
      return "Searching the web…"
    case "create_pdf":
      return "Creating PDF…"
    default:
      return `Running ${toolName}…`
  }
}

/** Quiet one-liner after tools finish (deduped by tool name). */
function toolSummary(tools: UiToolCall[]): string | null {
  if (tools.length === 0) return null

  const parts: string[] = []
  const searches = tools.filter((t) => t.toolName === "web_search")
  if (searches.length > 0) {
    const failed = searches.some((t) => t.status === "error")
    if (failed) {
      parts.push("Web search failed")
    } else if (searches.length > 1) {
      parts.push(`Searched the web (${searches.length}×)`)
    } else {
      parts.push("Searched the web")
    }
  }

  const pdfs = tools.filter((t) => t.toolName === "create_pdf")
  if (pdfs.length > 0) {
    const failed = pdfs.some((t) => t.status === "error")
    parts.push(failed ? "PDF creation failed" : "Created PDF")
  }

  const others = tools.filter(
    (t) => t.toolName !== "web_search" && t.toolName !== "create_pdf"
  )
  for (const t of others) {
    parts.push(
      t.status === "error" ? `${t.toolName} failed` : `Used ${t.toolName}`
    )
  }

  return parts.length > 0 ? parts.join(" · ") : null
}

function StreamingStatus({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-2.5 py-0.5"
      role="status"
      aria-live="polite"
      aria-label={label.replace(/…$/, "")}
    >
      <span className="inline-flex items-center gap-1" aria-hidden>
        <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s] [animation-duration:0.9s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s] [animation-duration:0.9s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-duration:0.9s]" />
      </span>
      <span className="text-shimmer text-sm font-medium tracking-wide">
        {label}
      </span>
    </div>
  )
}

function ToolActivity({
  tools,
  streaming,
}: {
  tools: UiToolCall[] | undefined
  streaming: boolean
}) {
  if (!tools || tools.length === 0) return null

  const running = [...tools].reverse().find((t) => t.status === "running")
  if (streaming && running) {
    return <StreamingStatus label={liveToolLabel(running.toolName)} />
  }

  // While still streaming but between tools / before tokens, avoid a stale summary.
  if (streaming) return null

  const summary = toolSummary(tools)
  if (!summary) return null

  return (
    <p className="mb-2 text-muted-foreground text-xs tracking-wide">{summary}</p>
  )
}

function CopyMessageAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <MessageAction
      label={copied ? "Copied" : "Copy"}
      tooltip={copied ? "Copied" : "Copy"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        } catch {
          // Clipboard may be unavailable in insecure contexts.
        }
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </MessageAction>
  )
}

export function ChatThread({
  messages,
  emptyTitle = "Start a conversation",
  emptyDescription = "Send a message to create a chat. History stays on the server; the sidebar is local.",
}: ChatThreadProps) {
  if (messages.length === 0) {
    return (
      <ConversationEmptyState
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <Conversation className="h-full min-h-0">
      <ConversationContent className="mx-auto w-full max-w-3xl pt-18 pb-40">
        {messages.map((message) => {
          const streaming = message.status === "streaming"
          const hasRunningTool = message.tools?.some(
            (t) => t.status === "running"
          )

          return (
            <Message from={message.role} key={message.id}>
              <MessageContent
                className={
                  message.role === "assistant" ? "w-full max-w-none" : undefined
                }
              >
                {message.role === "assistant" ? (
                  <>
                    {message.sources && message.sources.length > 0 ? (
                      <Sources>
                        <SourcesTrigger count={message.sources.length} />
                        <SourcesContent>
                          {message.sources.map((s) => (
                            <Source key={s.url} href={s.url} title={s.title} />
                          ))}
                        </SourcesContent>
                      </Sources>
                    ) : null}

                    <ToolActivity tools={message.tools} streaming={streaming} />

                    {message.pdf ? (
                      <a
                        className="mb-3 inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        href={message.pdf.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileTextIcon className="size-4 shrink-0" aria-hidden />
                        View PDF
                        <span className="max-w-[14rem] truncate text-muted-foreground font-normal">
                          {message.pdf.filename}
                        </span>
                      </a>
                    ) : null}

                    {message.content ? (
                      <MessageResponse
                        className="text-[15px] leading-7"
                        isAnimating={streaming}
                      >
                        {message.content}
                      </MessageResponse>
                    ) : streaming && !hasRunningTool ? (
                      <StreamingStatus label="Thinking…" />
                    ) : message.status === "failed" ? (
                      <p className="text-destructive text-sm">
                        Response failed.
                      </p>
                    ) : null}

                    {message.content && message.status === "complete" ? (
                      <MessageActions className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <CopyMessageAction text={message.content} />
                      </MessageActions>
                    ) : null}
                  </>
                ) : (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
              </MessageContent>
            </Message>
          )
        })}
      </ConversationContent>
      <ConversationScrollButton className="bottom-36" />
    </Conversation>
  )
}
