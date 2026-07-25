import { useCallback } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import { api, ApiError } from "@/lib/api"
import {
  readChatList,
  removeChatListItem,
  syncChatListFromServer,
  writeChatList,
} from "@/lib/chat-list"
import { queryKeys } from "@/lib/query-keys"
import type {
  ApiKeyPublic,
  ChatDetail,
  ChatListItem,
  ChatSummary,
  CheckoutResponse,
  CreditsResponse,
  Me,
  ModelDefinition,
  Provider,
  RedeemResponse,
} from "@/lib/types"
import { useAuth } from "@/providers/auth-provider"

const CREDITS_STALE_MS = 30_000
const MODELS_STALE_MS = 60_000
const CHAT_STALE_MS = 30_000

function useToken() {
  const { token } = useAuth()
  return token
}

async function fetchModels(token: string) {
  const data = await api<{ models: ModelDefinition[] }>("/models", {
    method: "GET",
    token,
  })
  return data.models
}

async function fetchCredits(token: string, chatId?: string) {
  const qs = chatId ? `?chatId=${encodeURIComponent(chatId)}` : ""
  return api<CreditsResponse>(`/credits${qs}`, {
    method: "GET",
    token,
  })
}

async function fetchChat(token: string, chatId: string) {
  return api<ChatDetail>(`/chats/${chatId}`, {
    method: "GET",
    token,
  })
}

/** Warm Usage-tab data (`GET /credits?chatId=` + models). */
export function prefetchChatUsage(
  queryClient: QueryClient,
  token: string,
  chatId: string
) {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.credits(chatId),
    queryFn: () => fetchCredits(token, chatId),
    staleTime: CREDITS_STALE_MS,
  })
  void queryClient.prefetchQuery({
    queryKey: queryKeys.models,
    queryFn: () => fetchModels(token),
    staleTime: MODELS_STALE_MS,
  })
}

/** Prefetch chat detail + usage for faster sidebar → chat navigation. */
export function prefetchChatRoute(
  queryClient: QueryClient,
  token: string,
  chatId: string
) {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.chat(chatId),
    queryFn: () => fetchChat(token, chatId),
    staleTime: CHAT_STALE_MS,
  })
  prefetchChatUsage(queryClient, token, chatId)
}

export function useMe() {
  const token = useToken()
  return useQuery({
    queryKey: queryKeys.me,
    enabled: !!token,
    queryFn: () => api<Me>("/me", { method: "GET", token: token! }),
  })
}

export function useModels() {
  const token = useToken()
  return useQuery({
    queryKey: queryKeys.models,
    enabled: !!token,
    queryFn: () => fetchModels(token!),
    staleTime: MODELS_STALE_MS,
  })
}

export function useApiKeys() {
  const token = useToken()
  return useQuery({
    queryKey: queryKeys.apiKeys,
    enabled: !!token,
    queryFn: async () => {
      const data = await api<{ keys: ApiKeyPublic[] }>("/api-keys", {
        method: "GET",
        token: token!,
      })
      return data.keys
    },
  })
}

/**
 * Server chat list (DB source of truth via React Query).
 * localStorage is only a paint cache (`placeholderData`); the queryFn rewrites it.
 */
export function useChats() {
  const token = useToken()
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: queryKeys.chats(userId),
    enabled: !!token && !!userId,
    queryFn: async (): Promise<ChatListItem[]> => {
      const data = await api<{ chats: ChatSummary[] }>("/chats", {
        method: "GET",
        token: token!,
      })
      return syncChatListFromServer(userId!, data.chats)
    },
    placeholderData: () => (userId ? readChatList(userId) : []),
    staleTime: 30_000,
  })
}

export function useSaveApiKey() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { provider: Provider; apiKey: string }) =>
      api<ApiKeyPublic>("/api-keys", {
        method: "POST",
        token: token!,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.apiKeys })
    },
  })
}

export function useDeleteApiKey() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (provider: Provider) =>
      api<void>(`/api-keys/${provider}`, {
        method: "DELETE",
        token: token!,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.apiKeys })
    },
  })
}

export function useCredits(chatId?: string) {
  const token = useToken()
  return useQuery({
    queryKey: queryKeys.credits(chatId),
    enabled: !!token,
    queryFn: () => fetchCredits(token!, chatId),
    staleTime: CREDITS_STALE_MS,
  })
}

export function useCheckout() {
  const token = useToken()
  return useMutation({
    mutationFn: (credits: number) =>
      api<CheckoutResponse>("/credits/checkout", {
        method: "POST",
        token: token!,
        body: JSON.stringify({ credits }),
      }),
  })
}

export function useRedeemCoupon() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) =>
      api<RedeemResponse>("/credits/redeem", {
        method: "POST",
        token: token!,
        body: JSON.stringify({ code }),
      }),
    onSuccess: (result) => {
      qc.setQueryData<CreditsResponse>(queryKeys.credits(), (prev) => ({
        balance: result.balance,
        usageByChat: prev?.usageByChat ?? [],
      }))
      void qc.invalidateQueries({ queryKey: queryKeys.credits() })
    },
  })
}

export function useChat(chatId: string | undefined) {
  const token = useToken()
  return useQuery({
    queryKey: queryKeys.chat(chatId ?? ""),
    enabled: !!token && !!chatId,
    queryFn: () => fetchChat(token!, chatId!),
    staleTime: CHAT_STALE_MS,
    retry: (count, err) => {
      if (err instanceof ApiError && err.status === 404) return false
      return count < 2
    },
  })
}

/** Prefetch chat + Usage-tab data (e.g. sidebar hover). */
export function usePrefetchChatRoute() {
  const token = useToken()
  const queryClient = useQueryClient()

  return useCallback(
    (chatId: string) => {
      if (!token) return
      prefetchChatRoute(queryClient, token, chatId)
    },
    [token, queryClient]
  )
}

/** Prefetch Usage-tab credits/models after a chat is loaded. */
export function usePrefetchChatUsage() {
  const token = useToken()
  const queryClient = useQueryClient()

  return useCallback(
    (chatId: string) => {
      if (!token) return
      prefetchChatUsage(queryClient, token, chatId)
    },
    [token, queryClient]
  )
}

export function useDeleteChat() {
  const token = useToken()
  const { user } = useAuth()
  const userId = user?.id
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (chatId: string) =>
      api<void>(`/chats/${chatId}`, {
        method: "DELETE",
        token: token!,
      }),
    onMutate: async (chatId) => {
      if (!userId) return
      await qc.cancelQueries({ queryKey: queryKeys.chats(userId) })
      const previous = qc.getQueryData<ChatListItem[]>(queryKeys.chats(userId))
      const next = removeChatListItem(userId, chatId)
      qc.setQueryData(queryKeys.chats(userId), next)
      return { previous }
    },
    onError: (_err, _chatId, ctx) => {
      if (userId && ctx?.previous) {
        qc.setQueryData(queryKeys.chats(userId), ctx.previous)
        writeChatList(userId, ctx.previous)
      }
    },
    onSuccess: (_data, chatId) => {
      qc.removeQueries({ queryKey: queryKeys.chat(chatId) })
      qc.removeQueries({ queryKey: queryKeys.credits(chatId) })
      void qc.invalidateQueries({ queryKey: queryKeys.chats() })
      void qc.invalidateQueries({ queryKey: queryKeys.credits() })
    },
  })
}
