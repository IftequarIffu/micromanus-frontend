import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const brandWordmarkVariants = cva(
  "inline-flex items-baseline font-[Poppins,sans-serif] leading-none select-none tracking-[-0.04em]",
  {
    variants: {
      size: {
        sm: "text-lg",
        md: "text-xl tracking-[-0.045em]",
        lg: "text-4xl tracking-[-0.05em]",
        xl: "text-5xl tracking-[-0.055em] sm:text-6xl",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  }
)

export function BrandWordmark({
  className,
  size = "sm",
}: React.ComponentProps<"span"> & VariantProps<typeof brandWordmarkVariants>) {
  return (
    <span className={cn(brandWordmarkVariants({ size }), className)}>
      <span className="font-normal text-muted-foreground">micro</span>
      <span className="font-semibold text-primary">manus</span>
    </span>
  )
}
