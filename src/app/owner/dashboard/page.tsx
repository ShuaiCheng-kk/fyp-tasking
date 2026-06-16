'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, CheckCircle, Eye,
  Users, ClipboardList, Timer,
  MoreHorizontal, ChevronLeft, Check, Activity, MessageCircle,
  UserRound, UserCog, CheckCheck, SlidersHorizontal,
  CalendarDays, Target, Crown,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ─── Local types ──────────────────────────────────────────────────────────────

type TaskItem = {
  id: string
  title: string
  status: string
  priority?: string | null
  percentage_complete?: number
  assignee_name?: string
  assigned_user_id?: string | null
  created_at?: string
}

type TaskStats = {
  assigned: number
  inProgress: number
  review: number
  complete: number
  tasks?: TaskItem[]
}

type ActivityFeedEvent = {
  id: string
  type: 'task_updated'
  actor_name: string
  department: string
  timestamp: string
  description: string
  status: string
}

type Company = {
  id: string
  name: string
  plan: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + (m || 0)
}

function formatShiftHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

import { deptColor } from '@/lib/deptColor'

const PANEL_ORDER_KEY = 'owner_dashboard_panel_order'
const ALL_PANELS = ['focus', 'team', 'activity', 'tasks'] as const
type PanelId = typeof ALL_PANELS[number]
function mergePanelOrder(saved: string[]): PanelId[] {
  const valid = saved.filter((id): id is PanelId => (ALL_PANELS as readonly string[]).includes(id))
  const missing = ALL_PANELS.filter(id => !valid.includes(id))
  return [...valid, ...missing]
}

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function roleRank(role: string): number {
  if (role === 'Manager') return 0
  if (role === 'Employee') return 1
  return 2
}

function sortRowsByRole(rows: TimelineRow[]): TimelineRow[] {
  return [...rows].sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.full_name.localeCompare(b.full_name))
}

function priorityRank(priority?: string | null): number {
  const value = priority ?? 'None'
  if (value === 'Urgent') return 0
  if (value === 'High') return 1
  if (value === 'Medium') return 2
  if (value === 'Low') return 3
  return 4
}

function priorityBadgeClass(priority?: string | null): string {
  const value = priority ?? 'None'
  if (value === 'Urgent') return 'bg-red-100 text-red-700 border border-red-200'
  if (value === 'High') return 'bg-orange-100 text-orange-700 border border-orange-200'
  if (value === 'Medium') return 'bg-yellow-100 text-yellow-700 border border-yellow-200'
  if (value === 'Low') return 'bg-gray-100 text-gray-500 border border-gray-200'
  return 'bg-gray-50 text-gray-400 border border-gray-200'
}

function formatHourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return '12am'
  if (hour === 12) return '12pm'
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}

// ─── Animated counter ────────────────────────────────────────────────────────

function AnimatedNumber({ value, duration = 550 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const rafRef  = useRef<number | null>(null)

  useEffect(() => {
    const from = prevRef.current
    const to   = value
    if (from === to) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - t) ** 3       // ease-out cubic
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else prevRef.current = to
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])

  return <>{display.toLocaleString()}</>
}

// ─── Progress Ring ────────────────────────────────────────────────────────────

