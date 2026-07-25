import type { ChatListItem, ChatSummary } from "@/lib/types"

const LEGACY_STORAGE_KEY = "micromanus.chat-list"

function storageKey(userId: string) {
  return `micromanus.chat-list.${userId}`
}

function sortByUpdatedAt(items: ChatListItem[]) {
  return [...items].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

/** Notify listeners (sidebar) that the local chat index changed. */
export function notifyChatListUpdated() {
  window.dispatchEvent(new Event("micromanus:chat-list-updated"))
}

/** One-time: move pre-user-scoped list into the current user's bucket. */
function migrateLegacyList(userId: string) {
  try {
    const key = storageKey(userId)
    if (localStorage.getItem(key) != null) {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      return
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!legacy) return
    localStorage.setItem(key, legacy)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // ignore migration failures
  }
}

export function readChatList(userId: string | null | undefined): ChatListItem[] {
  if (!userId) return []
  try {
    migrateLegacyList(userId)
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatListItem[]
    if (!Array.isArray(parsed)) return []
    return sortByUpdatedAt(parsed)
  } catch {
    return []
  }
}

export function writeChatList(userId: string, items: ChatListItem[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(sortByUpdatedAt(items)))
  notifyChatListUpdated()
}

/**
 * Replace the local sidebar index with the server list.
 * Restores after localStorage clear; drops chats deleted in the DB.
 */
export function syncChatListFromServer(
  userId: string,
  chats: ChatSummary[]
): ChatListItem[] {
  const items = chats.map((c) => ({
    chatId: c.id,
    title: titleFromContent(c.title ?? "New chat"),
    updatedAt: c.created_at,
  }))
  writeChatList(userId, items)
  return sortByUpdatedAt(items)
}

export function upsertChatListItem(
  userId: string,
  item: ChatListItem,
  options?: { keepTitle?: boolean }
) {
  const list = readChatList(userId)
  const existing = list.find((c) => c.chatId === item.chatId)
  const title =
    options?.keepTitle && existing?.title ? existing.title : item.title
  const next = list.filter((c) => c.chatId !== item.chatId)
  next.unshift({ ...item, title })
  writeChatList(userId, next)
  return next
}

export function removeChatListItem(userId: string, chatId: string) {
  const list = readChatList(userId).filter((c) => c.chatId !== chatId)
  writeChatList(userId, list)
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
