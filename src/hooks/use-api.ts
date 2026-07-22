import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, ApiError } from "@/lib/api"
import { syncChatListFromServer } from "@/lib/chat-list"
import { queryKeys } from "@/lib/query-keys"
import type {
  ApiKeyPublic,
  ChatDetail,
  ChatSummary,
  CheckoutResponse,
  CreditPackageId,
  CreditsResponse,
  Me,
  ModelDefinition,
  Provider,
  RedeemResponse,
} from "@/lib/types"
import { useAuth } from "@/providers/auth-provider"

function useToken() {
  const { token } = useAuth()
  return token
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
    queryFn: async () => {
      const data = await api<{ models: ModelDefinition[] }>("/models", {
        method: "GET",
        token: token!,
      })
      return data.models
    },
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
 * Server chat list (DB source of truth). Also rewrites the per-user localStorage
 * cache so clearing storage or deleting rows in the DB stays in sync.
 */
export function useChats() {
  const token = useToken()
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: queryKeys.chats(userId),
    enabled: !!token && !!userId,
    queryFn: async () => {
      const data = await api<{ chats: ChatSummary[] }>("/chats", {
        method: "GET",
        token: token!,
      })
      if (userId) {
        syncChatListFromServer(userId, data.chats)
      }
      return data.chats
    },
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
    queryFn: () => {
      const qs = chatId ? `?chatId=${encodeURIComponent(chatId)}` : ""
      return api<CreditsResponse>(`/credits${qs}`, {
        method: "GET",
        token: token!,
      })
    },
  })
}

export function useCheckout() {
  const token = useToken()
  return useMutation({
    mutationFn: (packageId: CreditPackageId) =>
      api<CheckoutResponse>("/credits/checkout", {
        method: "POST",
        token: token!,
        body: JSON.stringify({ packageId }),
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
        usage: prev?.usage ?? [],
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
    queryFn: () =>
      api<ChatDetail>(`/chats/${chatId}`, {
        method: "GET",
        token: token!,
      }),
    retry: (count, err) => {
      if (err instanceof ApiError && err.status === 404) return false
      return count < 2
    },
  })
}

export function useDeleteChat() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (chatId: string) =>
      api<void>(`/chats/${chatId}`, {
        method: "DELETE",
        token: token!,
      }),
    onSuccess: (_data, chatId) => {
      qc.removeQueries({ queryKey: queryKeys.chat(chatId) })
      void qc.invalidateQueries({ queryKey: queryKeys.chats() })
      void qc.invalidateQueries({ queryKey: queryKeys.credits() })
    },
  })
}
