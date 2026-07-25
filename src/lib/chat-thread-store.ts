import type { UiMessage } from "@/lib/types"

type Threads = Record<string, UiMessage[]>
type Listener = () => void

const EMPTY: UiMessage[] = []

/**
 * External store for chat message threads (including in-flight SSE).
 * Kept outside React context so token updates do not re-render shell/sidebar
 * subscribers that only need streaming status / actions.
 */
let threads: Threads = {}
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeChatThreads(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getChatThreadsSnapshot() {
  return threads
}

export function getThreadMessages(key: string): UiMessage[] {
  return threads[key] ?? EMPTY
}

export function setChatThreads(next: Threads) {
  threads = next
  emit()
}

export function updateChatThread(
  key: string,
  updater: (prev: UiMessage[]) => UiMessage[]
) {
  const prev = threads[key] ?? EMPTY
  const nextMessages = updater(prev)
  if (nextMessages === prev) return
  threads = { ...threads, [key]: nextMessages }
  emit()
}

export function replaceChatThread(key: string, messages: UiMessage[]) {
  threads = { ...threads, [key]: messages }
  emit()
}

export function deleteChatThread(key: string) {
  if (!(key in threads)) return
  const next = { ...threads }
  delete next[key]
  threads = next
  emit()
}

export function movePendingThread(toKey: string, pendingKey: string) {
  const pending = threads[pendingKey] ?? EMPTY
  const next = { ...threads }
  delete next[pendingKey]
  next[toKey] = pending.length > 0 ? pending : (next[toKey] ?? EMPTY)
  threads = next
  emit()
}

export function clearAllChatThreads() {
  threads = {}
  emit()
}
