import type { ApiErrorBody, SseEvent } from "@/lib/types"

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? ""

export class ApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

export function apiUrl(path: string) {
  if (path.startsWith("http")) return path
  return `${API_BASE}${path}`
}

export async function api<T>(
  path: string,
  init: RequestInit & { token: string }
): Promise<T> {
  const { token, ...rest } = init
  const res = await fetch(apiUrl(path), {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...rest.headers,
    },
  })

  if (res.status === 204) {
    return undefined as T
  }

  const body = (await res.json().catch(() => ({}))) as ApiErrorBody & T
  if (!res.ok) {
    throw new ApiError(
      body.error ?? "request_failed",
      res.status,
      body.code ?? "unknown"
    )
  }

  return body as T
}

export async function* parseSseStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let eventName = "message"
  let dataLines: string[] = []

  const flush = (): SseEvent | null => {
    if (dataLines.length === 0) {
      eventName = "message"
      return null
    }

    const raw = dataLines.join("\n")
    dataLines = []
    const name = eventName
    eventName = "message"

    let data: unknown = raw
    try {
      data = JSON.parse(raw)
    } catch {
      // keep raw string
    }

    return { event: name, data } as SseEvent
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (line === "") {
        const evt = flush()
        if (evt) yield evt
        continue
      }

      if (line.startsWith(":")) continue

      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim()
        continue
      }

      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart())
      }
    }
  }

  if (buffer.length > 0) {
    if (buffer.startsWith("event:")) {
      eventName = buffer.slice(6).trim()
    } else if (buffer.startsWith("data:")) {
      dataLines.push(buffer.slice(5).trimStart())
    }
  }

  const evt = flush()
  if (evt) yield evt
}

export async function postChatMessageStream(opts: {
  token: string
  content: string
  model: string
  chatId?: string
  signal?: AbortSignal
}): Promise<Response> {
  const path = opts.chatId
    ? `/chats/${opts.chatId}/messages`
    : "/chats/messages"

  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ content: opts.content, model: opts.model }),
    signal: opts.signal,
  })

  return res
}
