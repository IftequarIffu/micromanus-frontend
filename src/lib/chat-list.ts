import type { ChatListItem } from "@/lib/types"

const STORAGE_KEY = "micromanus.chat-list"

export function readChatList(): ChatListItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatListItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  } catch {
    return []
  }
}

export function writeChatList(items: ChatListItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function upsertChatListItem(
  item: ChatListItem,
  options?: { keepTitle?: boolean }
) {
  const list = readChatList()
  const existing = list.find((c) => c.chatId === item.chatId)
  const title =
    options?.keepTitle && existing?.title ? existing.title : item.title
  const next = list.filter((c) => c.chatId !== item.chatId)
  next.unshift({ ...item, title })
  writeChatList(next)
  return next
}

export function removeChatListItem(chatId: string) {
  const list = readChatList().filter((c) => c.chatId !== chatId)
  writeChatList(list)
  return list
}

/**
 * Sidebar label from the conversation's first user message — not later follow-ups.
 * Strips common request openers so the topic reads like a short chat name.
 */
export function titleFromContent(content: string, max = 42) {
  const original = content.replace(/\s+/g, " ").trim()
  if (!original) return "New chat"

  let cleaned = original
    .replace(
      /^(?:hey|hi|hello|yo|please|pls)[,!]?\s+/i,
      ""
    )
    .replace(
      /^(?:can you|could you|would you|will you|are you able to)\s+/i,
      ""
    )
    .replace(
      /^(?:i (?:want|need|would like)(?: you to)?|help me(?: to)?|let'?s)\s+/i,
      ""
    )
    .replace(
      /^(?:generate|create|make|write|draft|produce|build|give me|show me|tell me|explain|summarize|summarise|describe|list|find|search(?: for)?|look up)\s+(?:(?:a|an|the|me|about|on)\s+)?/i,
      ""
    )
    .replace(
      /^(?:what(?:'s| is| are)|who(?:'s| is| are)|where(?:'s| is| are)|when(?:'s| is| are)|why(?: is| are)?|how(?: do| does| can| to| should)?)\s+/i,
      ""
    )
    .replace(/\s+(?:please|thanks|thank you)[.!]*$/i, "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[?.!]+$/, "")
    .trim()

  if (!cleaned) cleaned = original.replace(/[?.!]+$/, "").trim() || original

  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)

  if (cleaned.length <= max) return cleaned

  const slice = cleaned.slice(0, max - 1)
  const lastSpace = slice.lastIndexOf(" ")
  const truncated = lastSpace > max * 0.45 ? slice.slice(0, lastSpace) : slice
  return `${truncated}…`
}

/** Prefer backend title, else first user message — used when opening a chat. */
export function titleFromChat(opts: {
  backendTitle?: string | null
  messages: Array<{ role: string; content: string }>
}) {
  const fromBackend = opts.backendTitle?.replace(/\s+/g, " ").trim()
  if (fromBackend) return titleFromContent(fromBackend)

  const firstUser = opts.messages.find((m) => m.role === "user")
  if (firstUser?.content) return titleFromContent(firstUser.content)

  return "New chat"
}
