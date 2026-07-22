import { useEffect } from "react"
import { Navigate, useParams } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { ChatComposer } from "@/components/chat-composer"
import { ChatThread } from "@/components/chat-thread"
import { ChatThreadSkeleton } from "@/components/chat-thread-skeleton"
import { ChatUsagePanel } from "@/components/chat-usage-panel"
import { TabsContent } from "@/components/ui/tabs"
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
  const {
    getMessages,
    hydrateChat,
    isStreaming,
    streamingChatId,
    clearThread,
  } = useChatStream()

  const messages = getMessages(chatId)

  useEffect(() => {
    if (!chatId || !data) return
    // Don't clobber an in-flight stream for this chat.
    if (isStreaming && streamingChatId === chatId) return
    // Keep SSE-merged local messages; refetching after `done` often returns
    // briefly-stale data and would make the reply flicker away/back.
    if (messages.length > 0) return

    const byMessage = new Map<string, { title: string; url: string }[]>()
    for (const s of data.sources) {
      const list = byMessage.get(s.message_id) ?? []
      list.push({ title: s.source_link, url: s.source_link })
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
    streamingChatId,
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
    clearThread(chatId)
  }, [chatId, user?.id, isError, error, clearThread, queryClient])

  if (!chatId) {
    return <Navigate to="/new" replace />
  }

  if (isError && error instanceof ApiError && error.code === "chat_not_found") {
    return <Navigate to="/new" replace />
  }

  // Prefer local/streamed thread; only skeleton while waiting on the network
  // with nothing cached for this chat yet.
  const showSkeleton = messages.length === 0 && isLoading

  return (
    <div className="relative -mt-14 flex min-h-0 flex-1 flex-col overflow-hidden">
      <TabsContent
        value="chat"
        keepMounted
        className="relative min-h-0 flex-1 overflow-hidden data-hidden:hidden"
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">
            {showSkeleton ? (
              <ChatThreadSkeleton />
            ) : (
              <ChatThread messages={messages} />
            )}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
            <div className="pointer-events-auto">
              <ChatComposer chatId={chatId} sticky />
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent
        value="usage"
        className="min-h-0 flex-1 overflow-hidden pt-14 data-hidden:hidden"
      >
        <ChatUsagePanel chatId={chatId} />
      </TabsContent>
    </div>
  )
}
