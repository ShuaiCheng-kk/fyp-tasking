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
import { useRealtimeNotifications } from '@/components/realtime/RealtimeNotificationsProvider'

export type SidebarRole = 'owner' | 'partner' | 'manager' | 'employee'

type DotKey = 'messages' | 'announcements' | 'review' | 'attendance' | 'tasks' | null

function navItemsFor(role: SidebarRole) {
  const items = [
    { label: 'Dashboard',     Icon: LayoutDashboard, href: `/${role}/dashboard`,     dot: null as DotKey },
    { label: 'Shifts',        Icon: CalendarDays,    href: `/${role}/shifts`,        dot: null as DotKey },
    { label: 'Tasks',         Icon: CheckSquare,     href: `/${role}/tasks`,         dot: 'tasks' as DotKey },
    { label: 'Company',       Icon: Building2,       href: `/${role}/team`,          dot: null as DotKey },
    { label: 'Communication', Icon: MessageCircle,    href: `/${role}/communication`, dot: 'messages' as DotKey },
    { label: 'Recruitment',   Icon: UserPlus,         href: `/${role}/recruitment`,   dot: 'review' as DotKey },
    { label: 'Attendance',    Icon: ClipboardList,    href: `/${role}/attendance`,    dot: 'attendance' as DotKey },
    { label: 'Report',        Icon: BarChart2,        href: `/${role}/report`,        dot: null as DotKey },
  ]
  // Report is O/P-only (UC62-64); Company/Team is O/P-only too — Managers don't manage
  // members or departments and don't get either menu item. Attendance is folded entirely into
  // the Shifts page for Manager (merged Shift Calendar + My Requests + Swap Requests) — no
  // standalone Attendance nav item, and the alert dot that used to sit on Attendance now sits
  // on Shifts instead (same attendanceAlertCount prop/counter, just relabelled onto Shifts).
  if (role === 'manager') return items
    .filter(i => i.label !== 'Report' && i.label !== 'Company' && i.label !== 'Attendance')
    .map(i => i.label === 'Shifts' ? { ...i, dot: 'attendance' as DotKey } : i)
  // Employee: no Company (O-only), no Recruitment (O/P/M-only), no Report (O/P-only). Attendance
  // is folded into the Shifts page too (same merge as Manager) — no standalone Attendance nav
  // item, dot moves onto Shifts. Communication moved off the Dashboard onto its own page
  // (confirmed 2026-07-31) — Employee still can't post Announcements (O/P/M-only), that's gated
  // inside EmployeeAnnouncementsPanel/the communication page itself, not the nav.
  if (role === 'employee') return items
    .filter(i => ['Dashboard', 'Shifts', 'Tasks', 'Communication'].includes(i.label))
    .map(i => i.label === 'Shifts' ? { ...i, dot: 'attendance' as DotKey } : i)
  return items
}

function orderKeyFor(role: SidebarRole): string {
  return `${role}_sidebar_nav_order`
}

function mergeOrder(saved: string[], navLabels: string[]): string[] {
  const valid = saved.filter(l => navLabels.includes(l))
  const missing = navLabels.filter(l => !valid.includes(l))
  return [...valid, ...missing]
}

// Used by the sign-in flow so the post-login landing page matches whatever
// the user dragged to the top of their sidebar, instead of always the dashboard.
export function getOwnerLandingHref(role: SidebarRole = 'owner'): string {
  const navItems = navItemsFor(role)
  const fallback = navItems[0].href
  try {
    const saved = localStorage.getItem(orderKeyFor(role))
    if (!saved) return fallback
    const firstLabel = mergeOrder(JSON.parse(saved), navItems.map(i => i.label))[0]
    return navItems.find(i => i.label === firstLabel)?.href ?? fallback
  } catch {
    return fallback
  }
}

