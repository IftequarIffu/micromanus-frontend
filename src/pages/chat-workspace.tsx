import { useEffect, useRef } from "react"
import { Navigate, Outlet, useParams } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { BrandWordmark } from "@/components/brand-wordmark"
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

/**
 * Shared layout for `/new` and `/chat/:chatId` so navigating on `chat_created`
 * does not remount the thread (avoids the empty-state / skeleton flicker).
 */
export function ChatWorkspace() {
  const { chatId: routeChatId } = useParams<{ chatId?: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data, isLoading, error, isError } = useChat(routeChatId)
  const {
    getMessages,
    hydrateChat,
    isStreaming,
    streamingChatId,
    clearThread,
  } = useChatStream()

  // On `/new`, messages live under the pending key until `chat_created` moves
  // them onto the real id — often one frame before the URL updates.
  const threadChatId =
    routeChatId ?? (isStreaming && streamingChatId ? streamingChatId : null)
  const messages = getMessages(threadChatId)

  const clearedPending = useRef(false)
  useEffect(() => {
    if (routeChatId) {
      clearedPending.current = false
      return
    }
    if (clearedPending.current || isStreaming) return
    clearedPending.current = true
    clearThread(null)
  }, [routeChatId, clearThread, isStreaming])

  useEffect(() => {
    if (!routeChatId || !data) return
    if (isStreaming && streamingChatId === routeChatId) return
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

    if (user?.id) {
      upsertChatListItem(user.id, {
        chatId: routeChatId,
        title: titleFromChat({
          backendTitle: data.title,
          messages: data.messages,
        }),
        updatedAt: data.created_at,
      })
      notifyChatListUpdated()
    }

    hydrateChat(routeChatId, next)
  }, [
    routeChatId,
    data,
    hydrateChat,
    isStreaming,
    streamingChatId,
    messages.length,
    user?.id,
  ])

  useEffect(() => {
    if (
      !routeChatId ||
      !user?.id ||
      !(isError && error instanceof ApiError && error.code === "chat_not_found")
    ) {
      return
    }
    removeChatListItem(user.id, routeChatId)
    notifyChatListUpdated()
    void queryClient.invalidateQueries({ queryKey: queryKeys.chats() })
    clearThread(routeChatId)
  }, [routeChatId, user?.id, isError, error, clearThread, queryClient])

  if (isError && error instanceof ApiError && error.code === "chat_not_found") {
    return <Navigate to="/new" replace />
  }

  const showEmpty = !routeChatId && messages.length === 0 && !isStreaming
  const showSkeleton =
    !!routeChatId && messages.length === 0 && isLoading && !isStreaming

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {showEmpty ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-auto p-4 sm:p-6">
          <div className="flex w-full max-w-3xl flex-col items-center gap-3 text-center">
            <h1 className="max-w-full px-1">
              <BrandWordmark size="xl" />
            </h1>
            <p className="max-w-md text-sm text-pretty text-muted-foreground">
              Pick a model, send a message, and a chat is created for you.
            </p>
          </div>
          <div className="w-full max-w-3xl min-w-0">
            <ChatComposer />
          </div>
        </div>
      ) : (
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
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-0 sm:px-2">
                <div className="pointer-events-auto">
                  <ChatComposer chatId={routeChatId} sticky />
                </div>
              </div>
            </div>
          </TabsContent>

          {routeChatId ? (
            <TabsContent
              value="usage"
              className="min-h-0 flex-1 overflow-hidden pt-14 data-hidden:hidden"
            >
              <ChatUsagePanel chatId={routeChatId} />
            </TabsContent>
          ) : null}
        </div>
      )}
      {/* Keep sibling `/new` and `/chat/:id` matches without remounting this layout. */}
      <Outlet />
    </div>
  )
}
