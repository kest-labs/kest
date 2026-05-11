/**
 * @component Button
 * @category UI
 * @status Stable
 * @description A highly customizable button component with support for variants, sizes, loading states, and icons.
 * @usage Use for primary actions, forms, or navigation triggers. Supports 'asChild' for semantic flexibility.
 * @example
 * <Button variant="default" size="md" loading={isLoading} onClick={handleClick}>
 *   Click Me
 * </Button>
 */
import * as React from "react"
import { Slot, Slottable } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill text-sm font-medium tracking-normal focus-ring shrink-0 disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-button-primary hover:bg-primary/95 active:brightness-95",
        destructive:
          "bg-destructive text-white shadow-button-destructive hover:bg-destructive/90 focus-visible:ring-destructive/30",
        outline:
          "border border-border-strong bg-background text-foreground shadow-button hover:bg-bg-subtle",
        secondary:
          "border border-border-main bg-secondary text-secondary-foreground shadow-button hover:bg-secondary-deeper",
        ghost:
          "text-foreground hover:bg-secondary/80",
        link: "text-blue-600 underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 px-3 text-xs",
        sm: "h-8 px-4 text-xs",
        default: "h-10 px-5",
        lg: "h-11 px-6",
        xl: "h-12 px-8 text-base",
        "2xl": "h-13 px-10 text-base",
      },
      isIcon: {
        true: "aspect-square rounded-full p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      isIcon: false,
    },
  }
)

interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  /**
   * If true, the button will render as its child element while keeping button styles.
   */
  asChild?: boolean
  /**
   * Displays a loading spinner and disables interaction.
   */
  loading?: boolean
  /**
   * An optional icon to display inside the button.
   */
  icon?: React.ReactNode
  /**
   * Positioning of the icon or loading spinner relative to children.
   * @default "left"
   */
  iconPosition?: "left" | "right"
  /**
   * Disables the scale transform on click. Use when Button is used as a DropdownMenuTrigger
   * to prevent dropdown jitter caused by transform conflicts.
   */
  noScale?: boolean
}

function Button({
  className,
  variant,
  size,
  isIcon,
  loading = false,
  asChild = false,
  icon,
  iconPosition = "left",
  noScale = false,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button"

  const spinnerSize = cn(
    "animate-spin shrink-0",
    size === "xs" || size === "sm" ? "size-3" : 
    size === "xl" || size === "2xl" ? "size-6" : "size-4"
  )

  const spinner = <Loader2 className={spinnerSize} />

  return (
    <Comp
      data-slot="button"
      disabled={props.disabled || loading}
      className={cn(
        buttonVariants({ variant, size, isIcon, className }),
        // Conditionally apply interactive class based on noScale
        noScale ? "interactive-no-scale" : "interactive",
        loading && "relative pointer-events-none"
      )}
      {...props}
    >
      {/* Left Slot: Show spinner if loading and position is left */}
      {iconPosition === "left" && (loading ? spinner : icon)}

      {/* Children Slot: Hidden only for isIcon buttons while loading */}
      {!(isIcon && loading) && <Slottable>{children}</Slottable>}

      {/* Right Slot: Show spinner if loading and position is right */}
      {iconPosition === "right" && (loading ? spinner : icon)}
    </Comp>
  )
}

export { Button, buttonVariants }
