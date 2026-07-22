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
} from "@/lib/types"
import { useAuth } from "@/providers/auth-provider"

type SendArgs = {
  content: string
  model: string
  chatId?: string
}

type ChatStreamContextValue = {
  messages: UiMessage[]
  activeChatId: string | null
  isStreaming: boolean
  error: string | null
  setMessages: (messages: UiMessage[]) => void
  hydrateChat: (chatId: string, messages: UiMessage[]) => void
  clearThread: () => void
  sendMessage: (args: SendArgs) => Promise<void>
  stop: () => void
}

const ChatStreamContext = createContext<ChatStreamContextValue | null>(null)

function localId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

export function ChatStreamProvider({ children }: { children: ReactNode }) {
  const { token, user, signOut } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const streamChatIdRef = useRef<string | null>(null)

  const clearThread = useCallback(() => {
    setMessages([])
    setActiveChatId(null)
    setError(null)
  }, [])

  const hydrateChat = useCallback((chatId: string, next: UiMessage[]) => {
    setActiveChatId(chatId)
    setMessages(next)
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

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller
      streamChatIdRef.current = chatId ?? activeChatId

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
            resolvedChatId = evt.data.chatId
            streamChatIdRef.current = evt.data.chatId
            setActiveChatId(evt.data.chatId)
            if (user?.id) {
              upsertChatListItem(user.id, {
                chatId: evt.data.chatId,
                title: titleFromContent(trimmed),
                updatedAt: new Date().toISOString(),
              })
              notifyChatListUpdated()
            }
            navigate(`/chat/${evt.data.chatId}`, { replace: true })
          }

          if (evt.event === "token") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + evt.data.text }
                  : m
              )
            )
          }

          if (evt.event === "pdf_ready") {
            pdf = { url: evt.data.url, filename: evt.data.filename }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, pdf } : m
              )
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
              // this thread is already on screen so the reply won't flicker.
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

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            return {
              ...m,
              id: finalMessageId ?? m.id,
              status: doneOk ? "complete" : "failed",
              sources,
              pdf,
            }
          })
        )

        if (!doneOk) {
          setError((e) => e ?? "The assistant response failed.")
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setMessages((prev) =>
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
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, status: "failed" } : m
          )
        )
      } finally {
        setIsStreaming(false)
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
      messages,
      activeChatId,
      isStreaming,
      error,
      setMessages,
      hydrateChat,
      clearThread,
      sendMessage,
      stop,
    }),
    [
      messages,
      activeChatId,
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
