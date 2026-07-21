export const queryKeys = {
  me: ["me"] as const,
  models: ["models"] as const,
  apiKeys: ["api-keys"] as const,
  credits: (chatId?: string) =>
    chatId ? (["credits", chatId] as const) : (["credits"] as const),
  chat: (chatId: string) => ["chat", chatId] as const,
}
