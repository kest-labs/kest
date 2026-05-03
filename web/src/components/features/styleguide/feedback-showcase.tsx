"use client"

import * as React from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip"
import { InfoIcon, AlertCircle, BellIcon, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function FeedbackShowcase() {
  return (
    <section className="space-y-8">
      <h2 className="text-2xl font-semibold">Feedback & Interaction</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Messaging</h3>
          <div className="space-y-4">
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>System Update</AlertTitle>
              <AlertDescription>
                A new version of the styleguide is available for review.
              </AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Critical Error</AlertTitle>
              <AlertDescription>
                Failed to apply spring easing to the main thread.
              </AlertDescription>
            </Alert>
            <div className="pt-4 border-t space-y-4">
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Semantic Notifications (Sonner)</h4>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                   size="sm"
                  className="interactive-subtle justify-start"
                  onClick={() => toast.success("Process completed", {
                    description: "Your files have been successfully optimized.",
                  })}
                >
                  <BellIcon className="mr-2 size-3 text-success" />
                  Success Toast
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="interactive-subtle justify-start"
                  onClick={() => toast.error("Upload failed", {
                    description: "Server responded with a 500 error.",
                  })}
                >
                  <BellIcon className="mr-2 size-3 text-destructive" />
                  Error Toast
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="interactive-subtle justify-start"
                  onClick={() => toast.warning("Low disk space", {
                    description: "You have less than 1GB remaining.",
                  })}
                >
                  <BellIcon className="mr-2 size-3 text-warning" />
                  Warning Toast
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="interactive-subtle justify-start"
                  onClick={() => toast.info("New feature available", {
                    description: "Check out the new global motion tokens.",
                  })}
                >
                  <BellIcon className="mr-2 size-3 text-info" />
                  Info Toast
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="interactive-subtle justify-start"
                  onClick={() => {
                    const promise = () => new Promise((resolve) => setTimeout(() => resolve({ name: 'Success' }), 2000));
                    toast.promise(promise, {
                      loading: 'Loading data...',
                      success: () => 'Data loaded successfully',
                      error: 'Error loading data',
                    });
                  }}
                >
                  <Loader2 className="mr-2 size-3 animate-spin" />
                  Promise Toast
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="interactive-subtle justify-start"
                  onClick={() => toast("Update Available", {
                    description: "A new version of the app is ready.",
                    action: {
                      label: "Reload",
                      onClick: () => window.location.reload(),
                    },
                  })}
                >
                  <BellIcon className="mr-2 size-3" />
                  Action Toast
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Skeleton Loaders</h3>
            <div className="flex items-center space-x-4 p-6 border rounded-xl bg-card">
              <Skeleton className="size-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Contextual Feedback</h3>
            <div className="p-6 border rounded-xl bg-card flex justify-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline">Hover for Details</Button>
                  </TooltipTrigger>
                  <TooltipContent className="glass-panel text-xs">
                    <p>Spring-animated premium tooltip</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
