import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useCredits } from "@/hooks/use-api"
import { useAccountDialogs } from "@/providers/account-dialogs-provider"

export function CreditBadge() {
  const { data, isLoading, isError } = useCredits()
  const { openCredits } = useAccountDialogs()

  if (isLoading) {
    return (
      <Skeleton
        className="h-6 w-20"
        aria-label="Loading credit balance"
        role="status"
      />
    )
  }

  if (isError || !data) {
    return (
      <Badge
        variant="outline"
        render={
          <button
            type="button"
            aria-label="Credits"
            onClick={() => openCredits()}
          />
        }
      >
        Credits
      </Badge>
    )
  }

  const amount = data.balance.toLocaleString()
  const label = `${amount} credits`
  return (
    <Badge
      variant={data.balance <= 0 ? "destructive" : "secondary"}
      render={
        <button
          type="button"
          aria-label={`${label}. Manage credits`}
          onClick={() => openCredits()}
        />
      }
      className="max-w-[9.5rem] truncate tabular-nums sm:max-w-none"
    >
      <span className="sm:hidden">{amount}</span>
      <span className="hidden sm:inline">{label}</span>
    </Badge>
  )
}
