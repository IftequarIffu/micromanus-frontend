import { useEffect } from "react"
import { Navigate, useParams } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { ChatComposer } from "@/components/chat-composer"
import { ChatThread } from "@/components/chat-thread"
import { ChatThreadSkeleton } from "@/components/chat-thread-skeleton"
import { ApiError } from "@/lib/api"
import {
  notifyChatListUpdated,
  removeChatListItem,
  titleFromChat,
  upsertChatListItem,
} from "@/lib/chat-list"
import { queryKeys } from "@/lib/query-keys"
import { useChat } from "@/hooks/use-api"
import { useAuth } from "@/providers/auth-provider"
import { useChatStream } from "@/providers/chat-stream-provider"
import type { UiMessage } from "@/lib/types"

export function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data, isLoading, error, isError } = useChat(chatId)
  const { messages, hydrateChat, isStreaming, activeChatId, clearThread } =
    useChatStream()

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
    if (user?.id) {
      upsertChatListItem(user.id, {
        chatId,
        title: titleFromChat({
          backendTitle: data.title,
          messages: data.messages,
        }),
        updatedAt: data.created_at,
      })
      notifyChatListUpdated()
    }

    hydrateChat(chatId, next)
  }, [
    chatId,
    data,
    hydrateChat,
    isStreaming,
    activeChatId,
    messages.length,
    user?.id,
  ])

  useEffect(() => {
    if (
      !chatId ||
      !user?.id ||
      !(isError && error instanceof ApiError && error.code === "chat_not_found")
    ) {
      return
    }
    removeChatListItem(user.id, chatId)
    notifyChatListUpdated()
    void queryClient.invalidateQueries({ queryKey: queryKeys.chats() })
    if (activeChatId === chatId) clearThread()
  }, [
    chatId,
    user?.id,
    isError,
    error,
    activeChatId,
    clearThread,
    queryClient,
  ])

  if (!chatId) {
    return <Navigate to="/new" replace />
  }

  if (isError && error instanceof ApiError && error.code === "chat_not_found") {
    return <Navigate to="/new" replace />
  }

  // Thread state lives above the route; until hydrate matches this chatId,
  // keep showing a skeleton instead of the previous chat's messages.
  const isThreadPending = activeChatId !== chatId

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        {isThreadPending || (isLoading && messages.length === 0) ? (
          <ChatThreadSkeleton />
        ) : (
          <ChatThread messages={messages} />
        )}
      </div>
      <ChatComposer chatId={chatId} sticky />
    </div>
  )
}
