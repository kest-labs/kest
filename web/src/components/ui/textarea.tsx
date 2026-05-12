/**
 * @component Textarea
 * @category UI
 * @status Stable
 * @description A multi-line text input field with support for error states and variants.
 * @usage Use in forms for longer text inputs (e.g., descriptions, comments).
 * @example
 * <Textarea placeholder="Type your message here." errorText="Message is too short." />
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/utils"

const textareaVariants = cva(
  "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex min-h-[88px] w-full rounded-md px-4 py-3 text-base shadow-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 md:text-sm input-depth focus-border resize-none",
  {
    variants: {
      variant: {
        outline: "border border-border-strong bg-background hover:border-border-strong focus-visible:border-brand",
        filled: "border border-border-main bg-bg-subtle hover:border-border-strong focus-visible:bg-background focus-visible:border-brand",
      },
      error: {
        true: "border-destructive focus-visible:border-destructive text-destructive placeholder:text-destructive/50",
      }
    },
    defaultVariants: {
      variant: "outline",
    },
  }
)

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {
  error?: boolean
  errorText?: React.ReactNode
  root?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, error, errorText, root, ...props }, ref) => {
    const isError = error || !!errorText

    const textareaNode = (
      <textarea
        className={cn(textareaVariants({ variant, error: isError, className }))}
        ref={ref}
        {...props}
      />
    )

    if (root || errorText) {
      return (
        <div className="flex flex-col gap-0.5 w-full">
          {textareaNode}
          {errorText && (
            <p className="text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
              {errorText}
            </p>
          )}
        </div>
      )
    }

    return textareaNode
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
