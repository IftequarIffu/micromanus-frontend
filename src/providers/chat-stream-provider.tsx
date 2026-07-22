import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useNavigate } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ApiError, parseSseStream, postChatMessageStream } from "@/lib/api"
import {
  notifyChatListUpdated,
  titleFromContent,
  upsertChatListItem,
} from "@/lib/chat-list"
import { messageForCode } from "@/lib/errors"
import { queryKeys } from "@/lib/query-keys"
import type {
  DoneSuccess,
  StreamPdf,
  StreamSource,
  UiMessage,
  UiToolCall,
} from "@/lib/types"
import { useAuth } from "@/providers/auth-provider"

/** Thread key for a new chat before `chat_created` assigns a real id. */
const PENDING_KEY = "__pending__"

type SendArgs = {
  content: string
  model: string
  chatId?: string
}

type ChatStreamContextValue = {
  /** Messages for a chat (or the in-flight new chat when `chatId` is omitted). */
  getMessages: (chatId?: string | null) => UiMessage[]
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

function localId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function threadKey(chatId: string | null | undefined) {
  return chatId ?? PENDING_KEY
}

export function ChatStreamProvider({ children }: { children: ReactNode }) {
  const { token, user, signOut } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [threads, setThreads] = useState<Record<string, UiMessage[]>>({})
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [streamingChatId, setStreamingChatId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const streamChatIdRef = useRef<string | null>(null)

  const getMessages = useCallback(
    (chatId?: string | null) => threads[threadKey(chatId)] ?? [],
    [threads]
  )

  const updateThread = useCallback(
    (
      key: string,
      updater: (prev: UiMessage[]) => UiMessage[]
    ) => {
      setThreads((prev) => ({
        ...prev,
        [key]: updater(prev[key] ?? []),
      }))
    },
    []
  )

  const clearThread = useCallback((chatId?: string | null) => {
    const key = threadKey(chatId)
    setThreads((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setActiveChatId((id) => (chatId == null || id === chatId ? null : id))
    setError(null)
  }, [])

  const hydrateChat = useCallback((chatId: string, next: UiMessage[]) => {
    setThreads((prev) => ({ ...prev, [chatId]: next }))
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
        id: localId("user"),
        role: "user",
        content: trimmed,
        status: "complete",
      }
      const assistantId = localId("assistant")
      const assistantMsg: UiMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        status: "streaming",
      }

      const initialKey = threadKey(chatId ?? activeChatId)
      streamChatIdRef.current = chatId ?? activeChatId
      setStreamingChatId(streamChatIdRef.current)
      setActiveChatId(chatId ?? activeChatId)
      updateThread(initialKey, (prev) => [...prev, userMsg, assistantMsg])
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

        let sources: StreamSource[] = []
        let pdf: StreamPdf | undefined
        let doneOk = false
        let finalMessageId: string | undefined
        let resolvedChatId = chatId ?? activeChatId

        for await (const evt of parseSseStream(res.body)) {
          if (evt.event === "chat_created") {
            const newId = evt.data.chatId
            resolvedChatId = newId
            streamChatIdRef.current = newId
            setStreamingChatId(newId)
            setActiveChatId(newId)
            // Move the pending optimistic thread onto the real chat id.
            setThreads((prev) => {
              const pending = prev[PENDING_KEY] ?? []
              const next = { ...prev }
              delete next[PENDING_KEY]
              next[newId] = pending.length > 0 ? pending : (next[newId] ?? [])
              return next
            })
            if (user?.id) {
              upsertChatListItem(user.id, {
                chatId: newId,
                title: titleFromContent(trimmed),
                updatedAt: new Date().toISOString(),
              })
              notifyChatListUpdated()
            }
            navigate(`/chat/${newId}`, { replace: true })
          }

          const key = threadKey(streamChatIdRef.current)

          if (evt.event === "token") {
            updateThread(key, (prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + evt.data.text }
                  : m
              )
            )
          }

          if (evt.event === "pdf_ready") {
            pdf = { url: evt.data.url, filename: evt.data.filename }
            updateThread(key, (prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, pdf } : m))
            )
          }

          if (evt.event === "tool_start") {
            const { toolCallId, toolName } = evt.data
            updateThread(key, (prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m
                const tools = m.tools ?? []
                if (tools.some((t) => t.toolCallId === toolCallId)) {
                  return {
                    ...m,
                    tools: tools.map((t) =>
                      t.toolCallId === toolCallId
                        ? { ...t, toolName, status: "running" as const }
                        : t
                    ),
                  }
                }
                const next: UiToolCall = {
                  toolCallId,
                  toolName,
                  status: "running",
                }
                return { ...m, tools: [...tools, next] }
              })
            )
          }

          if (evt.event === "tool_end") {
            const { toolCallId, toolName, ok } = evt.data
            updateThread(key, (prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m
                const tools = m.tools ?? []
                const status = ok ? ("complete" as const) : ("error" as const)
                if (tools.some((t) => t.toolCallId === toolCallId)) {
                  return {
                    ...m,
                    tools: tools.map((t) =>
                      t.toolCallId === toolCallId
                        ? { ...t, toolName, status }
                        : t
                    ),
                  }
                }
                return {
                  ...m,
                  tools: [
                    ...tools,
                    { toolCallId, toolName, status } satisfies UiToolCall,
                  ],
                }
              })
            )
          }

          if (evt.event === "error") {
            const msg = messageForCode(evt.data.code, evt.data.message)
            setError(msg)
            toast.error(msg)
          }

          if (evt.event === "done") {
            if (evt.data.ok) {
              const done = evt.data as DoneSuccess
              doneOk = true
              finalMessageId = done.messageId
              sources = done.sources ?? []
              if (done.pdf) pdf = done.pdf
              resolvedChatId = done.chatId
              streamChatIdRef.current = done.chatId
              setStreamingChatId(done.chatId)
              setActiveChatId(done.chatId)
              if (user?.id) {
                upsertChatListItem(
                  user.id,
                  {
                    chatId: done.chatId,
                    title: titleFromContent(trimmed),
                    updatedAt: new Date().toISOString(),
                  },
                  // Keep the first-message title; don't rename on follow-ups.
                  { keepTitle: true }
                )
                notifyChatListUpdated()
              }
              void queryClient.invalidateQueries({ queryKey: queryKeys.credits() })
              void queryClient.invalidateQueries({ queryKey: queryKeys.chats() })
              // Refresh cache for later visits; ChatPage skips hydrate while
              // this thread already has local messages so the reply won't flicker.
              if (done.chatId) {
                void queryClient.invalidateQueries({
                  queryKey: queryKeys.chat(done.chatId),
                })
              }
            } else {
              doneOk = false
            }
          }
        }

        updateThread(threadKey(streamChatIdRef.current ?? resolvedChatId), (prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            return {
              ...m,
              id: finalMessageId ?? m.id,
              status: doneOk ? "complete" : "failed",
              sources,
              pdf,
              tools: m.tools,
            }
          })
        )

        if (!doneOk) {
          setError((e) => e ?? "The assistant response failed.")
        }
      } catch (err) {
        const key = threadKey(streamChatIdRef.current ?? chatId ?? activeChatId)
        if (err instanceof DOMException && err.name === "AbortError") {
          updateThread(key, (prev) =>
            prev.map((m) =>
              m.id === assistantId && m.status === "streaming"
                ? { ...m, status: "failed" }
                : m
            )
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
        updateThread(key, (prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, status: "failed" } : m
          )
        )
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
      updateThread,
    ]
  )

  const value = useMemo(
    () => ({
      getMessages,
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
      getMessages,
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