const THEME_LIGHT = {
  sidebarBg: '#FFFFFF',
  sidebarText: '#374151',
  sidebarActiveBg: 'transparent',
  sidebarActiveText: '#F97316',
  sidebarActiveTint: 'rgba(249,115,22,0.12)',
  sidebarHoverBg: '#F9FAFB',
  sidebarBorder: '#E5E7EB',
  logoBorder: '#E5E7EB',
  logoutHoverBg: '#FEF2F2',
}

// Partner's sidebar: black background, same orange accent as everyone else. Logo mark is untouched.
const THEME_DARK = {
  sidebarBg: '#18181B',
  sidebarText: '#D4D4D8',
  sidebarActiveBg: 'transparent',
  sidebarActiveText: '#F97316',
  sidebarActiveTint: 'rgba(249,115,22,0.12)',
  sidebarHoverBg: 'rgba(255,255,255,0.07)',
  sidebarBorder: '#3F3F46',
  logoBorder: '#3F3F46',
  logoutHoverBg: 'rgba(239,68,68,0.15)',
}

// Manager's sidebar: navy-blue background (same treatment as Partner's black), same orange accent as everyone else (CLAUDE.md §2, confirmed 2026-07-22).
const THEME_MANAGER = {
  sidebarBg: '#1E3A5F',
  sidebarText: '#FFFFFF',
  sidebarActiveBg: 'transparent',
  sidebarActiveText: '#F97316',
  sidebarActiveTint: 'rgba(249,115,22,0.15)',
  sidebarHoverBg: 'rgba(255,255,255,0.07)',
  sidebarBorder: '#2E507D',
  logoBorder: '#2E507D',
  logoutHoverBg: 'rgba(239,68,68,0.18)',
}

// Employee's sidebar: green background (same treatment as Partner/Manager), same orange accent
// as everyone else (confirmed 2026-07-25).
const THEME_EMPLOYEE = {
  sidebarBg: '#14532D',
  sidebarText: '#FFFFFF',
  sidebarActiveBg: 'transparent',
  sidebarActiveText: '#F97316',
  sidebarActiveTint: 'rgba(249,115,22,0.15)',
  sidebarHoverBg: 'rgba(255,255,255,0.07)',
  sidebarBorder: '#0F3F24',
  logoBorder: '#0F3F24',
  logoutHoverBg: 'rgba(239,68,68,0.18)',
}