function DeptCard({ deptId, deptName, rows, onClick }: {
  deptId: string; deptName: string; rows: TimelineRow[]; onClick: () => void
}) {
  const color = deptColor(deptId)
  const managerCount = rows.filter(row => row.role === 'Manager').length
  const employeeCount = rows.filter(row => row.role !== 'Manager').length

  return (
    <article
      data-testid="dept-timeline-card"
      onClick={onClick}
      className="dept-card"
      style={{
        position: 'relative',
        padding: '12px 12px 12px 15px',
        borderRadius: 12,
        border: '1px solid #E2E8F0',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'box-shadow 0.16s ease, transform 0.16s ease, border-color 0.16s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = '0 10px 28px rgba(15,23,42,0.11)'
        e.currentTarget.style.borderColor = color
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = '#E2E8F0'
      }}
    >
      {/* Left color bar */}
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color, borderRadius: '12px 0 0 12px' }} />

      {/* Dept name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0, display: 'inline-block' }} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.15px' }}>{deptName}</p>
      </div>

      {/* Manager + Employee counts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#FFF7ED', color: '#EA580C', flexShrink: 0 }}>
            <UserCog size={13} />
          </span>
          <span style={{ color: '#111827', fontSize: 13, fontWeight: 700 }}>{managerCount}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#F3F4F6', color: '#4B5563', flexShrink: 0 }}>
            <UserRound size={13} />
          </span>
          <span style={{ color: '#111827', fontSize: 13, fontWeight: 700 }}>{employeeCount}</span>
        </div>
      </div>
    </article>
  )
}

// ─── Task status badge ────────────────────────────────────────────────────────

function TaskStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { background: string; color: string }> = {
    'In Progress': { background: '#EFF6FF', color: '#2563EB' },
    'Review':      { background: '#FEFCE8', color: '#A16207' },
    'Complete':    { background: '#F0FDF4', color: '#16A34A' },
    'Assigned':    { background: '#F3F4F6', color: '#4B5563' },
  }
  const s = styles[status] ?? { background: '#F3F4F6', color: '#4B5563' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, borderRadius: 999, padding: '0 9px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', background: s.background, color: s.color }}>
      {status}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const router = useRouter()

  const [userId,        setUserId]        = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [companyId,     setCompanyId]     = useState('')
  const [ownerName,     setOwnerName]     = useState('')
  const [companyName,   setCompanyName]   = useState('')
  const [companies,     setCompanies]     = useState<Company[]>([])
  const [currentPlan,   setCurrentPlan]   = useState('Free')
  const [dashboardRole, setDashboardRole] = useState('')
  const [initialReady,  setInitialReady]  = useState(false)
  const [removalOverlay, setRemovalOverlay] = useState<{ companyName: string } | null>(null)
  const [dropdownOpen,   setDropdownOpen]   = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Task stats
  const [taskStats,        setTaskStats]        = useState<TaskStats | null>(null)
  const [taskStatsLoading, setTaskStatsLoading] = useState(false)

  // Activity feed
  const [activityFeed,        setActivityFeed]        = useState<ActivityFeedEvent[]>([])
  const [activityFeedLoading, setActivityFeedLoading] = useState(false)
  const [markedFeedItems, setMarkedFeedItems] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('tasking_marked_feed_items')
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set()
    } catch { return new Set() }
  })
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [chartReady, setChartReady] = useState(false)

  // Timeline
  const [timelineRows,    setTimelineRows]    = useState<TimelineRow[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineView,    setTimelineView]    = useState<'global' | 'dept'>('global')
  const [timeFrom, setTimeFrom] = useState(7)
  const [timeTo,   setTimeTo]   = useState(23)
  const [isAutoFit, setIsAutoFit] = useState(false)

  // Department drill-down: null = card grid, string = selected deptId
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null)

  // ── Dashboard panel order (horizontal drag) ───────────────────────────────
  const [panelOrder, setPanelOrder] = useState<PanelId[]>([...ALL_PANELS])
  const panelOrderRef = useRef<PanelId[]>([...ALL_PANELS])
  const [panelDrag, setPanelDrag] = useState<{
    fromIdx: number; panelId: PanelId; ghostX: number; insertAt: number
  } | null>(null)
  const panelDragRef = useRef<typeof panelDrag>(null)
  const panelEls = useRef<Map<PanelId, HTMLDivElement>>(new Map())
  const panelPrevRects = useRef<Map<PanelId, DOMRect>>(new Map())

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleRemovalDetected = useCallback((removedCompanyName: string, availableCompanies: Company[]) => {
    setRemovalOverlay({ companyName: removedCompanyName })
    setTimeout(() => {
      setRemovalOverlay(null)
      if (availableCompanies.length === 0) {
        fetch('/api/auth/signout', { method: 'POST' })
        window.location.href = '/signout'
      }
    }, 3000)
  }, [])

  // ── Mount: resolve session → company context ───────────────────────────────

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let userIdResolved = localStorage.getItem('tasking_user_id')
      if (!userIdResolved) {
        const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) { userIdResolved = session.user.id; localStorage.setItem('tasking_user_id', userIdResolved) }
      }
      if (!userIdResolved) { router.replace('/signin'); return }
      if (cancelled) return
      setUserId(userIdResolved)

      fetch(`/api/user/me?user_id=${userIdResolved}`)
        .then(r => r.json())
        .then(d => {
          if (!cancelled && d.success) {
            if (d.user?.id) setInternalUserId(d.user.id)
            if (d.user?.full_name) setOwnerName(d.user.full_name)
          }
        })
        .catch(() => {})

      const storedCid = localStorage.getItem(`tasking_company_id_${userIdResolved}`)
      const qs = new URLSearchParams({ user_id: userIdResolved })
      if (storedCid) qs.set('company_id', storedCid)

      const res = await fetch(`/api/company/current?${qs}`)
      if (!res.ok) { if (!cancelled) setInitialReady(true); return }
      const data = await res.json()
      if (cancelled) return
      if (!data.success) { setInitialReady(true); return }

      setDashboardRole(data.role || '')
      const list: Company[] = (data.companies || []).map((c: Company) => ({ id: c.id, name: c.name, plan: c.plan }))
      setCompanies(list)

      if (data.company) {
        const company = data.company
        if (storedCid && !list.some(c => c.id === storedCid)) {
          localStorage.setItem(`tasking_company_id_${userIdResolved}`, company.id)
          setCompanyId(company.id); setCompanyName(company.name); setCurrentPlan(company.plan || 'Free')
          setInitialReady(true)
          const removedName = localStorage.getItem(`tasking_last_company_name_${storedCid}`) || 'your previous company'
          handleRemovalDetected(removedName, list)
          return
        }
        localStorage.setItem(`tasking_company_id_${userIdResolved}`, company.id)
        localStorage.setItem(`tasking_last_company_name_${company.id}`, company.name)
        setCompanyId(company.id); setCompanyName(company.name); setCurrentPlan(company.plan || 'Free')
      } else if (storedCid && list.length > 0) {
        const next = list[0]
        localStorage.setItem(`tasking_company_id_${userIdResolved}`, next.id)
        setCompanyId(next.id); setCompanyName(next.name); setCurrentPlan(next.plan || 'Free')
      } else {
        setCompanyId(''); setCompanyName('')
      }
      setInitialReady(true)
    }
    void run()
    return () => { cancelled = true }
  }, [router, handleRemovalDetected])

  // ── Task stats + feed ──────────────────────────────────────────────────────

  const fetchDashboardData = useCallback(async (cid: string) => {
    if (!cid) return
    setTaskStatsLoading(true)
    setActivityFeedLoading(true)
    try {
      const [statsRes, feedRes] = await Promise.all([
        fetch(`/api/task?company_id=${cid}&stats=true`),
        fetch(`/api/task?company_id=${cid}&activity_feed=true`),
      ])
      const statsData = await statsRes.json()
      const feedData  = await feedRes.json()
      if (statsData.success) setTaskStats(statsData.stats)
      if (feedData.success)  setActivityFeed(feedData.feed ?? [])
      setLastRefreshed(new Date())
    } catch {}
    finally { setTaskStatsLoading(false); setActivityFeedLoading(false) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!companyId) return
    const timer = window.setTimeout(() => { void fetchDashboardData(companyId) }, 0)
    return () => window.clearTimeout(timer)
  }, [companyId, fetchDashboardData])

  useEffect(() => {
    try {
      localStorage.setItem('tasking_marked_feed_items', JSON.stringify([...markedFeedItems]))
    } catch {}
  }, [markedFeedItems])

  // Timeline fetch
  const fetchTimeline = useCallback(async (cid: string) => {
    if (!cid) return
    setTimelineLoading(true)
    try {
      const today = formatDateKey(new Date())
      const res = await fetch(`/api/shift?company_id=${cid}&date_from=${today}&date_to=${today}`)
      const data = await res.json()
      if (data.success) setTimelineRows(data.rows ?? [])
    } catch {}
    finally { setTimelineLoading(false) }
  }, [])

  useEffect(() => {
    if (!companyId) return
    const timer = window.setTimeout(() => { void fetchTimeline(companyId) }, 0)
    return () => window.clearTimeout(timer)
  }, [companyId, fetchTimeline])

  // ── Donut chart entrance ──────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setChartReady(true), 480)
    return () => clearTimeout(t)
  }, [])

  // ── Load panel order from localStorage ────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PANEL_ORDER_KEY)
      if (saved) {
        const merged = mergePanelOrder(JSON.parse(saved) as string[])
        panelOrderRef.current = merged
        setPanelOrder(merged)
      }
    } catch {}
  }, [])


  // ── Supabase realtime: push updates on task / shift changes ──────────────
  useEffect(() => {
    if (!companyId) return
    const client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const channel = client
      .channel('dashboard-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tasks',
        filter: `company_id=eq.${companyId}`,
      }, () => { void fetchDashboardData(companyId) })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'shift_assignments',
      }, () => { void fetchTimeline(companyId) })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [companyId, fetchDashboardData, fetchTimeline])

  // ── Derived data ──────────────────────────────────────────────────────────

  const todayActiveStaff    = timelineRows.filter(r => r.user_id && !['Owner', 'Partner'].includes(r.role) && r.shifts.length > 0)
  const todayShiftCount     = todayActiveStaff.length
  const casualWorkersCount  = todayActiveStaff.filter(r => r.role === 'Casual Worker').length

  const totalTasks = taskStats
    ? taskStats.assigned + taskStats.inProgress + taskStats.review + taskStats.complete
    : 0

  const completeCount = taskStats?.complete ?? 0

  const todayTasks = [...(taskStats?.tasks ?? [])].sort((a, b) => {
    const byPriority = priorityRank(a.priority) - priorityRank(b.priority)
    if (byPriority !== 0) return byPriority
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  })
  const priorityFocusTasks = todayTasks
    .filter(task => task.priority === 'Urgent' || task.priority === 'High')
    .sort((a, b) => {
      if (a.status === 'Complete' && b.status !== 'Complete') return 1
      if (a.status !== 'Complete' && b.status === 'Complete') return -1
      return priorityRank(a.priority) - priorityRank(b.priority)
    })
  const priorityCompleteCount = priorityFocusTasks.filter(task => task.status === 'Complete').length
  const priorityCompletionPct = priorityFocusTasks.length > 0
    ? Math.round((priorityCompleteCount / priorityFocusTasks.length) * 100)
    : 0
  const focusAssignedCount    = priorityFocusTasks.filter(t => t.status === 'Assigned' || !t.status).length
  const focusInProgressCount  = priorityFocusTasks.filter(t => t.status === 'In Progress').length
  const focusReviewCount      = priorityFocusTasks.filter(t => t.status === 'Review').length
  const focusDonutSegs = (() => {
    const total = priorityFocusTasks.length
    const raw = [
      { count: focusAssignedCount,   color: '#94A3B8', label: 'Assigned' },
      { count: focusInProgressCount, color: '#4F46E5', label: 'In Progress' },
      { count: focusReviewCount,     color: '#D97706', label: 'Review' },
      { count: priorityCompleteCount, color: '#059669', label: 'Complete' },
    ]
    let cumFrac = 0
    return raw.map(seg => {
      const frac = total > 0 ? seg.count / total : 0
      const start = cumFrac
      cumFrac += frac
      return { ...seg, frac, start }
    })
  })()
  const feedKey = (event: ActivityFeedEvent) => event.id ?? `${event.type}-${event.timestamp}-${event.description}`

  const teamByDept: Record<string, { name: string; rows: TimelineRow[] }> = {}
  for (const row of todayActiveStaff) {
    if (!teamByDept[row.department_id]) teamByDept[row.department_id] = { name: row.department_name, rows: [] }
    teamByDept[row.department_id].rows.push(row)
  }
  for (const group of Object.values(teamByDept)) {
    group.rows = sortRowsByRole(group.rows)
  }

  // ── Panel drag handlers ───────────────────────────────────────────────────
  const capturePanelRects = useCallback(() => {
    panelEls.current.forEach((el, id) => {
      if (el) panelPrevRects.current.set(id, el.getBoundingClientRect())
    })
  }, [])

  const playPanelFlip = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panelEls.current.forEach((el, id) => {
          if (!el) return
          const prev = panelPrevRects.current.get(id)
          if (!prev) return
          const curr = el.getBoundingClientRect()
          const dx = prev.left - curr.left
          if (Math.abs(dx) < 1) return
          el.style.transition = 'none'
          el.style.transform = `translateX(${dx}px)`
          void el.offsetHeight
          el.style.transition = 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)'
          el.style.transform = 'translateX(0px)'
        })
      })
    })
  }, [])

  const calcPanelInsertAt = useCallback((mouseX: number): number => {
    const ids = panelOrderRef.current
    for (let i = 0; i < ids.length; i++) {
      const el = panelEls.current.get(ids[i])
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (mouseX < rect.left + rect.width / 2) return i
    }
    return ids.length - 1
  }, [])

  const startPanelDrag = useCallback((e: React.MouseEvent, fromIdx: number, panelId: PanelId) => {
    e.preventDefault()
    const initial = { fromIdx, panelId, ghostX: e.clientX, insertAt: fromIdx }
    panelDragRef.current = initial
    setPanelDrag(initial)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'

    const onMove = (ev: MouseEvent) => {
      const insertAt = calcPanelInsertAt(ev.clientX)
      const next = { ...panelDragRef.current!, ghostX: ev.clientX, insertAt }
      panelDragRef.current = next
      setPanelDrag(next)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      const d = panelDragRef.current
      if (d && d.fromIdx !== d.insertAt) {
        capturePanelRects()
        const next = [...panelOrderRef.current]
        const [moved] = next.splice(d.fromIdx, 1)
        next.splice(d.insertAt, 0, moved)
        panelOrderRef.current = next as PanelId[]
        setPanelOrder(next as PanelId[])
        try { localStorage.setItem(PANEL_ORDER_KEY, JSON.stringify(next)) } catch {}
        playPanelFlip()
      }
      panelDragRef.current = null
      setPanelDrag(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [calcPanelInsertAt, capturePanelRects, playPanelFlip])

  const getPanelShift = (idx: number, fromIdx: number, insertAt: number): number => {
    if (fromIdx === insertAt || idx === fromIdx) return 0
    const el = panelEls.current.get(panelOrder[fromIdx])
    const w = el ? el.getBoundingClientRect().width + 16 : 0
    if (fromIdx < insertAt) {
      if (idx > fromIdx && idx <= insertAt) return -w
    } else {
      if (idx >= insertAt && idx < fromIdx) return w
    }
    return 0
  }

  // Timeline rendering helpers
  const PERSON_COL = 180
  const ROW_H = 58

  // Auto-fit: earliest shift start → latest shift end across all today's rows, with ±1h padding
  const autoFrom = todayActiveStaff.length > 0
    ? Math.max(0, Math.floor(Math.min(...todayActiveStaff.flatMap(r => r.shifts.map(s => timeToMinutes(s.start_time)))) / 60) - 1)
    : 7
  const autoTo = todayActiveStaff.length > 0
    ? Math.min(24, Math.ceil(Math.max(...todayActiveStaff.flatMap(r => r.shifts.map(s => timeToMinutes(s.end_time)))) / 60) + 1)
    : 23

  function positionForTime(minutes: number): number {
    const start = timeFrom * 60
    const end = timeTo * 60
    return ((Math.max(start, Math.min(end, minutes)) - start) / Math.max(end - start, 1)) * 100
  }

  const visibleTimelineRows = todayActiveStaff.filter(row => {
    const start = timeFrom * 60
    const end = timeTo * 60
    return row.shifts.some(s => timeToMinutes(s.start_time) < end && timeToMinutes(s.end_time) > start)
  })

  const deptGroups: Record<string, { name: string; rows: TimelineRow[] }> = {}
  for (const row of visibleTimelineRows) {
    if (!deptGroups[row.department_id]) deptGroups[row.department_id] = { name: row.department_name, rows: [] }
    deptGroups[row.department_id].rows.push(row)
  }
  for (const group of Object.values(deptGroups)) {
    group.rows = sortRowsByRole(group.rows)
  }

  const deptIds = Object.keys(deptGroups)

  const hourTicks: number[] = []
  for (let h = timeFrom; h <= timeTo; h++) hourTicks.push(h)

  function renderTimelineContent(rows: TimelineRow[]) {
    const segStart = timeFrom * 60
    const segEnd = timeTo * 60

    if (rows.length === 0) {
      return (
        <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>
          No shifts scheduled today in this range
        </div>
      )
    }

    // Group rows by dept, preserving order of first appearance
    const deptOrder: string[] = []
    const deptMap: Record<string, { name: string; color: string; rows: TimelineRow[] }> = {}
    for (const row of rows) {
      if (!deptMap[row.department_id]) {
        deptOrder.push(row.department_id)
        deptMap[row.department_id] = { name: row.department_name, color: deptColor(row.department_id), rows: [] }
      }
      deptMap[row.department_id].rows.push(row)
    }

    const EDGE = '2px solid rgba(15,23,42,0.45)'
    return (
      <div style={{ borderRight: EDGE, borderBottom: EDGE }}>
        {deptOrder.map((deptId, deptIdx) => {
          const dept = deptMap[deptId]
          return dept.rows.map((row, rowIdx) => {
            const isDeptBoundary = deptIdx > 0 && rowIdx === 0
            return (
            <div
              key={`${row.user_id ?? row.department_id}_${rowIdx}`}
              style={{ display: 'flex', height: ROW_H, borderTop: isDeptBoundary ? EDGE : 'none', background: '#FFFFFF' }}
            >
              {/* Dept color bar — narrow strip only, no text */}
              <div style={{ width: 8, flexShrink: 0, background: dept.color, opacity: 0.85 }} />

              {/* Person col */}
              <div style={{ width: PERSON_COL, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: row.profile_photo_url ? 'transparent' : (row.role === 'Manager' ? '#FFF7ED' : '#F3F4F6'), color: row.role === 'Manager' ? '#EA580C' : '#4B5563', borderRadius: 999, overflow: 'hidden' }}>
                    {row.profile_photo_url
                      ? <img src={row.profile_photo_url} alt={row.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : row.role === 'Manager' ? <UserCog size={13} /> : <UserRound size={13} />}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.full_name}
                  </span>
                </div>
              </div>

              {/* Shift bars */}
              <div style={{ position: 'relative', flex: 1 }}>
                {/* Vertical hour grid lines — in front of shift bars */}
                {hourTicks.map(h => (
                  <div
                    key={`grid-${h}`}
                    style={{
                      position: 'absolute',
                      top: 0, bottom: 0,
                      left: `${positionForTimeWithPad(h * 60)}%`,
                      width: 0,
                      borderLeft: '1px solid rgba(15,23,42,0.12)',
                      pointerEvents: 'none',
                      zIndex: 2,
                    }}
                  />
                ))}
                {row.shifts.map((shift: TimelineShiftBlock) => {
                  const startMin = timeToMinutes(shift.start_time)
                  const endMin = timeToMinutes(shift.end_time)
                  if (endMin <= segStart || startMin >= segEnd) return null
                  const left = positionForTimeWithPad(startMin)
                  const right = positionForTimeWithPad(endMin)
                  const width = right - left
                  if (width <= 0) return null
                  const color = deptColor(row.department_id)
                  return (
                    <div
                      key={shift.id}
                      style={{
                        position: 'absolute',
                        top: 10, bottom: 10,
                        left: `${left}%`,
                        width: `${Math.max(width, 1.5)}%`,
                        borderRadius: 999,
                        background: color,
                        border: 'none',
                        zIndex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none', padding: '0 10px' }}>
                        {formatShiftHour(shift.start_time)} – {formatShiftHour(shift.end_time)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )})
        })}
      </div>
    )
  }
  const TIMELINE_PAD_PCT = 4

  function positionForTimeWithPad(minutes: number): number {
    const raw = positionForTime(minutes)
    return TIMELINE_PAD_PCT + (raw / 100) * (100 - TIMELINE_PAD_PCT * 2)
  }

  function renderHourAxis() {
    return (
      <div style={{ display: 'flex', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', borderRadius: '12px 12px 0 0' }}>
        <div style={{ width: 8 + PERSON_COL, flexShrink: 0 }} />
        <div style={{ position: 'relative', height: 36, flex: 1 }}>
          {hourTicks.map((h) => {
            const left = `${positionForTimeWithPad(h * 60)}%`
            return (
              <div
                key={h}
                style={{
                  position: 'absolute',
                  top: 0,
                  left,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  pointerEvents: 'none',
                }}
              >
                <span style={{
                  display: 'block',
                  marginTop: 9,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.55)',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  letterSpacing: '0.02em',
                }}>
                  {formatHourLabel(h)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const selectedDeptRows = selectedDeptId ? (deptGroups[selectedDeptId]?.rows ?? []) : []
  const selectedDeptName = selectedDeptId ? (deptGroups[selectedDeptId]?.name ?? '') : ''

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F1F5F9', fontFamily: 'inherit' }}>
      <style>{`
        @keyframes dotPulse {
          0%   { box-shadow: 0 0 0 0 rgba(52,211,153,0.55); }
          70%  { box-shadow: 0 0 0 5px rgba(52,211,153,0); }
          100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-14px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes numberPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
        @keyframes iconBounce {
          0%, 100% { transform: translateY(0); }
          40%      { transform: translateY(-4px); }
          70%      { transform: translateY(-2px); }
        }
        /* ── Stat cards ── */
        .stat-card {
          transition: box-shadow 0.22s ease, transform 0.22s ease, background 0.18s ease;
          cursor: default;
        }
        .stat-card:hover {
          box-shadow: 0 8px 28px rgba(0,0,0,0.10), 0 0 0 1.5px rgba(249,115,22,0.18) !important;
          transform: translateY(-3px) scale(1.015);
        }
        .stat-card:hover .stat-icon {
          animation: iconBounce 0.5s ease forwards;
        }
        /* ── Panel cards (Focus / Team / Feed / Tasks) ── */
        .panel-card {
          transition: box-shadow 0.22s ease, transform 0.22s ease;
        }
        .panel-card:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.09), 0 0 0 1.5px rgba(0,0,0,0.07) !important;
          transform: translateY(-2px);
        }
        /* ── Feed items ── */
        .feed-item {
          transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
        }
        .feed-item:hover {
          background: #F8FAFC !important;
          transform: translateX(2px);
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        /* ── Task items ── */
        .task-item {
          transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
        }
        .task-item:hover {
          background: #F8FAFC !important;
          transform: translateX(2px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        /* ── Team member rows ── */
        .team-row {
          transition: background 0.15s ease, transform 0.12s ease;
        }
        .team-row:hover {
          background: #FFF7ED !important;
          transform: translateX(2px);
        }
        /* ── Dept cards (schedule grid) ── */
        .dept-card {
          transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
        }
        .dept-card:hover {
          box-shadow: 0 6px 24px rgba(0,0,0,0.10) !important;
          transform: translateY(-3px);
          border-color: #FDBA74 !important;
        }
        /* ── Mark/read buttons ── */
        .mark-btn {
          transition: background 0.15s ease, color 0.15s ease, transform 0.12s ease;
        }
        .mark-btn:hover {
          transform: scale(1.05);
        }
        /* ── Message button ── */
        .msg-btn {
          transition: color 0.15s ease, transform 0.15s ease, background 0.15s ease !important;
        }
        .msg-btn:hover {
          transform: scale(1.18) !important;
        }
        /* ── Staggered entrance for stat cards ── */
        .stat-card:nth-child(1) { animation: fadeSlideUp 0.38s ease both; animation-delay: 0.04s; }
        .stat-card:nth-child(2) { animation: fadeSlideUp 0.38s ease both; animation-delay: 0.08s; }
        .stat-card:nth-child(3) { animation: fadeSlideUp 0.38s ease both; animation-delay: 0.12s; }
        .stat-card:nth-child(4) { animation: fadeSlideUp 0.38s ease both; animation-delay: 0.16s; }
        .stat-card:nth-child(5) { animation: fadeSlideUp 0.38s ease both; animation-delay: 0.20s; }
        .stat-card:nth-child(6) { animation: fadeSlideUp 0.38s ease both; animation-delay: 0.24s; }
        /* ── Staggered entrance for panel cards ── */
        .panel-card:nth-child(1) { animation: scaleIn 0.40s ease both; animation-delay: 0.18s; }
        .panel-card:nth-child(2) { animation: scaleIn 0.40s ease both; animation-delay: 0.24s; }
        .panel-card:nth-child(3) { animation: scaleIn 0.40s ease both; animation-delay: 0.30s; }
        .panel-card:nth-child(4) { animation: scaleIn 0.40s ease both; animation-delay: 0.36s; }
        /* ── Feed items stagger ── */
        .feed-item:nth-child(1) { animation: slideInLeft 0.28s ease both; animation-delay: 0.05s; }
        .feed-item:nth-child(2) { animation: slideInLeft 0.28s ease both; animation-delay: 0.10s; }
        .feed-item:nth-child(3) { animation: slideInLeft 0.28s ease both; animation-delay: 0.15s; }
        .feed-item:nth-child(4) { animation: slideInLeft 0.28s ease both; animation-delay: 0.20s; }
        .feed-item:nth-child(5) { animation: slideInLeft 0.28s ease both; animation-delay: 0.25s; }
      `}</style>
      <OwnerSidebar />

      <main
        style={{ marginLeft: 64, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, padding: '20px 28px', gap: 0 }}
      >

        {/* ── Page header ────────────────────────────────────────── */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F97316', marginBottom: 4 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              {companyName ? `Today's Overview for ${companyName}` : "Today's Overview"}
            </h1>
          </div>

          {/* Right: user + plan */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {internalUserId && <OwnerUserBadge userId={internalUserId} companyId={companyId} />}
            {companyId && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {initialReady && !companyId && (
            <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '14px 16px', fontSize: 13, color: '#92400E', border: '1px solid #FDE68A' }}>
              No company is linked to your profile yet. If you just accepted an invitation, try signing out and signing in again.
            </div>
          )}

          {companyId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1, overflow: 'hidden', minHeight: 0 }}>
              {/* ── Last refreshed chip ── */}
              {lastRefreshed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, marginBottom: -8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', flexShrink: 0, display: 'inline-block', animation: 'dotPulse 1.4s ease-out infinite', marginLeft: 5 }} />
                  <span style={{ fontSize: 10, fontWeight: 500, color: '#94A3B8', letterSpacing: '0.03em' }}>
                    Updated {timeAgo(lastRefreshed.toISOString())}
                  </span>
                </div>
              )}

              {/* ── ROW 1: Stat cards ─────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 14, flexShrink: 0 }}>
                {[
                  {
                    label: 'Staff on Shift',
                    value: timelineLoading ? null : todayShiftCount,
                    icon: <Users size={16} style={{ color: '#F97316' }} />,
                    accentBg: '#FFF7ED',
                  },
                  {
                    label: 'Casual Workers',
                    value: timelineLoading ? null : casualWorkersCount,
                    icon: <UserRound size={16} style={{ color: '#EC4899' }} />,
                    accentBg: '#FDF2F8',
                  },
                  {
                    label: 'Total Tasks',
                    value: taskStatsLoading ? null : totalTasks,
                    icon: <ClipboardList size={16} style={{ color: '#3B82F6' }} />,
                    accentBg: '#EFF6FF',
                  },
                  {
                    label: 'Tasks In Progress',
                    value: taskStatsLoading ? null : (taskStats?.inProgress ?? 0),
                    icon: <Timer size={16} style={{ color: '#8B5CF6' }} />,
                    accentBg: '#F5F3FF',
                  },
                  {
                    label: 'Tasks In Review',
                    value: taskStatsLoading ? null : (taskStats?.review ?? 0),
                    icon: <Eye size={16} style={{ color: '#F59E0B' }} />,
                    accentBg: '#FFFBEB',
                  },
                  {
                    label: 'Tasks Complete',
                    value: taskStatsLoading ? null : (taskStats?.complete ?? 0),
                    icon: <CheckCircle size={16} style={{ color: '#10B981' }} />,
                    accentBg: '#ECFDF5',
                  },
                ].map(card => (
                  <article key={card.label} className="stat-card" style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: '16px 18px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{card.label}</p>
                      <div className="stat-icon" style={{ width: 32, height: 32, borderRadius: 10, background: card.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {card.icon}
                      </div>
                    </div>
                    <p style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1, margin: 0, letterSpacing: '-0.5px' }}>
                      {card.value === null ? <Spinner size={14} dark /> : <AnimatedNumber value={card.value} />}
                    </p>
                  </article>
                ))}
              </div>

              {/* ── ROW 2: Timeline full width ─── */}
              <div style={{ flexShrink: 0 }}>

                {/* Timeline */}
                <div className="panel-card" style={{ minWidth: 0, padding: '16px 20px', background: '#FFFFFF', borderRadius: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
                  {/* Timeline header */}
                  <div className="mb-4 flex items-center justify-between gap-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
                    <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {selectedDeptId ? (
                        <>
                          <button
                            onClick={() => setSelectedDeptId(null)}
                            className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-sm font-medium text-gray-500 hover:text-gray-800"
                          >
                            <ChevronLeft size={15} />
                            All Departments
                          </button>
                          <span className="text-gray-200">·</span>
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: deptColor(selectedDeptId) }} />
                          <span className="text-sm font-semibold text-gray-900">{selectedDeptName}</span>
                        </>
                      ) : (
                        <>
                          <CalendarDays className="size-4 text-orange-500" />
                          <span className="text-base font-semibold text-gray-900">Schedule</span>
                          {timelineLoading && <Spinner size={13} dark />}
                        </>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        data-testid="timeline-menu"
                        aria-label="Options"
                        className="flex size-9 cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50"
                      >
                        <MoreHorizontal size={16} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={10} style={{ width: 300, borderRadius: 16, padding: 16, border: '1px solid #E5E7EB', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
                        {/* View mode */}
                        <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <SlidersHorizontal size={12} style={{ color: '#F97316' }} />
                          Timeline view
                        </p>
                        <div style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
                          {(['global', 'dept'] as const).map(v => (
                            <DropdownMenuItem
                              key={v}
                              onClick={() => setTimelineView(v)}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                borderRadius: 10, padding: '8px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                background: timelineView === v ? '#FFF7ED' : 'transparent',
                                color: timelineView === v ? '#EA580C' : '#374151',
                              }}
                            >
                              <span>{v === 'global' ? 'All departments' : 'By department'}</span>
                              {timelineView === v && <Check size={13} />}
                            </DropdownMenuItem>
                          ))}
                        </div>

                        <div style={{ height: 1, background: '#F3F4F6', margin: '0 0 12px 0' }} />

                        {/* Time window */}
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>Time window</span>
                        </div>

                        {/* Auto-fit / Full presets */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                          {[
                            {
                              label: 'Auto-fit',
                              onClick: () => { setTimeFrom(autoFrom); setTimeTo(autoTo); setIsAutoFit(true) },
                              active: isAutoFit,
                            },
                            {
                              label: 'Full day',
                              onClick: () => { setTimeFrom(0); setTimeTo(24); setIsAutoFit(false) },
                              active: !isAutoFit && timeFrom === 0 && timeTo === 24,
                            },
                          ].map(opt => (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={opt.onClick}
                              style={{
                                cursor: 'pointer', borderRadius: 10, border: opt.active ? '1.5px solid #FDBA74' : '1px solid #E5E7EB',
                                background: opt.active ? '#FFF7ED' : '#F9FAFB', padding: '8px 6px', textAlign: 'center',
                              }}
                            >
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: opt.active ? '#EA580C' : '#374151' }}>{opt.label}</p>
                            </button>
                          ))}
                        </div>

                        {/* From / To manual adjust */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          {[
                            { label: 'From', val: timeFrom, dec: () => { setIsAutoFit(false); setTimeFrom(Math.max(0, timeFrom - 1)) }, inc: () => { setIsAutoFit(false); setTimeFrom(Math.min(timeTo - 1, timeFrom + 1)) } },
                            { label: 'To', val: timeTo, dec: () => { setIsAutoFit(false); setTimeTo(Math.max(timeFrom + 1, timeTo - 1)) }, inc: () => { setIsAutoFit(false); setTimeTo(Math.min(24, timeTo + 1)) } },
                          ].map(ctrl => (
                            <div key={ctrl.label} style={{ borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB', padding: '8px 10px' }}>
                              <p style={{ margin: '0 0 6px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>{ctrl.label}</p>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                <button type="button" onClick={ctrl.dec} aria-label={`Decrease ${ctrl.label}`} style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{formatHourLabel(ctrl.val)}</span>
                                <button type="button" onClick={ctrl.inc} aria-label={`Increase ${ctrl.label}`} style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Department card grid (default — no drill-down) */}
                  {!selectedDeptId && (
                    <>
                      {timelineLoading ? (
                        <div className="py-10 flex justify-center"><Spinner size={20} dark /></div>
                      ) : deptIds.length === 0 ? (
                        <div style={{ padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                          <CalendarDays size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                          <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No shifts scheduled today</p>
                        </div>
                      ) : timelineView === 'dept' ? (
                        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
                          {deptIds.map(deptId => (
                            <DeptCard
                              key={deptId}
                              deptId={deptId}
                              deptName={deptGroups[deptId].name}
                              rows={deptGroups[deptId].rows}
                              onClick={() => setSelectedDeptId(deptId)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                          {renderHourAxis()}
                          {renderTimelineContent(visibleTimelineRows)}
                        </div>
                      )}
                    </>
                  )}

                  {/* Drill-down: single department timeline */}
                  {selectedDeptId && (
                    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                      {renderHourAxis()}
                      {renderTimelineContent(selectedDeptRows)}
                    </div>
                  )}

                  {/* ── Department legend — only in all-departments view ── */}
                  {!timelineLoading && deptIds.length > 0 && timelineView === 'global' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid #F1F5F9', flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', marginRight: 4, flexShrink: 0 }}>Departments</span>
                      {deptIds.map(deptId => {
                        const color = deptColor(deptId)
                        const name = deptGroups[deptId]?.name ?? deptId
                        const count = deptGroups[deptId]?.rows?.length ?? 0
                        return (
                          <div key={deptId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '4px 10px 4px 6px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0, display: 'inline-block' }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{name}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* ── ROW 3: 4 draggable panels ─── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, alignItems: 'start', position: 'relative' }}>
                {panelOrder.map((panelId, idx) => {
                  const isDragging = panelDrag?.panelId === panelId
                  const shift = panelDrag ? getPanelShift(idx, panelDrag.fromIdx, panelDrag.insertAt) : 0
                  const PANEL_META: Record<PanelId, { label: string; icon: React.ReactNode }> = {
                    focus:    { label: 'Focus',     icon: <Target size={15} style={{ color: '#EA580C' }} /> },
                    team:     { label: 'Team',      icon: <Users size={15} style={{ color: '#F97316' }} /> },
                    activity: { label: 'Live Feed', icon: <Activity size={15} style={{ color: '#F97316' }} /> },
                    tasks:    { label: 'Tasks',     icon: <ClipboardList size={15} style={{ color: '#F97316' }} /> },
                  }
                  const meta = PANEL_META[panelId]
                  return (
                  <div
                    key={panelId}
                    ref={el => { if (el) panelEls.current.set(panelId, el as HTMLDivElement); else panelEls.current.delete(panelId) }}
                    className="panel-card"
                    style={{
                      background: '#fff', borderRadius: 20, padding: 20,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)',
                      display: 'flex', flexDirection: 'column',
                      transform: isDragging ? 'scale(0.97)' : `translateX(${shift}px)`,
                      transition: isDragging
                        ? 'opacity 0.12s, transform 0.12s'
                        : 'transform 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                      opacity: isDragging ? 0.25 : 1,
                      cursor: panelDrag ? 'grabbing' : 'default',
                    }}
                  >
                    {/* Panel header — icon is drag handle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: panelId === 'focus' ? 18 : 16, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          onMouseDown={e => startPanelDrag(e, idx, panelId)}
                          title="Drag to reorder"
                          style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', flexShrink: 0 }}
                        >
                          {meta.icon}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px' }}>{meta.label}</span>
                        {panelId === 'activity' && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', flexShrink: 0, display: 'inline-block', animation: 'dotPulse 1.4s ease-out infinite' }} />
                        )}
                      </div>
                      {panelId === 'activity' && activityFeed.length > 0 && (
                        <button
                          type="button"
                          className="mark-btn"
                          onClick={() => setMarkedFeedItems(new Set(activityFeed.map(event => feedKey(event))))}
                          style={{ cursor: 'pointer', borderRadius: 999, border: '1px solid #E2E8F0', background: '#fff', padding: '5px 14px', fontSize: 11, fontWeight: 600, color: '#64748B', transition: 'all 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    {/* ── Focus content ── */}
                    {panelId === 'focus' && (
                    <div style={{ }}>
                    {taskStatsLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner size={20} dark /></div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Donut chart */}
                        {(() => {
                          const total = priorityFocusTasks.length
                          const RM = 55, SW = 16, CX = 80, CY = 80
                          const C = 2 * Math.PI * RM
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                              {/* SVG donut */}
                              <div style={{ flexShrink: 0 }}>
                                <svg width={160} height={160} viewBox="0 0 160 160">
                                  {total === 0 ? (
                                    <circle cx={CX} cy={CY} r={RM} fill="none" stroke="#F3F4F6" strokeWidth={SW} />
                                  ) : (
                                    focusDonutSegs.map((seg, i) => {
                                      if (seg.count === 0) return null
                                      return (
                                        <circle
                                          key={i}
                                          cx={CX} cy={CY} r={RM}
                                          fill="none"
                                          stroke={seg.color}
                                          strokeWidth={SW}
                                          strokeDasharray={`${seg.frac * C} ${C}`}
                                          transform={`rotate(${-90 + seg.start * 360} ${CX} ${CY})`}
                                          strokeLinecap="butt"
                                        />
                                      )
                                    })
                                  )}
                                  <text x={CX} y={CY - 10} textAnchor="middle" dominantBaseline="middle" fill="#0F172A" fontSize="24" fontWeight="800" fontFamily="inherit">{total}</text>
                                  <text x={CX} y={CY + 12} textAnchor="middle" dominantBaseline="middle" fill="#94A3B8" fontSize="11" fontWeight="500" fontFamily="inherit">tasks</text>
                                </svg>
                              </div>
                              {/* Legend */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {focusDonutSegs.map(seg => (
                                  <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: 12, color: '#374151', width: 68 }}>{seg.label}</span>
                                    <span style={{ fontSize: 14, fontWeight: 800, color: seg.count > 0 ? seg.color : '#D1D5DB' }}>{seg.count}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })()}

                        {/* Task list */}
                        {priorityFocusTasks.length === 0 ? (
                          <div style={{ padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                            <Target size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                            <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No urgent or high priority tasks</p>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {priorityFocusTasks.map(task => {
                              const stageMap: Record<string, { color: string; bg: string; label: string }> = {
                                'Assigned':    { color: '#64748B', bg: '#F1F5F9', label: 'Assigned' },
                                'In Progress': { color: '#4F46E5', bg: '#EEF2FF', label: 'In Progress' },
                                'Review':      { color: '#D97706', bg: '#FFFBEB', label: 'Review' },
                                'Complete':    { color: '#059669', bg: '#ECFDF5', label: 'Complete' },
                              }
                              const stage = stageMap[task.status ?? 'Assigned'] ?? stageMap['Assigned']
                              const { color: stageColor, bg: stageBg, label: stageLabel } = stage
                              const isComplete = task.status === 'Complete'
                              const isExpanded = expandedTaskId === task.id
                              const pStyle = task.priority === 'Urgent'
                                ? { bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA' }
                                : { bg: '#FFEDD5', color: '#C2410C', border: '#FDBA74' }
                              return (
                                <div
                                  key={task.id}
                                  className="task-item"
                                  style={{ borderRadius: 12, border: '1px solid #EBEBEB', padding: '10px 12px', background: '#FAFAFA', cursor: 'pointer' }}
                                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {/* Priority badge */}
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 60, height: 24, borderRadius: 8, fontSize: 11, fontWeight: 700, background: pStyle.bg, color: pStyle.color, border: `1px solid ${pStyle.border}` }}>
                                      {task.priority}
                                    </span>
                                    {/* Title */}
                                    <span style={{ fontSize: 12, fontWeight: 600, color: isComplete ? '#94A3B8' : '#0F172A', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isComplete ? 'line-through' : 'none' }}>
                                      {task.title}
                                    </span>
                                    {/* Assignee */}
                                    {task.assignee_name && (
                                      <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', flexShrink: 0 }}>{task.assignee_name}</span>
                                    )}
                                    {/* Status badge */}
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, minWidth: 76, height: 24, borderRadius: 999, fontSize: 11, fontWeight: 600, background: stageBg, color: stageColor }}>
                                      {stageLabel}
                                    </span>
                                  </div>
                                  {isExpanded && task.assignee_name && task.assigned_user_id && (
                                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          router.push(`/owner/communication?tab=messages&partner_id=${task.assigned_user_id}&prefill=${encodeURIComponent(`Regarding: "${task.title}"`)}`)
                                        }}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', padding: '5px 10px', fontSize: 11, color: '#64748B', cursor: 'pointer' }}
                                      >
                                        <MessageCircle size={11} />
                                        Send Message
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                    )} {/* end focus */}

                    {/* ── Team content ── */}
                    {panelId === 'team' && (
                    <div style={{ }}>
                  {timelineLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}><Spinner size={16} dark /></div>
                  ) : todayShiftCount === 0 ? (
                    <div style={{ padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                      <Users size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No one is on shift today</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {Object.entries(teamByDept).map(([deptId, { name: deptName, rows }]) => (
                        <div key={deptId}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px 6px', borderBottom: '2px solid #374151', marginBottom: 2 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: deptColor(deptId), flexShrink: 0, display: 'inline-block' }} />
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>{deptName}</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 4px' }}>
                          {rows.map((row, i) => (
                            <div
                              key={`${row.user_id}_${i}`}
                              data-testid="team-member-row"
                              className="team-row"
                              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 10, minWidth: 0 }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: row.role === 'Manager' ? '#FFF7ED' : '#F3F4F6', color: row.role === 'Manager' ? '#EA580C' : '#4B5563', borderRadius: 999 }}>
                                {row.role === 'Manager' ? <UserCog size={13} /> : <UserRound size={13} />}
                              </div>
                              <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{row.full_name}</p>
                              <button
                                onClick={() => router.push(`/owner/communication?tab=messages&partner_id=${row.user_id}`)}
                                aria-label={`Message ${row.full_name}`}
                                className="msg-btn"
                                style={{ flexShrink: 0, cursor: 'pointer', background: 'transparent', border: 'none', padding: 4, borderRadius: 6, color: '#CBD5E1', transition: 'color 0.15s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#F97316' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#CBD5E1' }}
                              >
                                <MessageCircle size={14} />
                              </button>
                            </div>
                          ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                    )} {/* end team */}

                    {/* ── Activity content ── */}
                    {panelId === 'activity' && (
                    <div style={{ }}>
                    {activityFeedLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner size={16} dark /></div>
                    ) : activityFeed.length === 0 ? (
                      <div style={{ padding: '32px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                        <Activity size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                        <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No activity yet today</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {activityFeed.map((event) => {
                          const statusColors: Record<string, { dot: string; bg: string }> = {
                            'In Progress': { dot: '#4F46E5', bg: '#EEF2FF' },
                            'Review':      { dot: '#D97706', bg: '#FFFBEB' },
                            'Complete':    { dot: '#059669', bg: '#ECFDF5' },
                          }
                          const matchedStatus = Object.keys(statusColors).find(s => event.description.endsWith(s))
                          const { dot: dotColor, bg: dotBg } = statusColors[matchedStatus ?? ''] ?? { dot: '#4F46E5', bg: '#EEF2FF' }
                          const key = feedKey(event)
                          const isMarked = markedFeedItems.has(key)
                          return (
                            <div key={key} className="feed-item" style={{ borderRadius: 14, border: `1px solid ${isMarked ? '#F1F5F9' : '#F1F5F9'}`, background: isMarked ? '#FAFAFA' : '#fff', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: isMarked ? '#F1F5F9' : dotBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <div style={{ width: 7, height: 7, borderRadius: 999, background: isMarked ? '#CBD5E1' : dotColor }} />
                                </div>
                                <p style={{ margin: 0, fontSize: 12, color: isMarked ? '#94A3B8' : '#334155', lineHeight: 1.5, flex: 1 }}>{event.description}</p>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>{timeAgo(event.timestamp)}</span>
                                <button
                                  type="button"
                                  className="mark-btn"
                                  onClick={() => setMarkedFeedItems(prev => new Set(prev).add(key))}
                                  style={{ cursor: isMarked ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: 70, height: 24, borderRadius: 999, border: isMarked ? '1px solid #BBF7D0' : '1px solid #E2E8F0', background: isMarked ? '#F0FDF4' : '#F8FAFC', color: isMarked ? '#16A34A' : '#64748B', fontSize: 11, fontWeight: 600 }}
                                >
                                  <CheckCheck size={11} />
                                  {isMarked ? 'Done' : 'Mark'}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    </div>
                    )} {/* end activity */}

                    {/* ── Tasks content ── */}
                    {panelId === 'tasks' && (
                    <div style={{ }}>
                    {taskStatsLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner size={16} dark /></div>
                    ) : todayTasks.length === 0 ? (
                      <div style={{ padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                        <ClipboardList size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                        <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No tasks assigned today</p>
                      </div>
                    ) : (() => {
                        const medLowTasks = todayTasks.filter(t => t.priority === 'Medium' || t.priority === 'Low')
                        const pMap: Record<string, { bg: string; color: string; border: string }> = {
                          Medium: { bg: '#FEF9C3', color: '#A16207', border: '#FDE047' },
                          Low:    { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' },
                        }
                        const sMap: Record<string, { bg: string; color: string }> = {
                          'Assigned':    { bg: '#F1F5F9', color: '#64748B' },
                          'In Progress': { bg: '#EEF2FF', color: '#4F46E5' },
                          'Review':      { bg: '#FFFBEB', color: '#D97706' },
                          'Complete':    { bg: '#ECFDF5', color: '#059669' },
                        }
                        if (medLowTasks.length === 0) return (
                          <div style={{ padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                            <ClipboardList size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                            <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No medium or low priority tasks</p>
                          </div>
                        )
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {medLowTasks.map(task => {
                              const isExpanded = expandedTaskId === task.id
                              const ps = pMap[task.priority ?? ''] ?? { bg: '#F3F4F6', color: '#9CA3AF', border: '#E5E7EB' }
                              const sc = sMap[task.status ?? 'Assigned'] ?? sMap['Assigned']
                              return (
                                <div
                                  key={task.id}
                                  data-testid="task-list-item"
                                  className="task-item"
                                  style={{ borderRadius: 12, border: '1px solid #EBEBEB', background: '#FAFAFA', padding: '10px 12px', cursor: 'pointer' }}
                                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {/* Priority badge */}
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 60, height: 24, borderRadius: 8, fontSize: 11, fontWeight: 700, background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>
                                      {task.priority}
                                    </span>
                                    {/* Title */}
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {task.title}
                                    </span>
                                    {/* Assignee */}
                                    {task.assignee_name && (
                                      <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', flexShrink: 0 }}>{task.assignee_name}</span>
                                    )}
                                    {/* Status badge */}
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, minWidth: 76, height: 24, borderRadius: 999, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
                                      {task.status ?? 'Assigned'}
                                    </span>
                                  </div>
                                  {isExpanded && (
                                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (task.assigned_user_id) {
                                            router.push(`/owner/communication?tab=messages&partner_id=${task.assigned_user_id}&prefill=${encodeURIComponent(`Regarding: "${task.title}"`)}`)
                                          }
                                        }}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', padding: '5px 10px', fontSize: 11, color: '#64748B', cursor: 'pointer' }}
                                      >
                                        <MessageCircle size={11} />
                                        Send Message
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                    )} {/* end tasks */}

                  </div>
                  )
                })}

                {/* Floating ghost that follows cursor during panel drag */}
                {panelDrag && (() => {
                  const labels: Record<PanelId, string> = { focus: 'Focus', team: 'Team', activity: 'Live Feed', tasks: 'Tasks' }
                  return (
                    <div style={{
                      position: 'fixed',
                      left: panelDrag.ghostX - 60,
                      top: 80,
                      background: '#F97316',
                      color: '#fff',
                      padding: '8px 18px',
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      pointerEvents: 'none',
                      zIndex: 9999,
                      boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
                      opacity: 0.92,
                      whiteSpace: 'nowrap',
                    }}>
                      {labels[panelDrag.panelId]}
                    </div>
                  )
                })()}

              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── REMOVAL OVERLAY ───────────────────────────────────────── */}
      {removalOverlay && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl px-12 py-10 shadow-2xl max-w-md text-center">
            <h2 className="text-base font-bold text-gray-900 mb-2.5">You have been removed</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">
              You were removed from <strong className="text-gray-900">{removalOverlay.companyName}</strong>. Switching to your other company…
            </p>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full w-full rounded-full bg-orange-500 transition-all duration-200" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
