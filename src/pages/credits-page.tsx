import { useEffect } from "react"
import { Link, useSearchParams } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { BuyCreditsForm } from "@/components/buy-credits-form"
import { CouponForm } from "@/components/coupon-form"
import { queryKeys } from "@/lib/query-keys"
import { formatUsd } from "@/lib/format-usd"
import { useCredits, useModels } from "@/hooks/use-api"
import type { ChatModelUsage, ChatUsageSummary } from "@/lib/types"

function chatHeading(chat: ChatUsageSummary) {
  const title = chat.title?.trim()
  if (title) return title
  return `Chat ${chat.chatId.slice(0, 8)}`
}

function ModelUsageRow({
  row,
  label,
}: {
  row: ChatModelUsage
  label: string
}) {
  return (
    <li className="flex items-start justify-between gap-4 border-b py-3 last:border-b-0">
      <div className="min-w-0 flex flex-col gap-0.5">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">{row.provider}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium">{formatUsd(row.costUsd)}</p>
        <p className="text-muted-foreground text-xs">
          {row.inputTokens.toLocaleString()} in /{" "}
          {row.outputTokens.toLocaleString()} out
        </p>
      </div>
    </li>
  )
}

function ChatUsageBlock({
  chat,
  modelLabel,
}: {
  chat: ChatUsageSummary
  modelLabel: (modelName: string) => string
}) {
  const chatCost = chat.models.reduce((sum, m) => sum + m.costUsd, 0)

  return (
    <article className="flex flex-col gap-2 py-4">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0 flex flex-col gap-0.5">
          <Link
            to={`/chat/${chat.chatId}`}
            className="truncate text-sm font-medium hover:underline"
          >
            {chatHeading(chat)}
          </Link>
          <p className="text-muted-foreground text-xs">
            {chat.models.length} model{chat.models.length === 1 ? "" : "s"}
          </p>
        </div>
        <p className="shrink-0 text-sm font-medium">{formatUsd(chatCost)}</p>
      </div>
      <ul>
        {chat.models.map((row) => (
          <ModelUsageRow
            key={row.modelName}
            row={row}
            label={modelLabel(row.modelName)}
          />
        ))}
      </ul>
    </article>
  )
}

export function CreditsPage() {
  const [params] = useSearchParams()
  const checkout = params.get("checkout")
  const qc = useQueryClient()
  const { data, isLoading, isError, isFetching } = useCredits()
  const { data: modelsData } = useModels()

  useEffect(() => {
    if (checkout !== "success") return

    let ticks = 0
    const id = window.setInterval(() => {
      void qc.invalidateQueries({ queryKey: queryKeys.credits() })
      ticks += 1
      if (ticks >= 6) window.clearInterval(id)
    }, 2000)

    return () => window.clearInterval(id)
  }, [checkout, qc])

  const usageByChat = data?.usageByChat ?? []
  const labelById = new Map(
    (modelsData ?? []).map((m) => [m.id, m.label] as const),
  )
  const modelLabel = (modelName: string) =>
    labelById.get(modelName) ?? modelName

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Credits
        </h1>
        <p className="text-muted-foreground text-sm">
          Platform credits meter micromanus access. Your LLM provider is billed
          separately via your own key.
        </p>
      </div>

      {checkout === "success" ? (
        <Alert>
          <AlertTitle>Payment received</AlertTitle>
          <AlertDescription>
            Balance updates when Stripe confirms the webhook — this page will
            refresh briefly.
          </AlertDescription>
        </Alert>
      ) : null}

      {checkout === "cancel" ? (
        <Alert>
          <AlertTitle>Checkout canceled</AlertTitle>
          <AlertDescription>No credits were purchased.</AlertDescription>
        </Alert>
      ) : null}

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn’t load credits</AlertTitle>
          <AlertDescription>
            Check that you’re signed in and the API is reachable, then refresh.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          Current balance
          {isFetching && !isLoading ? " · updating…" : null}
        </p>
        {isLoading ? (
          <Skeleton className="h-10 w-40" />
        ) : (
          <p className="text-4xl font-semibold tracking-tight">
            {(data?.balance ?? 0).toLocaleString()}
          </p>
        )}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Buy credits</h2>
        <BuyCreditsForm />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Redeem a coupon</h2>
        <CouponForm />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">Usage by chat</h2>
          <p className="text-muted-foreground text-sm">
            Token totals and estimated provider cost (USD) per model in each
            chat.
          </p>
        </div>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : usageByChat.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>No usage yet</EmptyTitle>
              <EmptyDescription>
                Token usage and estimated provider spend from chats will show up
                here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="divide-y border-y">
            {usageByChat.map((chat) => (
              <ChatUsageBlock
                key={chat.chatId}
                chat={chat}
                modelLabel={modelLabel}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
