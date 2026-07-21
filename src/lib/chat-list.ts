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

export function upsertChatListItem(item: ChatListItem) {
  const list = readChatList().filter((c) => c.chatId !== item.chatId)
  list.unshift(item)
  writeChatList(list)
  return list
}

export function removeChatListItem(chatId: string) {
  const list = readChatList().filter((c) => c.chatId !== chatId)
  writeChatList(list)
  return list
}

export function titleFromContent(content: string, max = 48) {
  const cleaned = content.replace(/\s+/g, " ").trim()
  if (cleaned.length <= max) return cleaned || "New chat"
  return `${cleaned.slice(0, max - 1)}…`
}
