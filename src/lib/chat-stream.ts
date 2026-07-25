import { parseSseStream } from "@/lib/api"
import type {
  DoneSuccess,
  SseEvent,
  StreamPdf,
  StreamSource,
  UiMessage,
  UiToolCall,
} from "@/lib/types"

/** Thread key for a new chat before `chat_created` assigns a real id. */
export const PENDING_THREAD_KEY = "__pending__"

export function localMessageId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

export function threadKey(chatId: string | null | undefined) {
  return chatId ?? PENDING_THREAD_KEY
}

export function appendAssistantToken(
  messages: UiMessage[],
  assistantId: string,
  text: string
): UiMessage[] {
  return messages.map((m) =>
    m.id === assistantId ? { ...m, content: m.content + text } : m
  )
}

export function setAssistantPdf(
  messages: UiMessage[],
  assistantId: string,
  pdf: StreamPdf
): UiMessage[] {
  return messages.map((m) => (m.id === assistantId ? { ...m, pdf } : m))
}

export function applyToolStart(
  messages: UiMessage[],
  assistantId: string,
  tool: Pick<UiToolCall, "toolCallId" | "toolName">
): UiMessage[] {
  return messages.map((m) => {
    if (m.id !== assistantId) return m
    const tools = m.tools ?? []
    if (tools.some((t) => t.toolCallId === tool.toolCallId)) {
      return {
        ...m,
        tools: tools.map((t) =>
          t.toolCallId === tool.toolCallId
            ? { ...t, toolName: tool.toolName, status: "running" as const }
            : t
        ),
      }
    }
    return {
      ...m,
      tools: [
        ...tools,
        {
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
          status: "running",
        } satisfies UiToolCall,
      ],
    }
  })
}

export function applyToolEnd(
  messages: UiMessage[],
  assistantId: string,
  tool: Pick<UiToolCall, "toolCallId" | "toolName"> & { ok: boolean }
): UiMessage[] {
  const status = tool.ok ? ("complete" as const) : ("error" as const)
  return messages.map((m) => {
    if (m.id !== assistantId) return m
    const tools = m.tools ?? []
    if (tools.some((t) => t.toolCallId === tool.toolCallId)) {
      return {
        ...m,
        tools: tools.map((t) =>
          t.toolCallId === tool.toolCallId
            ? { ...t, toolName: tool.toolName, status }
            : t
        ),
      }
    }
    return {
      ...m,
      tools: [
        ...tools,
        {
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
          status,
        } satisfies UiToolCall,
      ],
    }
  })
}

export function finalizeAssistant(
  messages: UiMessage[],
  assistantId: string,
  opts: {
    doneOk: boolean
    finalMessageId?: string
    sources: StreamSource[]
    pdf?: StreamPdf
  }
): UiMessage[] {
  return messages.map((m) => {
    if (m.id !== assistantId) return m
    return {
      ...m,
      id: opts.finalMessageId ?? m.id,
      status: opts.doneOk ? "complete" : "failed",
      sources: opts.sources,
      pdf: opts.pdf,
      tools: m.tools,
    }
  })
}

export function markAssistantFailed(
  messages: UiMessage[],
  assistantId: string,
  opts?: { onlyIfStreaming?: boolean }
): UiMessage[] {
  return messages.map((m) => {
    if (m.id !== assistantId) return m
    if (opts?.onlyIfStreaming && m.status !== "streaming") return m
    return { ...m, status: "failed" }
  })
}

export type ChatSseHandlers = {
  onChatCreated: (chatId: string) => void
  onToken: (text: string) => void
  onPdfReady: (pdf: StreamPdf) => void
  onToolStart: (data: {
    toolCallId: string
    toolName: string
  }) => void
  onToolEnd: (data: {
    toolCallId: string
    toolName: string
    ok: boolean
  }) => void
  onError: (data: { message: string; code: string }) => void
  onDoneSuccess: (done: DoneSuccess) => void
  onDoneFailure: () => void
}

export type ChatSseResult = {
  doneOk: boolean
  finalMessageId?: string
  sources: StreamSource[]
  pdf?: StreamPdf
  resolvedChatId?: string
}

/**
 * Consume a chat SSE body and fan out domain events.
 * Callers own React state / navigation / cache invalidation.
 */
export async function consumeChatSse(
  body: ReadableStream<Uint8Array>,
  handlers: ChatSseHandlers
): Promise<ChatSseResult> {
  let sources: StreamSource[] = []
  let pdf: StreamPdf | undefined
  let doneOk = false
  let finalMessageId: string | undefined
  let resolvedChatId: string | undefined

  for await (const evt of parseSseStream(body)) {
    applySseEvent(evt, handlers, {
      setSources: (next) => {
        sources = next
      },
      setPdf: (next) => {
        pdf = next
      },
      setDoneOk: (next) => {
        doneOk = next
      },
      setFinalMessageId: (next) => {
        finalMessageId = next
      },
      setResolvedChatId: (next) => {
        resolvedChatId = next
      },
    })
  }

  return { doneOk, finalMessageId, sources, pdf, resolvedChatId }
}

function applySseEvent(
  evt: SseEvent,
  handlers: ChatSseHandlers,
  acc: {
    setSources: (s: StreamSource[]) => void
    setPdf: (p: StreamPdf | undefined) => void
    setDoneOk: (ok: boolean) => void
    setFinalMessageId: (id: string | undefined) => void
    setResolvedChatId: (id: string | undefined) => void
  }
) {
  if (evt.event === "chat_created") {
    acc.setResolvedChatId(evt.data.chatId)
    handlers.onChatCreated(evt.data.chatId)
    return
  }

  if (evt.event === "token") {
    handlers.onToken(evt.data.text)
    return
  }

  if (evt.event === "pdf_ready") {
    const next = { url: evt.data.url, filename: evt.data.filename }
    acc.setPdf(next)
    handlers.onPdfReady(next)
    return
  }

  if (evt.event === "tool_start") {
    handlers.onToolStart({
      toolCallId: evt.data.toolCallId,
      toolName: evt.data.toolName,
    })
    return
  }

  if (evt.event === "tool_end") {
    handlers.onToolEnd({
      toolCallId: evt.data.toolCallId,
      toolName: evt.data.toolName,
      ok: evt.data.ok,
    })
    return
  }

  if (evt.event === "error") {
    handlers.onError(evt.data)
    return
  }

  if (evt.event === "done") {
    if (evt.data.ok) {
      const done = evt.data
      acc.setDoneOk(true)
      acc.setFinalMessageId(done.messageId)
      acc.setSources(done.sources ?? [])
      if (done.pdf) acc.setPdf(done.pdf)
      acc.setResolvedChatId(done.chatId)
      handlers.onDoneSuccess(done)
    } else {
      acc.setDoneOk(false)
      handlers.onDoneFailure()
    }
  }
}
