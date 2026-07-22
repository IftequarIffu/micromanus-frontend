import { useEffect } from "react"
import { Navigate, useParams } from "react-router"
import { Spinner } from "@/components/ui/spinner"
import { ChatComposer } from "@/components/chat-composer"
import { ChatThread } from "@/components/chat-thread"
import { ApiError } from "@/lib/api"
import { titleFromChat, upsertChatListItem } from "@/lib/chat-list"
import { useChat } from "@/hooks/use-api"
import { useChatStream } from "@/providers/chat-stream-provider"
import type { UiMessage } from "@/lib/types"

export function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>()
  const { data, isLoading, error, isError } = useChat(chatId)
  const { messages, hydrateChat, isStreaming, activeChatId } = useChatStream()

  useEffect(() => {
    if (!chatId || !data) return
    // Don't clobber an in-flight stream for this chat.
    if (isStreaming && activeChatId === chatId) return
    // Keep SSE-merged local messages; refetching after `done` often returns
    // briefly-stale data and would make the reply flicker away/back.
    if (activeChatId === chatId && messages.length > 0) return

    const byMessage = new Map<string, { title: string; url: string }[]>()
    for (const s of data.sources) {
      const list = byMessage.get(s.message_id) ?? []
      list.push({ title: s.content || s.source_link, url: s.source_link })
      byMessage.set(s.message_id, list)
    }

    const next: UiMessage[] = data.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      status: "complete",
      sources: byMessage.get(m.id),
      ...(m.pdf ? { pdf: m.pdf } : {}),
    }))

    // Heal sidebar title from the conversation opener (or backend title).
    upsertChatListItem({
      chatId,
      title: titleFromChat({
        backendTitle: data.title,
        messages: data.messages,
      }),
      updatedAt: new Date().toISOString(),
    })
    window.dispatchEvent(new Event("micromanus:chat-list-updated"))

    hydrateChat(chatId, next)
  }, [chatId, data, hydrateChat, isStreaming, activeChatId, messages.length])

  if (!chatId) {
    return <Navigate to="/new" replace />
  }

  if (isError && error instanceof ApiError && error.code === "chat_not_found") {
    return <Navigate to="/new" replace />
  }

  if (isLoading && messages.length === 0 && activeChatId !== chatId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        <ChatThread messages={messages} />
      </div>
      <ChatComposer chatId={chatId} />
    </div>
  )
}
