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
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium leading-[1.3] tracking-normal focus-ring shrink-0 disabled:cursor-not-allowed disabled:opacity-100 disabled:bg-border-main disabled:text-text-muted [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-none hover:bg-primary active:bg-primary-strong",
        destructive:
          "bg-error-subtle text-destructive shadow-none hover:bg-error-subtle focus-visible:ring-destructive/30",
        outline:
          "border border-border-strong bg-transparent text-foreground shadow-none hover:bg-transparent active:bg-bg-subtle",
        secondary:
          "border border-border-main bg-secondary text-secondary-foreground shadow-none hover:bg-secondary active:bg-secondary-deeper",
        ghost:
          "rounded-md text-foreground hover:bg-transparent active:bg-secondary",
        link: "text-brand underline-offset-4 hover:underline active:text-brand-strong",
      },
      size: {
        xs: "h-8 px-3 text-xs",
        sm: "h-9 px-4 text-sm",
        default: "min-h-11 px-6 py-3",
        lg: "min-h-11 px-6 py-3",
        xl: "min-h-11 px-6 py-3",
        "2xl": "min-h-11 px-6 py-3",
      },
      isIcon: {
        true: "size-9 rounded-md border border-border-main bg-bg-canvas p-0 text-text-main",
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
