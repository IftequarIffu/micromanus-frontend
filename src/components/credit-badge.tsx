import { Link } from "react-router"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useCredits } from "@/hooks/use-api"

export function CreditBadge() {
  const { data, isLoading, isError } = useCredits()

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
        render={<Link to="/credits" aria-label="Credits" />}
      >
        Credits
      </Badge>
    )
  }

  const label = `${data.balance.toLocaleString()} credits`
  return (
    <Badge
      variant={data.balance <= 0 ? "destructive" : "secondary"}
      render={<Link to="/credits" aria-label={`${label}. Manage credits`} />}
    >
      {label}
    </Badge>
  )
}
