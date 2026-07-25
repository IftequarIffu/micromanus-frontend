import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { useNavigate } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ApiError, postChatMessageStream } from "@/lib/api"
import { titleFromContent, upsertChatListItem } from "@/lib/chat-list"
import {
  appendAssistantToken,
  applyToolEnd,
  applyToolStart,
  consumeChatSse,
  finalizeAssistant,
  localMessageId,
  markAssistantFailed,
  PENDING_THREAD_KEY,
  setAssistantPdf,
  threadKey,
} from "@/lib/chat-stream"
import {
  deleteChatThread,
  getThreadMessages,
  movePendingThread,
  replaceChatThread,
  subscribeChatThreads,
  updateChatThread,
} from "@/lib/chat-thread-store"
import { messageForCode } from "@/lib/errors"
import { queryKeys } from "@/lib/query-keys"
import type { UiMessage } from "@/lib/types"
import { useAuth } from "@/providers/auth-provider"

type SendArgs = {
  content: string
  model: string
  chatId?: string
}

type ChatStreamContextValue = {
  activeChatId: string | null
  /** Chat currently receiving SSE tokens, if any. */
  streamingChatId: string | null
  isStreaming: boolean
  error: string | null
  hydrateChat: (chatId: string, messages: UiMessage[]) => void
  clearThread: (chatId?: string | null) => void
  sendMessage: (args: SendArgs) => Promise<void>
  stop: () => void
}

const ChatStreamContext = createContext<ChatStreamContextValue | null>(null)

