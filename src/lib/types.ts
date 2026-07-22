export type Provider = "openai" | "claude" | "gemini"

export type ModelDefinition = {
  id: string
  provider: Provider
  label: string
}

export type Me = {
  id: string
  name: string | null
  email: string
  created_at: string
}

export type ApiKeyPublic = {
  provider: Provider
  last_four: string
  created_at: string
  updated_at: string
}

export type ChatMessage = {
  id: string
  chat_id: string
  role: "user" | "assistant"
  content: string
  model: string | null
  created_at: string
  pdf?: StreamPdf
}

export type ChatSource = {
  id: string
  chat_id: string
  message_id: string
  source_link: string
  content: string
  created_at: string
}

export type CreditUsage = {
  id: string
  user_id: string
  chat_id: string
  model_name: string
  provider: Provider
  input_tokens: number
  output_tokens: number
  cached_tokens: number
  credits_charged: number
  created_at: string
}

export type ChatModelUsage = {
  modelName: string
  provider: Provider
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  /** Estimated provider API cost in USD (BYOK). */
  costUsd: number
}

export type ChatUsageSummary = {
  chatId: string
  title: string | null
  models: ChatModelUsage[]
}

export type ChatDetail = {
  id: string
  title: string | null
  created_at: string
  messages: ChatMessage[]
  sources: ChatSource[]
  usage: CreditUsage[]
}

export type CreditsResponse = {
  balance: number
  usageByChat: ChatUsageSummary[]
}

export type CheckoutResponse = {
  url: string
  sessionId: string
}

export type RedeemResponse = {
  code: string
  creditsGranted: number
  balance: number
}

export type ApiErrorBody = {
  error: string
  code: string
}

export type StreamSource = {
  title: string
  url: string
}

export type StreamPdf = {
  url: string
  filename: string
}

export type StreamUsage = {
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  creditsCharged: number
}

export type DoneSuccess = {
  ok: true
  chatId: string
  messageId: string
  usage: StreamUsage
  sources: StreamSource[]
  pdf?: StreamPdf
}

export type DoneFailure = {
  ok: false
}

export type SseEvent =
  | { event: "chat_created"; data: { chatId: string } }
  | {
      event: "tool_start"
      data: { chatId: string; toolName: string; toolCallId: string }
    }
  | {
      event: "tool_end"
      data: {
        chatId: string
        toolName: string
        toolCallId: string
        ok: boolean
      }
    }
  | { event: "token"; data: { text: string } }
  | { event: "pdf_ready"; data: { chatId: string; url: string; filename: string } }
  | { event: "error"; data: { message: string; code: string } }
  | { event: "done"; data: DoneSuccess | DoneFailure }

/** Mid-stream / completed agent tool call (no args/results on the wire). */
export type UiToolCall = {
  toolCallId: string
  toolName: string
  status: "running" | "complete" | "error"
}

export type UiMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  status?: "streaming" | "complete" | "failed"
  sources?: StreamSource[]
  pdf?: StreamPdf
  tools?: UiToolCall[]
}

export type ChatListItem = {
  chatId: string
  title: string
  updatedAt: string
}

/** Item from GET /chats (DB source of truth for the sidebar). */
export type ChatSummary = {
  id: string
  title: string | null
  created_at: string
}
