"use client"

import * as React from "react"
import { createPortal } from "react-dom"

type PopoverContextValue = {
  open: boolean
  setOpen: (v: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null)

function usePopover() {
  const ctx = React.useContext(PopoverContext)
  if (!ctx) throw new Error("Popover components must be used inside <Popover>")
  return ctx
}

function Popover({ children, defaultOpen = false }: { children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef }}>
      {children}
    </PopoverContext.Provider>
  )
}

function PopoverTrigger({
  children,
  className,
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen, triggerRef } = usePopover()
  return (
    <button
      ref={triggerRef}
      type="button"
      className={className}
      style={style}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      {...props}
    >
      {children}
    </button>
  )
}

function PopoverContent({
  children,
  align = "end",
  sideOffset = 8,
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "center" | "end"
  alignOffset?: number
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
}) {
  const { open, setOpen, triggerRef } = usePopover()
  const [pos, setPos] = React.useState({ top: 0, left: 0 })
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const contentWidth = contentRef.current?.offsetWidth ?? 280
    let left = r.right - contentWidth
    if (align === "start") left = r.left
    if (align === "center") left = r.left + r.width / 2 - contentWidth / 2
    setPos({ top: r.bottom + sideOffset, left: Math.max(8, left) })
  }, [open, align, sideOffset, triggerRef])

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        contentRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open, setOpen, triggerRef])

  if (!open || typeof window === "undefined") return null

  return createPortal(
    <div
      ref={contentRef}
      className={className}
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, ...style }}
      {...props}
    >
      {children}
    </div>,
    document.body
  )
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={className} {...props} />
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={className} {...props} />
}

function PopoverDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={className} {...props} />
}

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
}
