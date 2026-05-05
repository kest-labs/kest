/**
 * @component Dialog
 * @category UI
 * @status Stable
 * @description A window overlaid on either the primary window or another dialog window, rendering the content underneath inert.
 * @usage Use for modal windows, confirmations, or secondary content that requires focus.
 * @example
 * <Dialog>
 *   <DialogTrigger>Open</DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Confirmation</DialogTitle>
 *     </DialogHeader>
 *     <DialogBody>Are you sure?</DialogBody>
 *     <DialogFooter>
 *       <Button>Cancel</Button>
 *       <Button>Confirm</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 */
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { useT } from "@/i18n/client"
import { cn } from "@/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const dialogContentVariants = cva(
  "fixed left-[50%] top-[50%] z-50 flex w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col gap-4 border border-border/60 bg-background p-6 shadow-premium duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:w-full sm:max-h-[calc(100vh-4rem)] sm:rounded-xl",
  {
    variants: {
      size: {
        sm: "max-w-sm",
        default: "max-w-lg",
        lg: "max-w-2xl",
        xl: "max-w-4xl",
        full: "max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {
  hideCloseButton?: boolean
}

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, size, hideCloseButton = false, ...props }, ref) => {
  const t = useT()

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(dialogContentVariants({ size, className }))}
        {...props}
      >
        {children}
        {!hideCloseButton && (
          <DialogPrimitive.Close className="absolute right-3 top-3 flex size-7 cursor-pointer items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-ring disabled:cursor-not-allowed disabled:opacity-50">
            <X className="size-4" />
            <span className="sr-only">{t.common('close')}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col gap-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex-1 overflow-y-auto overscroll-contain -mx-6 px-6",
      className
    )}
    {...props}
  />
)
DialogBody.displayName = "DialogBody"

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-foreground",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
