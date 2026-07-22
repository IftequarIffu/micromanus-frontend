import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCredits, useModels } from "@/hooks/use-api"
import { formatUsd } from "@/lib/format-usd"

type ChatUsagePanelProps = {
  chatId: string
}

export function ChatUsagePanel({ chatId }: ChatUsagePanelProps) {
  const { data, isLoading, isError } = useCredits(chatId)
  const { data: models } = useModels()

  const labelById = new Map((models ?? []).map((m) => [m.id, m.label] as const))
  const chatUsage = data?.usageByChat.find((c) => c.chatId === chatId)
  const rows = chatUsage?.models ?? []
  const totalCost = rows.reduce((sum, row) => sum + row.costUsd, 0)
  const totalIn = rows.reduce((sum, row) => sum + row.inputTokens, 0)
  const totalOut = rows.reduce((sum, row) => sum + row.outputTokens, 0)

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Couldn’t load usage</EmptyTitle>
            <EmptyDescription>
              Refresh the page or try again in a moment.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No usage yet</EmptyTitle>
            <EmptyDescription>
              Token totals and estimated provider cost appear here after the
              first reply in this chat.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 overflow-y-auto p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">Usage</h2>
        <p className="text-muted-foreground text-sm">
          Estimated provider cost from published list prices (BYOK). Platform
          credits are separate.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Model</TableHead>
            <TableHead className="text-right">Input</TableHead>
            <TableHead className="text-right">Output</TableHead>
            <TableHead className="text-right">Est. cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.modelName}>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {labelById.get(row.modelName) ?? row.modelName}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {row.provider}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.inputTokens.toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.outputTokens.toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatUsd(row.costUsd)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell className="text-right tabular-nums">
              {totalIn.toLocaleString()}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {totalOut.toLocaleString()}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatUsd(totalCost)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
