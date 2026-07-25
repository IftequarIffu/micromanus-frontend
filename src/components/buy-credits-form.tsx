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
import { useCheckout } from "@/hooks/use-api"

/** Matches backend `MIN_CHECKOUT_CREDITS`. */
export const MIN_CHECKOUT_CREDITS = 5

export function BuyCreditsForm() {
  const checkout = useCheckout()
  const [creditsInput, setCreditsInput] = useState(String(MIN_CHECKOUT_CREDITS))
  const [fieldError, setFieldError] = useState<string | null>(null)

  const parsed = Number.parseInt(creditsInput, 10)
  const credits =
    Number.isInteger(parsed) && creditsInput.trim() !== "" ? parsed : null
  const isValid = credits !== null && credits >= MIN_CHECKOUT_CREDITS
  const totalDollars = isValid ? credits : null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (credits === null || !Number.isInteger(credits)) {
      setFieldError("Enter a whole number of credits.")
      return
    }
    if (credits < MIN_CHECKOUT_CREDITS) {
      setFieldError(`Minimum purchase is ${MIN_CHECKOUT_CREDITS} credits ($5).`)
      return
    }

    setFieldError(null)

    try {
      const { url } = await checkout.mutateAsync(credits)
      window.location.assign(url)
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "unknown"
      const message = messageForCode(code)
      if (code === "invalid_credits" || code === "invalid_body") {
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
          <FieldLabel htmlFor="credits">Credits to buy</FieldLabel>
          <Input
            id="credits"
            type="number"
            inputMode="numeric"
            min={MIN_CHECKOUT_CREDITS}
            step={1}
            value={creditsInput}
            onChange={(e) => {
              setCreditsInput(e.target.value)
              if (fieldError) setFieldError(null)
            }}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={
              fieldError ? "credits-error" : "credits-description"
            }
            disabled={checkout.isPending}
          />
          {fieldError ? (
            <FieldError id="credits-error">{fieldError}</FieldError>
          ) : (
            <FieldDescription id="credits-description">
              $1 per credit. Minimum {MIN_CHECKOUT_CREDITS} credits ($
              {MIN_CHECKOUT_CREDITS}).
              {totalDollars !== null
                ? ` Total: $${totalDollars.toLocaleString()}.`
                : null}
            </FieldDescription>
          )}
        </Field>
        <Button
          type="submit"
          disabled={checkout.isPending || !isValid}
        >
          {checkout.isPending ? <Spinner data-icon="inline-start" /> : null}
          {totalDollars !== null
            ? `Pay $${totalDollars.toLocaleString()}`
            : "Buy credits"}
        </Button>
      </FieldGroup>
    </form>
  )
}
