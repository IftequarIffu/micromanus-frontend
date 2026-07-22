import { useEffect } from "react"
import { useSearchParams } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { BuyCreditsForm } from "@/components/buy-credits-form"
import { CouponForm } from "@/components/coupon-form"
import { queryKeys } from "@/lib/query-keys"
import { useCredits } from "@/hooks/use-api"

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

  return (
    <div className="scrollbar-chat min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:auto]!">
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
      </div>
    </div>
  )
}
