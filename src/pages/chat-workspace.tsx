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
import { chatDetailToUiMessages } from "@/lib/chat-messages"
import {
  removeChatListItem,
  titleFromChat,
  upsertChatListItem,
} from "@/lib/chat-list"
import { queryKeys } from "@/lib/query-keys"
import { useChat, usePrefetchChatUsage } from "@/hooks/use-api"
import { useAuth } from "@/providers/auth-provider"
import {
  useChatMessages,
  useChatStream,
} from "@/providers/chat-stream-provider"

/**
 * Shared layout for `/new` and `/chat/:chatId` so navigating on `chat_created`
 * does not remount the thread (avoids the empty-state / skeleton flicker).
 */
export function ChatWorkspace() {
  const { chatId: routeChatId } = useParams<{ chatId?: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data, isLoading, error, isError, isSuccess } = useChat(routeChatId)
  const prefetchChatUsage = usePrefetchChatUsage()
  const { hydrateChat, isStreaming, streamingChatId, clearThread } =
    useChatStream()

  // On `/new`, messages live under the pending key until `chat_created` moves
  // them onto the real id — often one frame before the URL updates.
  const threadChatId =
    routeChatId ?? (isStreaming && streamingChatId ? streamingChatId : null)
  const messages = useChatMessages(threadChatId)

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

  // Warm Usage-tab cache as soon as chat detail is available.
  useEffect(() => {
    if (!routeChatId || !isSuccess) return
    prefetchChatUsage(routeChatId)
  }, [routeChatId, isSuccess, prefetchChatUsage])

  useEffect(() => {
    if (!routeChatId || !data) return
    if (isStreaming && streamingChatId === routeChatId) return
    if (messages.length > 0) return

    if (user?.id) {
      // Sync title only — opening a chat must not reorder the sidebar.
      const next = upsertChatListItem(
        user.id,
        {
          chatId: routeChatId,
          title: titleFromChat({
            backendTitle: data.title,
            messages: data.messages,
          }),
          updatedAt: data.created_at,
        },
        { bump: false }
      )
      queryClient.setQueryData(queryKeys.chats(user.id), next)
    }

    hydrateChat(routeChatId, chatDetailToUiMessages(data))
  }, [
    routeChatId,
    data,
    hydrateChat,
    isStreaming,
    streamingChatId,
    messages.length,
    user?.id,
    queryClient,
  ])

  useEffect(() => {
    if (
      !routeChatId ||
      !user?.id ||
      !(isError && error instanceof ApiError && error.code === "chat_not_found")
    ) {
      return
    }
    const next = removeChatListItem(user.id, routeChatId)
    queryClient.setQueryData(queryKeys.chats(user.id), next)
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
