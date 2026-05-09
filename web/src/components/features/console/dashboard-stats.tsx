"use client"

import * as React from "react"
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/utils"

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  trend?: {
    value: string
    isPositive: boolean
  }
  icon: LucideIcon
  variant?: "default" | "primary" | "success" | "warning"
  className?: string
}

export function StatCard({
  title,
  value,
  description,
  trend,
  icon: Icon,
  variant = "default",
  className,
}: StatCardProps) {
  const variantStyles = {
    default: "bg-bg-canvas border-border-main",
    primary: "bg-bg-canvas border-border-main",
    success: "bg-bg-canvas border-border-main",
    warning: "bg-bg-canvas border-border-main",
  }

  const iconStyles = {
    default: "bg-bg-subtle text-text-muted",
    primary: "bg-primary text-primary-foreground",
    success: "bg-bg-subtle text-success",
    warning: "bg-bg-subtle text-warning",
  }

  return (
    <div
      className={cn(
        "rounded-md border p-6 transition-colors",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-muted">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-text-main">
              {value}
            </span>
            {trend && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-xs font-medium",
                  trend.isPositive ? "text-success" : "text-destructive"
                )}
              >
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.value}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-text-muted">{description}</p>
          )}
        </div>
        
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            iconStyles[variant]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

// Skeleton for loading states
export function StatCardSkeleton() {
  return (
    <div className="rounded-md border border-border-main bg-bg-canvas p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  )
}
