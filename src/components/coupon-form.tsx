import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api"
import { messageForCode } from "@/lib/errors"
import { useRedeemCoupon } from "@/hooks/use-api"

export function CouponForm() {
  const redeem = useRedeemCoupon()
  const [code, setCode] = useState("")

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return

    try {
      const result = await redeem.mutateAsync(code.trim())
      toast.success(
        `Granted ${result.creditsGranted} credits. Balance: ${result.balance}.`
      )
      setCode("")
    } catch (err) {
      const c = err instanceof ApiError ? err.code : "unknown"
      toast.error(messageForCode(c))
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="coupon">Coupon code</FieldLabel>
          <Input
            id="coupon"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="WELCOME100"
            autoComplete="off"
          />
          <FieldDescription>
            Codes are trimmed and uppercased on the server.
          </FieldDescription>
        </Field>
        <Button type="submit" disabled={redeem.isPending || !code.trim()}>
          {redeem.isPending ? <Spinner data-icon="inline-start" /> : null}
          Redeem
        </Button>
      </FieldGroup>
    </form>
  )
}
