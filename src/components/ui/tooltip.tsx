"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
function TooltipProvider({ children }: { children: React.ReactNode }) { return <>{children}</> }
function Tooltip({ children }: { children: React.ReactNode }) { return <>{children}</> }
function TooltipTrigger({ children, asChild, ...props }: React.HTMLAttributes<HTMLSpanElement> & { asChild?: boolean }) {
  return <span {...props}>{children}</span>
}
function TooltipContent({ children, className, sideOffset, ...props }: React.HTMLAttributes<HTMLDivElement> & { sideOffset?: number }) {
  return (
    <div className={cn("z-50 rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow-md", className)} {...props}>
      {children}
    </div>
  )
}
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
