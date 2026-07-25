import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { useAccountDialogs } from "@/providers/account-dialogs-provider"

type OpenAccountDialogRouteProps = {
  dialog: "keys" | "credits"
}

/**
 * Deep-link / Stripe return handler: open the account dialog, then land on /new.
 * Keeps `/credits?checkout=…` working after Checkout redirects back.
 */
export function OpenAccountDialogRoute({ dialog }: OpenAccountDialogRouteProps) {
  const { openApiKeys, openCredits } = useAccountDialogs()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const checkoutParam = params.get("checkout")

  useEffect(() => {
    if (dialog === "keys") {
      openApiKeys()
    } else {
      openCredits({
        checkout:
          checkoutParam === "success" || checkoutParam === "cancel"
            ? checkoutParam
            : null,
      })
    }
    navigate("/new", { replace: true })
  }, [
    checkoutParam,
    dialog,
    navigate,
    openApiKeys,
    openCredits,
  ])

  return null
}