export default function OwnerSidebar({
  unreadMessages,
  unreadAnnouncements,
  attendanceAlertCount,
  role = 'owner',
}: {
  unreadMessages?: number
  unreadAnnouncements?: number
  attendanceAlertCount?: number
  role?: SidebarRole
}) {
  const NAV_ITEMS = navItemsFor(role)
  const NAV_LABELS = NAV_ITEMS.map(i => i.label)
  const ORDER_KEY = orderKeyFor(role)
  const THEME = role === 'partner' ? THEME_DARK : role === 'manager' ? THEME_MANAGER : role === 'employee' ? THEME_EMPLOYEE : THEME_LIGHT
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
  const realtimeNotifications = useRealtimeNotifications()

  // ── Nav order ───────────────────────────────────────────────────────────────
  const [navOrder, setNavOrder] = useState<string[]>(NAV_LABELS)
  const navOrderRef = useRef<string[]>(NAV_LABELS)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ORDER_KEY)
      if (saved) {
        const merged = mergeOrder(JSON.parse(saved), NAV_LABELS)
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

        // A Manager's own submissions are department-scoped and only a Rejection is theirs to act
        // on — a peer's still-pending (not yet decided) submission isn't, same distinction the
        // in-page "Waiting For Review" tab dot already makes. Owner/Partner review every
        // department's queue, so any pending item counts for them.
        const fetchReviewCount = () => {
          const scopeParam = role === 'manager' ? `&manager_scope_id=${internalId}&include_rejected=true` : ''
          fetch(`/api/recruitment?company_id=${cid}&resource=pending_approval${scopeParam}`)
            .then(r => r.json())
            .then(data => {
              if (!data.success) return
              const postings = data.pendingPostings as { status: string }[]
              setReviewCount(role === 'manager' ? postings.filter(p => p.status === 'rejected').length : postings.length)
            })
            .catch(() => {})
        }
        fetchReviewCount()

        const fetchAttendanceBadgeCount = () => {
          if (role === 'manager' || role === 'employee') {
            Promise.all([
              fetch(`/api/attendance?resource=my_requests&user_id=${internalId}`).then(r => r.json()).catch(() => ({ success: false })),
              // Employee never approves — only Manager gets the shift-swap review queue count.
              role === 'manager'
                ? fetch(`/api/attendance?company_id=${cid}&resource=shift_swaps&manager_id=${internalId}`).then(r => r.json()).catch(() => ({ success: false }))
                : Promise.resolve({ success: true, requests: [] }),
            ])
              .then(([data, queueData]) => {
                const seenKey = `${role}_myreq_seen_${cid}_${internalId}`
                let seen = new Set<string>()
                try {
                  const raw = localStorage.getItem(seenKey)
                  if (raw) seen = new Set(JSON.parse(raw))
                } catch {}
                const swaps = (data.success ? data.swaps ?? [] : []) as Array<{ id: string; requester_id: string; counterpart_id: string; counterpart_status: string; status: string }>
                const fixedOff = (data.success ? data.fixed_off ?? [] : []) as Array<{ requested_week: string; source: string; status: string; reviewed_at?: string | null; created_at?: string | null }>
                const swapResponseCount = swaps.filter(s => s.counterpart_id === internalId && s.counterpart_status === 'pending' && s.status === 'pending').length
                const swapUpdateCount = swaps.filter(s => s.requester_id === internalId && s.counterpart_status !== 'pending' && !seen.has(`swap-${s.id}`)).length
                const fixedOffGroupsByWeek = new Map<string, typeof fixedOff>()
                fixedOff.forEach(req => {
                  if (req.source !== 'submitted' || req.status === 'pending') return
                  const group = fixedOffGroupsByWeek.get(req.requested_week) ?? []
                  group.push(req)
                  fixedOffGroupsByWeek.set(req.requested_week, group)
                })
                const fixedOffUpdateKeys = new Set<string>()
                fixedOffGroupsByWeek.forEach((group, weekStart) => {
                  const latestDecisionAt = group
                    .map(req => req.reviewed_at ?? req.created_at ?? '')
                    .filter(Boolean)
                    .sort()
                    .at(-1)
                  const key = latestDecisionAt ? `offday-${weekStart}-${latestDecisionAt}` : `offday-${weekStart}`
                  if (!seen.has(key)) fixedOffUpdateKeys.add(key)
                })
                const reviewQueue = (queueData.success ? queueData.requests ?? [] : []) as Array<{ status: string }>
                const swapReviewCount = reviewQueue.filter(req => req.status === 'pending').length
                setAttendanceCount(swapResponseCount + swapUpdateCount + fixedOffUpdateKeys.size + swapReviewCount)
              })
              .catch(() => {})
            return
          }
          fetch(`/api/attendance?resource=pending_requests_count&company_id=${cid}`)
            .then(r => r.json())
            .then(data => { if (data.success) setAttendanceCount(data.count ?? 0) })
            .catch(() => {})
        }
        fetchAttendanceBadgeCount()

        const fetchTaskAlerts = () => {
          // A Manager's Tasks sidebar dot includes both team-task alerts and unseen My Tasks.
          // Workload Rebalancing (UC21) and Task Delay Alert (UC22) are O/P/M-only, so Employee
          // only gets the unseen "My Tasks" component, never the workload/delay counts.
          const includeMyTasks = role === 'manager' || role === 'employee'
          const scopeParam = role === 'manager' ? `manager_scope_id=${internalId}` : `assigned_by=${internalId}`
          const myTasksSeenKey = role === 'manager' ? `manager_mytasks_seen_${cid}_${internalId}` : `employee_mytasks_seen_${cid}_${internalId}`
          const myTaskSignature = (task: { id: string; rejected_at?: string | null }) => `${task.id}::${task.rejected_at ?? ''}`
          Promise.all([
            role === 'employee' ? Promise.resolve({ success: true, suggestions: [] }) : fetch(`/api/task?company_id=${cid}&suggestion=workload&${scopeParam}`).then(r => r.json()).catch(() => ({ success: false })),
            role === 'employee' ? Promise.resolve({ success: true, alerts: [] }) : fetch(`/api/task?company_id=${cid}&suggestion=delay&${scopeParam}&viewer_id=${internalId}`).then(r => r.json()).catch(() => ({ success: false })),
            includeMyTasks
              ? fetch(`/api/task?company_id=${cid}&kanban=true&assigned_user_id=${encodeURIComponent(internalId)}&viewer_id=${encodeURIComponent(internalId)}`).then(r => r.json()).catch(() => ({ success: false }))
              : Promise.resolve({ success: true, groups: { Assigned: [] } }),
          ]).then(([workloadData, delayData, myTasksData]) => {
            const workloadCount = workloadData.success ? (workloadData.suggestions ?? []).filter((s: { type: string }) => s.type === 'rebalance').length : 0
            const delayCount = delayData.success ? (delayData.alerts ?? []).length : 0
            let seenMyTasks = new Set<string>()
            try {
              const raw = localStorage.getItem(myTasksSeenKey)
              if (raw) seenMyTasks = new Set(JSON.parse(raw))
            } catch {}
            const newMyTaskCount = includeMyTasks && myTasksData.success
              ? [
                  ...(((myTasksData.groups?.Assigned ?? []) as Array<{ id: string; rejected_at?: string | null; parent_task_id?: string | null }>)),
                  ...(((myTasksData.groups?.['In Progress'] ?? []) as Array<{ id: string; rejected_at?: string | null; rejection_reason?: string | null; parent_task_id?: string | null }>))
                    .filter(task => !!task.rejection_reason && !!task.rejected_at),
                ].filter(task => !task.parent_task_id && !seenMyTasks.has(myTaskSignature(task))).length
              : 0
            setTaskAlertCount(workloadCount + delayCount + newMyTaskCount)
          }).catch(() => {})
        }
        fetchTaskAlertsRef.current = fetchTaskAlerts
        fetchTaskAlerts()

        // BUG-053: `ann_read_ids_*` in localStorage was never written anywhere — CommunicationView
        // tracks read state server-side via /api/inbox/announcements/read (plain announcement id),
        // not localStorage — so this always came back empty and every announcement looked unread
        // forever. Read the real, server-persisted set instead.
        fetch(`/api/inbox/announcements/read?user_id=${internalId}&company_id=${cid}`)
          .then(r => r.json())
          .then(readData => {
            const readIds = new Set<string>(readData.success ? (readData.readIds ?? []) : [])
            // Employee's announcement visibility is department-scoped server-side (see
            // ownerAnnouncementRepository's isEmployee branch) — without audience_department_id
            // it always returns zero rows, so this dot would silently stay 0 forever.
            const deptParam = role === 'employee' && d.user.department_id ? `&audience_department_id=${d.user.department_id}` : ''
            fetch(`/api/inbox/announcements?company_id=${cid}&role=${role}${deptParam}`)
              .then(r => r.json())
              .then(data => {
                if (data.success) {
                  // Own posts are never "unread" — matches CommunicationView's unreadAnnCount rule.
                  const unread = (data.announcements as { id: string; user_id: string }[])
                    .filter(a => a.user_id !== internalId && !readIds.has(a.id)).length
                  setAnnCount(unread)
                }
              })
              .catch(() => {})
          })
          .catch(() => {})

        // No realtime channel subscriptions here on purpose (2026-07-30, perf fix). This used to
        // open 6 of its own Supabase channels (messages/review/announcements/swaps/off-day/tasks)
        // that duplicated the ones RealtimeNotificationsProvider already keeps open at the app
        // root — and since every dot below already prefers `realtimeNotifications.counts` the
        // moment `ready` flips true, those channels + the fetches they re-triggered were pure
        // dead weight kept alive by a sidebar that remounts fresh on every single page navigation
        // (measured: this was a large share of Manager's slower tab-switch/page-nav times).
        // The one-shot fetches above just seed msgCount/annCount/attendanceCount/taskAlertCount/
        // reviewCount for the brief pre-`ready` window; nothing needs to keep them fresh after.
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = () => { fetchTaskAlertsRef.current?.() }
    window.addEventListener('task-insights-updated', handler)
    return () => window.removeEventListener('task-insights-updated', handler)
  }, [])

  // Reset the badges to 0 the moment the Communication page mounts, for instant feedback —
  // CommunicationView is the source of truth for which announcements are actually read (it
  // tracks per-announcement `id:updated_at` keys in localStorage) and pushes the real counts
  // back down via the `unreadMessages`/`unreadAnnouncements` props once it has fetched them.
  // This must NOT also write to that same localStorage key with plain announcement ids — doing
  // so previously clobbered CommunicationView's `id:updated_at` keys with bare ids, so on the
  // next reload none of them matched readKey() anymore and every announcement looked unread again.
  useEffect(() => {
    if (pathname !== `/${role}/communication`) return
    setMsgCount(0)
    setAnnCount(0)
  }, [pathname])

  useEffect(() => { if (unreadMessages !== undefined) setMsgCount(unreadMessages) }, [unreadMessages])
  useEffect(() => { if (unreadAnnouncements !== undefined) setAnnCount(unreadAnnouncements) }, [unreadAnnouncements])

  const communicationDotCount = realtimeNotifications.ready ? realtimeNotifications.counts.communication : msgCount + annCount
  const reviewDotCount = realtimeNotifications.ready ? realtimeNotifications.counts.recruitment : reviewCount
  const attendanceDotCount = realtimeNotifications.ready
    ? realtimeNotifications.counts.attendance + (attendanceAlertCount ?? 0)
    : attendanceCount + (attendanceAlertCount ?? 0)
  const taskDotCount = realtimeNotifications.ready ? realtimeNotifications.counts.tasks : taskAlertCount

  const visibleLabels = userRole === 'Manager'
    ? navOrder.filter(l => l !== 'Report' && l !== 'Company')
    : userRole === 'Employee'
      ? navOrder.filter(l => ['Dashboard', 'Shifts', 'Tasks', 'Communication'].includes(l))
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
    localStorage.removeItem('tasking_user_role')
    localStorage.removeItem('tasking_company_id')
    localStorage.removeItem('tasking_active_session')
    sessionStorage.removeItem('tasking_session_active')
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
          <rect width="32" height="32" rx="8" fill="#F97316" />
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
          // Communication covers both tabs — unread chat messages OR unread announcements light it up.
          const showDot = dot === 'messages' ? communicationDotCount > 0 : dot === 'announcements' ? annCount > 0 : dot === 'review' ? reviewDotCount > 0 : dot === 'attendance' ? attendanceDotCount > 0 : dot === 'tasks' ? taskDotCount > 0 : false
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
                border: active ? `1.5px solid ${THEME.sidebarActiveText}` : '1.5px solid transparent',
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
                outline: isDragOver ? `2px dashed ${THEME.sidebarActiveText}` : 'none',
                outlineOffset: 3,
                boxShadow: isDragOver ? `0 14px 34px ${THEME.sidebarActiveTint}` : 'none',
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
            onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = THEME.logoutHoverBg }}
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
