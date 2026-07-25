import type { ChatDetail, UiMessage } from "@/lib/types"

/** Map GET /chats/:id payload into thread UI messages (sources grouped by message). */
export function chatDetailToUiMessages(detail: ChatDetail): UiMessage[] {
  const byMessage = new Map<string, { title: string; url: string }[]>()
  for (const s of detail.sources) {
    const list = byMessage.get(s.message_id) ?? []
    list.push({ title: s.source_link, url: s.source_link })
    byMessage.set(s.message_id, list)
  }

  return detail.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    status: "complete" as const,
    sources: byMessage.get(m.id),
    ...(m.pdf ? { pdf: m.pdf } : {}),
  }))
}
