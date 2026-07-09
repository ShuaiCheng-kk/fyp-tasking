'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  BarChart2,
  Building2,
  MessageCircle,
  LogOut,
  UserPlus,
  ClipboardList,
  CheckSquare,
  CalendarDays,
  GripVertical,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const NAV_ITEMS = [
  { label: 'Dashboard',     Icon: LayoutDashboard, href: '/owner/dashboard',       dot: null as 'messages' | 'announcements' | 'review' | 'tasks' | null },
  { label: 'Shifts',        Icon: CalendarDays,    href: '/owner/shifts',          dot: null },
  { label: 'Tasks',         Icon: CheckSquare,     href: '/owner/tasks',           dot: 'tasks' as const },
  { label: 'Company',       Icon: Building2,       href: '/owner/team',            dot: null },
  { label: 'Communication', Icon: MessageCircle,    href: '/owner/communication',   dot: 'messages' as const },
  { label: 'Recruitment',   Icon: UserPlus,         href: '/owner/recruitment',     dot: 'review' as const },
  { label: 'Attendance',    Icon: ClipboardList,    href: '/owner/attendance',      dot: 'attendance' as const },
  { label: 'Report',        Icon: BarChart2,        href: '/owner/report',          dot: null },
]

const NAV_LABELS = NAV_ITEMS.map(i => i.label)
const ORDER_KEY = 'owner_sidebar_nav_order'

function mergeOrder(saved: string[]): string[] {
  const valid = saved.filter(l => NAV_LABELS.includes(l))
  const missing = NAV_LABELS.filter(l => !valid.includes(l))
  return [...valid, ...missing]
}

// Used by the sign-in flow so the post-login landing page matches whatever
// the user dragged to the top of their sidebar, instead of always /owner/dashboard.
export function getOwnerLandingHref(): string {
  const fallback = NAV_ITEMS[0].href
  try {
    const saved = localStorage.getItem(ORDER_KEY)
    if (!saved) return fallback
    const firstLabel = mergeOrder(JSON.parse(saved))[0]
    return NAV_ITEMS.find(i => i.label === firstLabel)?.href ?? fallback
  } catch {
    return fallback
  }
}

const THEME = {
  sidebarBg: '#FFFFFF',
  sidebarText: '#374151',
  sidebarActiveBg: 'transparent',
  sidebarActiveText: '#F97316',
  sidebarHoverBg: '#F9FAFB',
  sidebarBorder: '#E5E7EB',
  logoBorder: '#E5E7EB',
}

