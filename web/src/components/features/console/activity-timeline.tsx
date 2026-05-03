/**
 * @component ActivityTimeline
 * @category Feature
 * @status Stable
 * @description Displays a vertical timeline of activities, logs, or events.
 * @usage Used in the dashboard console to show recent user or system activities.
 * @example
 * <ActivityTimeline items={mockActivities} title="System Logs" />
 */
"use client"

import * as React from "react"
import { cn } from "@/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  CheckCircle, 
  AlertCircle, 
  Info, 
  Zap, 
  Settings,
  User,
  LucideIcon 
} from "lucide-react"

export interface ActivityItem {
  id: string
  type: "success" | "warning" | "info" | "action" | "config" | "user"
  title: string
  description?: string
  timestamp: string
  user?: {
    name: string
    avatar?: string
    initials: string
  }
}

interface ActivityTimelineProps {
  items: ActivityItem[]
  className?: string
  title?: string
  viewAllLabel?: string
}

const iconMap: Record<ActivityItem["type"], LucideIcon> = {
  success: CheckCircle,
  warning: AlertCircle,
  info: Info,
  action: Zap,
  config: Settings,
  user: User,
}

const colorMap: Record<ActivityItem["type"], string> = {
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  info: "text-info bg-info/10",
  action: "text-primary bg-primary/10",
  config: "text-text-muted bg-muted",
  user: "text-primary bg-primary/10",
}

export function ActivityTimeline({ items, className, title = "Recent Activity", viewAllLabel }: ActivityTimelineProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-bg-surface p-6 h-full flex flex-col",
        "hover:shadow-premium transition-all duration-300",
        className
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">{title}</h3>
        {viewAllLabel && (
          <button className="text-xs font-medium text-primary hover:underline transition-all">
            {viewAllLabel}
          </button>
        )}
      </div>
      
      <div className="relative space-y-4">
        {/* Timeline line */}
        <div className="absolute left-4 top-2 bottom-2 w-px bg-border-subtle" />
        
        {items.map((item) => {
          const Icon = iconMap[item.type]
          return (
            <div
              key={item.id}
              className={cn(
                "relative flex gap-4 pl-10",
                "transition-all duration-300 hover:translate-x-1"
              )}
            >
              {/* Icon marker */}
              <div
                className={cn(
                  "absolute left-0 flex h-8 w-8 items-center justify-center rounded-full",
                  colorMap[item.type]
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-main truncate">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="mt-0.5 text-xs text-text-muted truncate">
                        {item.description}
                      </p>
                    )}
                  </div>
                  
                  {item.user && (
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={item.user.avatar} />
                      <AvatarFallback className="text-[10px]">
                        {item.user.initials}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
                
                <p className="mt-1 text-xs text-text-muted">
                  {item.timestamp}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Skeleton for loading
export function ActivityTimelineSkeleton() {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
      <div className="mb-4 h-4 w-28 animate-pulse rounded bg-muted" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 pl-10">
            <div className="absolute left-4 h-8 w-8 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
