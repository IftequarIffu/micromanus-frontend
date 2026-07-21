import { useEffect, useRef } from "react"
import { ChatComposer } from "@/components/chat-composer"
import { ChatThread } from "@/components/chat-thread"
import { useChatStream } from "@/providers/chat-stream-provider"

export function NewChatPage() {
  const { messages, clearThread, isStreaming } = useChatStream()
  const cleared = useRef(false)

  useEffect(() => {
    if (cleared.current) return
    if (isStreaming) return
    cleared.current = true
    clearThread()
  }, [clearThread, isStreaming])

  const showEmpty = messages.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              micromanus
            </h1>
            <p className="text-muted-foreground max-w-md text-sm">
              Pick a model, send a message, and a chat is created for you.
            </p>
          </div>
          <ChatComposer centered />
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1">
            <ChatThread messages={messages} />
          </div>
          <ChatComposer />
        </>
      )}
    </div>
  )
}