export default function OwnerSidebar({
  unreadMessages,
  unreadAnnouncements,
}: {
  unreadMessages?: number
  unreadAnnouncements?: number
}) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [msgCount, setMsgCount] = useState(unreadMessages ?? 0)
  const [annCount, setAnnCount] = useState(unreadAnnouncements ?? 0)
  const [reviewCount, setReviewCount] = useState(0)
  const [attendanceCount, setAttendanceCount] = useState(0)
  const [taskAlertCount, setTaskAlertCount] = useState(0)
  const fetchTaskAlertsRef = useRef<(() => void) | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [draggingLabel, setDraggingLabel] = useState<string | null>(null)
  const [dragOverLabel, setDragOverLabel] = useState<string | null>(null)

  // ── Nav order ───────────────────────────────────────────────────────────────
  const [navOrder, setNavOrder] = useState<string[]>(NAV_LABELS)
  const navOrderRef = useRef<string[]>(NAV_LABELS)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ORDER_KEY)
      if (saved) {
        const merged = mergeOrder(JSON.parse(saved))
        navOrderRef.current = merged
        setNavOrder(merged)
      }
    } catch {}
  }, [])

  // item label → DOM node (for FLIP + midpoint calc)
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map())
  const prevRects = useRef<Map<string, DOMRect>>(new Map())

  const captureRects = useCallback(() => {
    itemRefs.current.forEach((el, label) => {
      if (el) prevRects.current.set(label, el.getBoundingClientRect())
    })
  }, [])

  const playFlip = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        itemRefs.current.forEach((el, label) => {
          if (!el) return
          const prev = prevRects.current.get(label)
          if (!prev) return
          const next = el.getBoundingClientRect()
          const dy = prev.top - next.top
          if (Math.abs(dy) < 1) return
          el.style.transition = 'none'
          el.style.transform = `translateY(${dy}px)`
          void el.offsetHeight
          el.style.transition = 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)'
          el.style.transform = 'translateY(0px)'
        })
      })
    })
  }, [])

  const moveNavItem = useCallback((sourceLabel: string, targetLabel: string) => {
    if (!sourceLabel || !targetLabel || sourceLabel === targetLabel) return
    const current = [...navOrderRef.current]
    const sourceIdx = current.indexOf(sourceLabel)
    const targetIdx = current.indexOf(targetLabel)
    if (sourceIdx < 0 || targetIdx < 0 || sourceIdx === targetIdx) return
    captureRects()
    const next = [...current]
    const [moved] = next.splice(sourceIdx, 1)
    next.splice(targetIdx, 0, moved)
    navOrderRef.current = next
    setNavOrder(next)
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)) } catch {}
    playFlip()
  }, [captureRects, playFlip])

  const handleNavDragStart = useCallback((label: string) => {
    setDraggingLabel(label)
  }, [])

  const handleNavDragEnd = useCallback(() => {
    setDraggingLabel(null)
    setDragOverLabel(null)
  }, [])

  // ── Unread counts + realtime ────────────────────────────────────────────────
  useEffect(() => {
    const authUid = typeof localStorage !== 'undefined' ? localStorage.getItem('tasking_user_id') : null
    if (!authUid) return

    fetch(`/api/user/me?user_id=${authUid}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) return
        setUserRole(d.user.role)
        const internalId: string = d.user.id
        const cid = localStorage.getItem('tasking_company_id') ?? localStorage.getItem(`tasking_company_id_${authUid}`) ?? d.user.company_id
        if (!cid) return

        fetch(`/api/inbox/unread-count?user_id=${internalId}&company_id=${cid}`)
          .then(r => r.json())
          .then(data => { if (data.success) setMsgCount(data.unread_messages ?? 0) })
          .catch(() => {})

        fetch(`/api/recruitment?company_id=${cid}&resource=pending_approval`)
          .then(r => r.json())
          .then(data => { if (data.success) setReviewCount((data.pendingPostings as unknown[]).length ?? 0) })
          .catch(() => {})

        fetch(`/api/attendance?resource=pending_requests_count&company_id=${cid}`)
          .then(r => r.json())
          .then(data => { if (data.success) setAttendanceCount(data.count ?? 0) })
          .catch(() => {})

        const fetchTaskAlerts = () => {
          Promise.all([
            fetch(`/api/task?company_id=${cid}&suggestion=workload&assigned_by=${internalId}`).then(r => r.json()).catch(() => ({ success: false })),
            fetch(`/api/task?company_id=${cid}&suggestion=delay&assigned_by=${internalId}`).then(r => r.json()).catch(() => ({ success: false })),
          ]).then(([workloadData, delayData]) => {
            const workloadCount = workloadData.success ? (workloadData.suggestions ?? []).filter((s: { type: string }) => s.type === 'rebalance').length : 0
            const delayCount = delayData.success ? (delayData.alerts ?? []).length : 0
            setTaskAlertCount(workloadCount + delayCount)
          }).catch(() => {})
        }
        fetchTaskAlertsRef.current = fetchTaskAlerts
        fetchTaskAlerts()

        const readKey = `ann_read_ids_${cid}_${internalId}`
        let readIds: Set<string> = new Set()
        try {
          const raw = localStorage.getItem(readKey)
          if (raw) readIds = new Set(JSON.parse(raw))
        } catch {}

        fetch(`/api/inbox/announcements?company_id=${cid}&role=owner`)
          .then(r => r.json())
          .then(data => {
            if (data.success) {
              const unread = (data.announcements as { id: string }[]).filter(a => !readIds.has(a.id)).length
              setAnnCount(unread)
            }
          })
          .catch(() => {})

        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const msgChannel = supabase
          .channel('owner-sidebar-messages')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_user_id=eq.${internalId}` },
            () => { setMsgCount(c => c + 1) })
          .subscribe()

        const refreshReviewCount = () => {
          fetch(`/api/recruitment?company_id=${cid}&resource=pending_approval`)
            .then(r => r.json())
            .then(data => { if (data.success) setReviewCount((data.pendingPostings as unknown[]).length ?? 0) })
            .catch(() => {})
        }

        const reviewChannel = supabase
          .channel('owner-sidebar-review')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'job_postings', filter: `company_id=eq.${cid}` },
            refreshReviewCount)
          .subscribe()

        const refreshAnnCount = () => {
          const rkey = `ann_read_ids_${cid}_${internalId}`
          let rids: Set<string> = new Set()
          try { const raw2 = localStorage.getItem(rkey); if (raw2) rids = new Set(JSON.parse(raw2)) } catch {}
          fetch(`/api/inbox/announcements?company_id=${cid}&role=owner`)
            .then(r => r.json())
            .then(data => {
              if (data.success) setAnnCount((data.announcements as { id: string }[]).filter(a => !rids.has(a.id)).length)
            }).catch(() => {})
        }

        const annChannel = supabase
          .channel('owner-sidebar-announcements')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements', filter: `company_id=eq.${cid}` },
            refreshAnnCount)
          .subscribe()

        const refreshAttendanceCount = () => {
          fetch(`/api/attendance?resource=pending_requests_count&company_id=${cid}`)
            .then(r => r.json())
            .then(data => { if (data.success) setAttendanceCount(data.count ?? 0) })
            .catch(() => {})
        }

        const swapChannel = supabase
          .channel('owner-sidebar-swaps')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_swap_requests', filter: `company_id=eq.${cid}` },
            refreshAttendanceCount)
          .subscribe()

        const offDayChannel = supabase
          .channel('owner-sidebar-off-day')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_off_day_requests', filter: `company_id=eq.${cid}` },
            refreshAttendanceCount)
          .subscribe()

        return () => {
          supabase.removeChannel(msgChannel)
          supabase.removeChannel(annChannel)
          supabase.removeChannel(reviewChannel)
          supabase.removeChannel(swapChannel)
          supabase.removeChannel(offDayChannel)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = () => { fetchTaskAlertsRef.current?.() }
    window.addEventListener('task-insights-updated', handler)
    return () => window.removeEventListener('task-insights-updated', handler)
  }, [])

  useEffect(() => {
    if (pathname !== '/owner/communication') return
    setMsgCount(0)
    setAnnCount(0)
    const authUid = typeof localStorage !== 'undefined' ? localStorage.getItem('tasking_user_id') : null
    if (!authUid) return
    fetch(`/api/user/me?user_id=${authUid}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) return
        const internalId: string = d.user.id
        const cid = localStorage.getItem('tasking_company_id') ?? localStorage.getItem(`tasking_company_id_${authUid}`)
        if (!cid) return
        fetch(`/api/inbox/announcements?company_id=${cid}&role=owner`)
          .then(r => r.json())
          .then(data => {
            if (!data.success) return
            const allIds = (data.announcements as { id: string }[]).map(a => a.id)
            localStorage.setItem(`ann_read_ids_${cid}_${internalId}`, JSON.stringify(allIds))
          }).catch(() => {})
      }).catch(() => {})
  }, [pathname])

  useEffect(() => { if (unreadMessages !== undefined) setMsgCount(unreadMessages) }, [unreadMessages])
  useEffect(() => { if (unreadAnnouncements !== undefined) setAnnCount(unreadAnnouncements) }, [unreadAnnouncements])

  const visibleLabels = userRole === 'Manager'
    ? navOrder.filter(l => l !== 'Report')
    : navOrder

  const orderedItems = visibleLabels
    .map(label => NAV_ITEMS.find(item => item.label === label))
    .filter(Boolean) as typeof NAV_ITEMS

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    localStorage.removeItem('tasking_user_id')
    localStorage.removeItem('tasking_company_id')
    window.location.href = '/signout'
  }

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => { if (!draggingLabel) setExpanded(false); setHoveredIdx(null) }}
      style={{
        width: expanded ? '220px' : '64px',
        background: THEME.sidebarBg,
        borderRight: `1px solid ${THEME.sidebarBorder}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        top: 0, left: 0,
        zIndex: 20,
        transition: 'width 0.2s',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '20px 18px 18px',
          borderBottom: `1px solid ${THEME.logoBorder}`,
          textDecoration: 'none', flexShrink: 0,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
          <rect width="32" height="32" rx="8" fill={userRole === 'Manager' ? '#3B82F6' : '#F97316'} />
          <rect x="8" y="9" width="9" height="2.5" rx="1.25" fill="white" />
          <rect x="8" y="14.75" width="16" height="2.5" rx="1.25" fill="white" />
          <rect x="8" y="20.5" width="12" height="2.5" rx="1.25" fill="white" />
          <circle cx="22" cy="10.25" r="3.5" fill="#10B981" />
          <path d="M20.3 10.25L21.5 11.5L23.8 9" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{
          fontWeight: 700, fontSize: '1.0625rem', color: THEME.sidebarText,
          letterSpacing: '-0.01em', whiteSpace: 'nowrap',
          opacity: expanded ? 1 : 0, transition: 'opacity 0.15s',
        }}>
          Tasking
        </span>
      </Link>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflow: 'hidden', position: 'relative' }}>
        {orderedItems.map(({ label, Icon, href, dot }, idx) => {
          const active = pathname === href
          const showDot = dot === 'messages' ? msgCount > 0 : dot === 'announcements' ? annCount > 0 : dot === 'review' ? reviewCount > 0 : dot === 'attendance' ? attendanceCount > 0 : dot === 'tasks' ? taskAlertCount > 0 : false
          const isDragging = draggingLabel === label
          const isDragOver = dragOverLabel === label

          return (
            <Link
              key={label}
              ref={el => {
                if (el) itemRefs.current.set(label, el)
                else itemRefs.current.delete(label)
              }}
              href={href}
              draggable
              onDragStart={(event) => {
                const target = event.target as HTMLElement | null
                if (target?.closest('button, input, textarea, select, [role="button"]')) {
                  event.preventDefault()
                  return
                }
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', label)
                handleNavDragStart(label)
              }}
              onDragEnd={handleNavDragEnd}
              onDragOver={(event) => {
                event.preventDefault()
                if (draggingLabel && draggingLabel !== label) setDragOverLabel(label)
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                setDragOverLabel(current => current === label ? null : current)
              }}
              onDrop={(event) => {
                event.preventDefault()
                const sourceLabel = event.dataTransfer.getData('text/plain')
                if (sourceLabel) moveNavItem(sourceLabel, label)
                handleNavDragEnd()
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={e => { if (draggingLabel) e.preventDefault() }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: active
                  ? THEME.sidebarActiveBg
                  : hoveredIdx === idx && !draggingLabel
                    ? THEME.sidebarHoverBg
                    : 'transparent',
                border: active ? '1.5px solid #F97316' : '1.5px solid transparent',
                color: active ? THEME.sidebarActiveText : THEME.sidebarText,
                fontWeight: active ? 600 : 500,
                fontSize: '0.9rem',
                cursor: isDragging ? 'grabbing' : 'pointer',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                marginBottom: '2px',
                position: 'relative',
                transform: isDragging ? 'scale(0.985)' : undefined,
                transition: 'box-shadow 0.18s ease, transform 0.18s ease, opacity 0.18s ease, border-color 0.15s ease',
                opacity: isDragging ? 0.88 : 1,
                outline: isDragOver ? '2px dashed #F97316' : 'none',
                outlineOffset: 3,
                boxShadow: isDragOver ? '0 14px 34px rgba(249,115,22,0.12)' : 'none',
              }}
            >
              <span style={{ position: 'relative', flexShrink: 0 }}>
                <Icon size={18} strokeWidth={2.1} style={{ display: 'block', color: 'currentColor' }} />
                {showDot && (
                  <span style={{
                    position: 'absolute', top: -3, right: -3,
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#EF4444', border: '1.5px solid #fff',
                  }} />
                )}
              </span>
              <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>
                {label}
              </span>

              {/* Grip handle — right side, only visible when expanded and hovered */}
              {expanded && (
                <span
                  style={{
                    marginLeft: 'auto',
                    opacity: hoveredIdx === idx && !active ? 0.5 : 0,
                    transition: 'opacity 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'grab',
                    flexShrink: 0,
                  }}
                >
                  <GripVertical size={13} strokeWidth={2} />
                </span>
              )}
            </Link>
          )
        })}

      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 8px', borderTop: `1px solid ${THEME.logoBorder}`, flexShrink: 0 }}>
        <div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px', background: 'none', border: 'none',
              cursor: 'pointer', borderRadius: '8px', color: '#EF4444',
              fontWeight: 500, fontSize: '0.9rem',
              transition: 'color 0.12s, background 0.12s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEF2F2' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'none' }}
          >
            <LogOut size={18} strokeWidth={2} style={{ flexShrink: 0, color: 'inherit' }} />
            <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 0.15s' }}>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
