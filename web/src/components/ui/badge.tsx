/**
 * @component Badge
 * @category UI
 * @status Stable
 * @description Displays a small badge or label for status, counts, or categories.
 * @usage Use for pill-like status indicators or numeric counts.
 * @example
 * <Badge variant="outline">New</Badge>
 */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-sm border px-2 py-0.5 text-[12px] font-medium leading-[1.35] tracking-normal w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-ring transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-border-main bg-bg-surface text-text-main [a&]:hover:bg-bg-surface",
        secondary:
          "border-border-main bg-secondary text-secondary-foreground [a&]:hover:bg-secondary-deeper",
        destructive:
          "border-transparent bg-error-subtle text-destructive [a&]:hover:bg-error-subtle focus-visible:ring-destructive/20",
        outline:
          "border-border-strong bg-background text-foreground [a&]:hover:bg-bg-subtle",
        tagYellow:
          "border-transparent bg-[var(--miro-surface-yellow)] text-[var(--miro-yellow-dark)]",
        tagPurple:
          "border-transparent bg-[var(--miro-surface-featured)] text-brand",
        tagCoral:
          "border-transparent bg-block-coral text-[var(--miro-coral-dark)]",
        success:
          "border-transparent bg-success text-primary-foreground",
        discount:
          "rounded-sm border-transparent bg-highlight px-1.5 py-0.5 text-text-main",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
