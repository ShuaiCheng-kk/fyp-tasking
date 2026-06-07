"use client"

import * as React from "react"
import { createPortal } from "react-dom"

type DropdownContextValue = {
  open: boolean
  setOpen: (v: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null)

function useDropdown() {
  const ctx = React.useContext(DropdownContext)
  if (!ctx) throw new Error("DropdownMenu components must be used inside <DropdownMenu>")
  return ctx
}

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLElement | null>(null)
  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef }}>
      {children}
    </DropdownContext.Provider>
  )
}

function DropdownMenuTrigger({
  children,
  className,
  style,
  asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { open, setOpen, triggerRef } = useDropdown()
  return (
    <button
      ref={triggerRef as React.RefObject<HTMLButtonElement>}
      type="button"
      className={className}
      style={style}
      aria-expanded={open}
      onClick={e => { e.stopPropagation(); setOpen(!open) }}
      {...props}
    >
      {children}
    </button>
  )
}

function DropdownMenuContent({
  children,
  align = "start",
  sideOffset = 4,
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "center" | "end"
  alignOffset?: number
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
}) {
  const { open, setOpen, triggerRef } = useDropdown()
  const [pos, setPos] = React.useState({ top: 0, left: 0 })
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const contentWidth = contentRef.current?.offsetWidth ?? 200
    let left = r.left
    if (align === "end") left = r.right - contentWidth
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

function DropdownMenuPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function DropdownMenuGroup({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{children}</div>
}

function DropdownMenuLabel({ children, className, style, inset, ...props }: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  return (
    <div
      className={className}
      style={{ padding: '4px 6px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', ...style }}
      {...props}
    >
      {children}
    </div>
  )
}

function DropdownMenuItem({
  children,
  className,
  style,
  inset,
  onClick,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean; variant?: string }) {
  const { setOpen } = useDropdown()
  return (
    <div
      role="menuitem"
      className={className}
      style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, ...style }}
      onClick={e => { onClick?.(e); setOpen(false) }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
      {...props}
    >
      {children}
    </div>
  )
}

function DropdownMenuSeparator({ className, style, ...props }: React.HTMLAttributes<HTMLHRElement>) {
  return <hr className={className} style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #F1F5F9', ...style }} {...props} />
}

function DropdownMenuShortcut({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={className} style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF' }} {...props}>{children}</span>
}

function DropdownMenuSub({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function DropdownMenuSubTrigger({ children, className, style, ...props }: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  return <div className={className} style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, ...style }} {...props}>{children}</div>
}

function DropdownMenuSubContent({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{children}</div>
}

function DropdownMenuCheckboxItem({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { checked?: boolean }) {
  return <div style={{ padding: '8px 10px', fontSize: 13, cursor: 'pointer' }} {...props}>{children}</div>
}

function DropdownMenuRadioGroup({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{children}</div>
}

function DropdownMenuRadioItem({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div style={{ padding: '8px 10px', fontSize: 13, cursor: 'pointer' }} {...props}>{children}</div>
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
