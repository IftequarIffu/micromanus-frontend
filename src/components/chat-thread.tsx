import { FileTextIcon } from "lucide-react"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
} from "@/components/ai-elements/tool"
import type { UiMessage } from "@/lib/types"

type ChatThreadProps = {
  messages: UiMessage[]
  emptyTitle?: string
  emptyDescription?: string
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
    <Conversation className="h-full">
      <ConversationContent className="mx-auto w-full max-w-3xl">
        {messages.map((message) => (
          <Message from={message.role} key={message.id}>
            <MessageContent>
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
                  {message.pdf ? (
                    <Tool defaultOpen>
                      <ToolHeader
                        title="PDF report"
                        type="tool-pdf"
                        state="output-available"
                      />
                      <ToolContent>
                        <ToolOutput
                          output={
                            <a
                              className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                              href={message.pdf.url}
                              target="_blank"
                              rel="noreferrer"
                              download={message.pdf.filename}
                            >
                              <FileTextIcon className="size-4" />
                              Download PDF
                            </a>
                          }
                          errorText={undefined}
                        />
                      </ToolContent>
                    </Tool>
                  ) : null}
                  {message.content ? (
                    <MessageResponse>{message.content}</MessageResponse>
                  ) : message.status === "streaming" ? (
                    <p className="text-muted-foreground text-sm">Thinking…</p>
                  ) : message.status === "failed" ? (
                    <p className="text-destructive text-sm">
                      Response failed.
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="whitespace-pre-wrap">{message.content}</div>
              )}
            </MessageContent>
          </Message>
        ))}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}