export function ChatStreamProvider({ children }: { children: ReactNode }) {
  const { token, user, signOut } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [streamingChatId, setStreamingChatId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const streamChatIdRef = useRef<string | null>(null)

  const clearThread = useCallback((chatId?: string | null) => {
    deleteChatThread(threadKey(chatId))
    setActiveChatId((id) => (chatId == null || id === chatId ? null : id))
    setError(null)
  }, [])

  const hydrateChat = useCallback((chatId: string, next: UiMessage[]) => {
    replaceChatThread(chatId, next)
    setActiveChatId(chatId)
    setError(null)
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const sendMessage = useCallback(
    async ({ content, model, chatId }: SendArgs) => {
      if (!token) {
        toast.error("Please sign in.")
        return
      }

      const trimmed = content.trim()
      if (!trimmed || isStreaming) return

      setError(null)
      const userMsg: UiMessage = {
        id: localMessageId("user"),
        role: "user",
        content: trimmed,
        status: "complete",
      }
      const assistantId = localMessageId("assistant")
      const assistantMsg: UiMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        status: "streaming",
      }

      const initialKey = threadKey(chatId ?? activeChatId)
      // Keep a stable stream id from the first optimistic paint so `/new` can
      // resolve the pending thread until `chat_created` assigns a real id.
      streamChatIdRef.current = chatId ?? activeChatId
      setStreamingChatId(streamChatIdRef.current)
      setActiveChatId(chatId ?? activeChatId)
      updateChatThread(initialKey, (prev) => [...prev, userMsg, assistantMsg])
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await postChatMessageStream({
          token,
          content: trimmed,
          model,
          chatId: chatId ?? activeChatId ?? undefined,
          signal: controller.signal,
        })

        const contentType = res.headers.get("content-type") ?? ""

        if (!res.ok || !contentType.includes("text/event-stream")) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string
            code?: string
          }
          const code = body.code ?? "unknown"
          if (res.status === 401 || code === "unauthorized") {
            await signOut()
            return
          }
          throw new ApiError(
            body.error ?? "request_failed",
            res.status,
            code
          )
        }

        if (!res.body) {
          throw new ApiError("empty_stream", 500, "llm_failed")
        }

        const result = await consumeChatSse(res.body, {
          onChatCreated: (newId) => {
            streamChatIdRef.current = newId
            setStreamingChatId(newId)
            setActiveChatId(newId)
            movePendingThread(newId, PENDING_THREAD_KEY)
            if (user?.id) {
              const next = upsertChatListItem(user.id, {
                chatId: newId,
                title: titleFromContent(trimmed),
                updatedAt: new Date().toISOString(),
              })
              queryClient.setQueryData(queryKeys.chats(user.id), next)
            }
            navigate(`/chat/${newId}`, { replace: true })
          },
          onToken: (text) => {
            updateChatThread(threadKey(streamChatIdRef.current), (prev) =>
              appendAssistantToken(prev, assistantId, text)
            )
          },
          onPdfReady: (pdf) => {
            updateChatThread(threadKey(streamChatIdRef.current), (prev) =>
              setAssistantPdf(prev, assistantId, pdf)
            )
          },
          onToolStart: (tool) => {
            updateChatThread(threadKey(streamChatIdRef.current), (prev) =>
              applyToolStart(prev, assistantId, tool)
            )
          },
          onToolEnd: (tool) => {
            updateChatThread(threadKey(streamChatIdRef.current), (prev) =>
              applyToolEnd(prev, assistantId, tool)
            )
          },
          onError: ({ message, code }) => {
            const msg = messageForCode(code, message)
            setError(msg)
            toast.error(msg)
          },
          onDoneSuccess: (done) => {
            streamChatIdRef.current = done.chatId
            setStreamingChatId(done.chatId)
            setActiveChatId(done.chatId)
            if (user?.id) {
              const next = upsertChatListItem(
                user.id,
                {
                  chatId: done.chatId,
                  title: titleFromContent(trimmed),
                  updatedAt: new Date().toISOString(),
                },
                // Keep the first-message title; don't rename on follow-ups.
                { keepTitle: true }
              )
              queryClient.setQueryData(queryKeys.chats(user.id), next)
            }
            void queryClient.invalidateQueries({
              queryKey: queryKeys.credits(),
            })
            void queryClient.invalidateQueries({ queryKey: queryKeys.chats() })
            // Refresh cache for later visits; ChatWorkspace skips hydrate while
            // this thread already has local messages so the reply won't flicker.
            if (done.chatId) {
              void queryClient.invalidateQueries({
                queryKey: queryKeys.chat(done.chatId),
              })
            }
          },
          onDoneFailure: () => {},
        })

        updateChatThread(
          threadKey(streamChatIdRef.current ?? result.resolvedChatId),
          (prev) =>
            finalizeAssistant(prev, assistantId, {
              doneOk: result.doneOk,
              finalMessageId: result.finalMessageId,
              sources: result.sources,
              pdf: result.pdf,
            })
        )

        if (!result.doneOk) {
          setError((e) => e ?? "The assistant response failed.")
        }
      } catch (err) {
        const key = threadKey(streamChatIdRef.current ?? chatId ?? activeChatId)
        if (err instanceof DOMException && err.name === "AbortError") {
          updateChatThread(key, (prev) =>
            markAssistantFailed(prev, assistantId, { onlyIfStreaming: true })
          )
          return
        }

        const code = err instanceof ApiError ? err.code : "unknown"
        const msg =
          err instanceof ApiError
            ? messageForCode(code, err.message)
            : "Failed to send message."

        if (err instanceof ApiError && err.status === 401) {
          await signOut()
          return
        }

        setError(msg)
        toast.error(msg)
        updateChatThread(key, (prev) => markAssistantFailed(prev, assistantId))
      } finally {
        setIsStreaming(false)
        setStreamingChatId(null)
        streamChatIdRef.current = null
        abortRef.current = null
      }
    },
    [
      token,
      user?.id,
      isStreaming,
      activeChatId,
      navigate,
      queryClient,
      signOut,
    ]
  )

  const value = useMemo(
    () => ({
      activeChatId,
      streamingChatId,
      isStreaming,
      error,
      hydrateChat,
      clearThread,
      sendMessage,
      stop,
    }),
    [
      activeChatId,
      streamingChatId,
      isStreaming,
      error,
      hydrateChat,
      clearThread,
      sendMessage,
      stop,
    ]
  )

  return (
    <ChatStreamContext.Provider value={value}>
      {children}
    </ChatStreamContext.Provider>
  )
}

export function useChatStream() {
  const ctx = useContext(ChatStreamContext)
  if (!ctx) {
    throw new Error("useChatStream must be used within ChatStreamProvider")
  }
  return ctx
}

/**
 * Subscribe to one thread's messages. Token updates re-render only this
 * subscriber — not every `useChatStream()` consumer.
 */
export function useChatMessages(chatId?: string | null) {
  const key = threadKey(chatId)
  return useSyncExternalStore(
    subscribeChatThreads,
    () => getThreadMessages(key),
    () => getThreadMessages(key)
  )
}
