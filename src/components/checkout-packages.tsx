import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api"
import { messageForCode } from "@/lib/errors"
import type { CreditPackageId } from "@/lib/types"
import { useCheckout } from "@/hooks/use-api"

const PACKAGES: {
  id: CreditPackageId
  name: string
  credits: number
  price: string
  description: string
}[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 500,
    price: "$5",
    description: "Enough for light experimentation.",
  },
  {
    id: "standard",
    name: "Standard",
    credits: 2000,
    price: "$15",
    description: "Best for regular chatting with tools.",
  },
  {
    id: "pro",
    name: "Pro",
    credits: 5000,
    price: "$30",
    description: "Higher volume for heavy sessions.",
  },
]

export function CheckoutPackages() {
  const checkout = useCheckout()

  async function buy(packageId: CreditPackageId) {
    try {
      const { url } = await checkout.mutateAsync(packageId)
      window.location.assign(url)
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "unknown"
      toast.error(messageForCode(code))
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {PACKAGES.map((pkg) => (
        <Card key={pkg.id}>
          <CardHeader>
            <CardTitle>{pkg.name}</CardTitle>
            <CardDescription>{pkg.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <p className="text-3xl font-semibold tracking-tight">{pkg.price}</p>
            <p className="text-muted-foreground text-sm">
              {pkg.credits.toLocaleString()} credits
            </p>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              disabled={checkout.isPending}
              onClick={() => void buy(pkg.id)}
            >
              {checkout.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              Buy {pkg.name}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
