import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const ROWS = [
  { from: "user", widths: ["w-2/3"] },
  { from: "assistant", widths: ["w-full", "w-11/12", "w-4/5"] },
  { from: "user", widths: ["w-1/2"] },
  { from: "assistant", widths: ["w-full", "w-5/6"] },
] as const

export function ChatThreadSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading messages"
      className="mx-auto flex h-full w-full min-w-0 max-w-3xl flex-col gap-8 overflow-hidden px-3 pt-18 pb-40 sm:px-4"
    >
      {ROWS.map((row, i) => (
        <div
          key={i}
          className={cn(
            "flex w-full max-w-[95%] flex-col gap-2",
            row.from === "user" ? "ml-auto items-end" : "items-start"
          )}
        >
          {row.widths.map((width, j) => (
            <Skeleton
              key={j}
              className={cn(
                "h-4",
                width,
                row.from === "user" && j === 0 && "h-10 w-2/3 rounded-lg"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
