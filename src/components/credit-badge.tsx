import { Link } from "react-router"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useCredits } from "@/hooks/use-api"

export function CreditBadge() {
  const { data, isLoading, isError } = useCredits()

  if (isLoading) {
    return <Skeleton className="h-6 w-20" />
  }

  if (isError || !data) {
    return (
      <Badge variant="outline" render={<Link to="/credits" />}>
        Credits
      </Badge>
    )
  }

  return (
    <Badge
      variant={data.balance <= 0 ? "destructive" : "secondary"}
      render={<Link to="/credits" />}
    >
      {data.balance.toLocaleString()} credits
    </Badge>
  )
}
