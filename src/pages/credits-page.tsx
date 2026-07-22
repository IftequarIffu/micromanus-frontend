import { useEffect } from "react"
import { useSearchParams } from "react-router"
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
import { useCredits } from "@/hooks/use-api"
import type { CreditUsage } from "@/lib/types"

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function UsageRow({ row }: { row: CreditUsage }) {
  return (
    <li className="flex items-start justify-between gap-4 border-b py-3 last:border-b-0">
      <div className="min-w-0 flex flex-col gap-0.5">
        <p className="truncate text-sm font-medium">{row.model_name}</p>
        <p className="text-muted-foreground text-xs">
          {row.provider} · {formatWhen(row.created_at)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium">
          −{row.credits_charged.toLocaleString()}
        </p>
        <p className="text-muted-foreground text-xs">
          {row.input_tokens.toLocaleString()} in /{" "}
          {row.output_tokens.toLocaleString()} out
        </p>
      </div>
    </li>
  )
}

export function CreditsPage() {
  const [params] = useSearchParams()
  const checkout = params.get("checkout")
  const qc = useQueryClient()
  const { data, isLoading, isError, isFetching } = useCredits()

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

  const usage = data?.usage ?? []

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
        <h2 className="text-lg font-medium">Recent usage</h2>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : usage.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>No usage yet</EmptyTitle>
              <EmptyDescription>
                Credit charges from chats will show up here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="border-y">
            {usage.map((row) => (
              <UsageRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
