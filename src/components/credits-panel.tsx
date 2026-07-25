import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { BuyCreditsForm } from "@/components/buy-credits-form"
import { CouponForm } from "@/components/coupon-form"
import { queryKeys } from "@/lib/query-keys"
import { useCredits } from "@/hooks/use-api"

export type CreditsCheckoutStatus = "success" | "cancel"

type CreditsPanelProps = {
  checkout?: CreditsCheckoutStatus | null
}

/** Body for the credits dialog (title lives on the Dialog). */
export function CreditsPanel({ checkout = null }: CreditsPanelProps) {
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
    <div className="flex flex-col gap-6">
      {checkout === "success" ? (
        <Alert>
          <AlertTitle>Payment received</AlertTitle>
          <AlertDescription>
            Balance updates when Stripe confirms the webhook — this will refresh
            briefly.
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
            Check that you’re signed in and the API is reachable, then try
            again.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Current balance</CardTitle>
          <CardDescription>
            Credits available for chats and tools
            {isFetching && !isLoading ? " · updating…" : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-40" />
          ) : (
            <p className="text-4xl font-semibold tracking-tight">
              {(data?.balance ?? 0).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pay with Stripe</CardTitle>
          <CardDescription>
            Buy credits with a card. $1 per credit, minimum 5 ($5). You’ll be
            redirected to Stripe Checkout to complete payment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BuyCreditsForm />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          or
        </span>
        <Separator className="flex-1" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Redeem a coupon</CardTitle>
          <CardDescription>
            Have a promo code? Redeem it here instead of paying — no card
            required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CouponForm />
        </CardContent>
      </Card>
    </div>
  )
}
