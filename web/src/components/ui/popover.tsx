/**
 * @component Popover
 * @category UI
 * @status Stable
 * @description Displays rich content in a portal, triggered by a button or other element, typically used for small forms or settings.
 * @usage Use for lightweight overlays that don't require the full surface of a dialog or drawer.
 * @example
 * <Popover>
 *   <PopoverTrigger>Open</PopoverTrigger>
 *   <PopoverContent>Content</PopoverContent>
 * </Popover>
 */
"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-auto rounded-lg border border-border-main bg-popover p-0 text-popover-foreground shadow-soft outline-hidden animate-in fade-in zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
