"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
function ScrollArea({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative overflow-auto", className)} {...props}>{children}</div>
}
function ScrollBar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex touch-none select-none", className)} {...props} />
}
export { ScrollArea, ScrollBar }
