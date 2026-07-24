import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api"
import { messageForCode } from "@/lib/errors"
import { useRedeemCoupon } from "@/hooks/use-api"

const COUPON_CODES = new Set([
  "coupon_inactive",
  "coupon_expired",
  "coupon_exhausted",
  "coupon_not_found",
  "coupon_already_redeemed",
  "invalid_body",
])

export function CouponForm() {
  const redeem = useRedeemCoupon()
  const [code, setCode] = useState("")
  const [fieldError, setFieldError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return

    setFieldError(null)

    try {
      const result = await redeem.mutateAsync(trimmed)
      toast.success(
        `Granted ${result.creditsGranted.toLocaleString()} credits. Balance: ${result.balance.toLocaleString()}.`
      )
      setCode("")
    } catch (err) {
      const c = err instanceof ApiError ? err.code : "unknown"
      const message = messageForCode(c)
      if (COUPON_CODES.has(c)) {
        setFieldError(message)
      } else {
        toast.error(message)
      }
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field data-invalid={fieldError ? true : undefined}>
          <FieldLabel htmlFor="coupon">Coupon code</FieldLabel>
          <Input
            id="coupon"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              if (fieldError) setFieldError(null)
            }}
            placeholder="SID_DRDROID"
            autoComplete="off"
            aria-invalid={fieldError ? true : undefined}
            disabled={redeem.isPending}
          />
          {fieldError ? (
            <FieldError>{fieldError}</FieldError>
          ) : (
            <FieldDescription>
              Codes are trimmed and uppercased on the server.
            </FieldDescription>
          )}
        </Field>
        <Button type="submit" disabled={redeem.isPending || !code.trim()}>
          {redeem.isPending ? <Spinner data-icon="inline-start" /> : null}
          Redeem
        </Button>
      </FieldGroup>
    </form>
  )
}
