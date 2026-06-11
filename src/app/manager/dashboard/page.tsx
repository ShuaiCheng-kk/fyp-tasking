'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, Users, UserRound, ClipboardList,
  Timer, Eye, CheckCircle, UserCog,
  CalendarDays, MoreHorizontal, Check, SlidersHorizontal,
  Activity, MessageCircle, CheckCheck, Target,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import ManagerSidebar from '@/components/ManagerSidebar'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type TaskItem = {
  id: string
  title: string
  status: string
  priority?: string | null
  percentage_complete?: number
  assignee_name?: string
  assigned_user_id?: string | null
  department_id?: string
  updated_at?: string
  created_at?: string
}

type ActivityFeedEvent = {
  id: string
  actor_name: string
  description: string
  status: string
  timestamp: string
}

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

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

function formatHourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return '12am'
  if (hour === 12) return '12pm'
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}

function roleRank(role: string): number {
  if (role === 'Manager') return 0
  if (role === 'Employee') return 1
  return 2
}

function sortRowsByRole(rows: TimelineRow[]): TimelineRow[] {
  return [...rows].sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.full_name.localeCompare(b.full_name))
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const BLUE = '#2563EB'
const APP_BG = '#F1F5F9'
const PANEL = '#FFFFFF'
const BORDER = '#E5E7EB'

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

type Department = { department_id: string; department_name: string }
type Member = { id: string; full_name: string; email_address: string; role: string; department_id: string | null }

export default function ManagerDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)

  const [managerId, setManagerId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [primaryDeptId, setPrimaryDeptId] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false)
  const deptDropdownRef = useRef<HTMLDivElement>(null)

  const [allMembers, setAllMembers] = useState<Member[]>([])

  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  // Stats
  const [statsLoading, setStatsLoading] = useState(true)

  // Timeline
  const [timelineRows, setTimelineRows] = useState<TimelineRow[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timeFrom, setTimeFrom] = useState(7)
  const [timeTo, setTimeTo] = useState(23)
  const [isAutoFit, setIsAutoFit] = useState(false)
  const [staffOnShift, setStaffOnShift] = useState(0)
  const [casualOnShift, setCasualOnShift] = useState(0)
  const [totalTasks, setTotalTasks] = useState(0)
  const [tasksInProgress, setTasksInProgress] = useState(0)
  const [tasksInReview, setTasksInReview] = useState(0)
  const [tasksComplete, setTasksComplete] = useState(0)

  // Panels (Focus / Team / Live Feed / Tasks)
  const [deptTasks, setDeptTasks] = useState<TaskItem[]>([])
  const [deptTasksLoading, setDeptTasksLoading] = useState(false)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [markedFeedItems, setMarkedFeedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
        setDeptDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let userId = localStorage.getItem('tasking_user_id')
      if (!userId) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          userId = session.user.id
          localStorage.setItem('tasking_user_id', userId)
        }
      }
      if (!userId) { router.replace('/signin'); return }

      const meRes = await fetch(`/api/user/me?user_id=${userId}`)
      const meData = await meRes.json()
      if (cancelled) return
      if (!meData.success) { router.replace('/signin'); return }

      const { id: internalId, full_name, company_id, department_id } = meData.user
      if (full_name) setUserName(full_name)
      if (internalId) setManagerId(internalId)
      if (department_id) setPrimaryDeptId(department_id)

      if (!company_id) { setLoading(false); return }
      setCompanyId(company_id)
      localStorage.setItem(`tasking_company_id_${userId}`, company_id)

      // 1. Fetch company info + manager departments in parallel
      const [compRes, deptRes] = await Promise.all([
        fetch(`/api/company/current?user_id=${userId}&company_id=${company_id}`),
        fetch(`/api/manager/departments?manager_id=${internalId}&company_id=${company_id}`),
      ])
      const compData = await compRes.json()
      const deptData = await deptRes.json()
      if (cancelled) return

      if (compData.success && compData.company?.name) setCompanyName(compData.company.name)

      let activeDeptId = ''
      if (deptData.success && deptData.departments.length > 0) {
        setDepartments(deptData.departments)
        activeDeptId = deptData.departments[0].department_id
        setSelectedDeptId(activeDeptId)
      } else if (department_id) {
        // fallback: resolve dept name from company departments
        const allDeptsRes = await fetch(`/api/company/departments?company_id=${company_id}`)
        const allDeptsData = await allDeptsRes.json()
        if (!cancelled && allDeptsData.success) {
          const match = allDeptsData.departments.find((d: { id: string; name: string }) => d.id === department_id)
          if (match) {
            setDepartments([{ department_id: match.id, department_name: match.name }])
            activeDeptId = match.id
            setSelectedDeptId(match.id)
          }
        }
      }

      // 2. Fetch members scoped to the department (after we know the dept id)
      if (activeDeptId) {
        const empRes = await fetch(`/api/team/members?company_id=${company_id}&department_id=${activeDeptId}`)
        const empData = await empRes.json()
        if (!cancelled && empData.success) setAllMembers(empData.members as Member[])
      }

      if (!cancelled) setLoading(false)

      // Fetch stats
      const today = new Date().toISOString().slice(0, 10)
      setStatsLoading(true)
      try {
        const [shiftRes, taskRes] = await Promise.all([
          fetch(`/api/shift?company_id=${company_id}&date_from=${today}&date_to=${today}`),
          fetch(`/api/task?company_id=${company_id}&stats=true`),
        ])
        const shiftData = await shiftRes.json()
        const taskData = await taskRes.json()
        if (cancelled) return

        if (shiftData.success && Array.isArray(shiftData.rows)) {
          // Each row is a TimelineRow with role + shifts[]; filter to this dept
          type TRow = { role: string; department_id: string; shifts: unknown[] }
          const deptRows = (shiftData.rows as TRow[]).filter(
            r => r.department_id === activeDeptId && r.shifts.length > 0
          )
          setStaffOnShift(deptRows.filter(r => r.role === 'Employee').length)
          setCasualOnShift(deptRows.filter(r => r.role === 'Casual Worker').length)
        }
        if (taskData.success && taskData.stats) {
          const s = taskData.stats
          setTasksInProgress(s.inProgress ?? 0)
          setTasksInReview(s.review ?? 0)
          setTasksComplete(s.complete ?? 0)
          setTotalTasks((s.assigned ?? 0) + (s.inProgress ?? 0) + (s.review ?? 0) + (s.complete ?? 0))
        }
      } catch {}
      if (!cancelled) { setStatsLoading(false); setLastRefreshed(new Date()) }

      // Fetch dept-scoped tasks for panels
      if (activeDeptId) {
        setDeptTasksLoading(true)
        try {
          const taskRes = await fetch(`/api/task?company_id=${company_id}&department_id=${activeDeptId}`)
          const taskData = await taskRes.json()
          if (!cancelled && taskData.success) setDeptTasks(taskData.tasks ?? [])
        } catch {}
        if (!cancelled) setDeptTasksLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  // Re-fetch members + dept tasks when manager switches department
  useEffect(() => {
    if (!companyId || !selectedDeptId || loading) return
    let cancelled = false
    fetch(`/api/team/members?company_id=${companyId}&department_id=${selectedDeptId}`)
      .then(r => r.json())
      .then(d => { if (!cancelled && d.success) setAllMembers(d.members as Member[]) })
      .catch(() => {})

    setDeptTasksLoading(true)
    fetch(`/api/task?company_id=${companyId}&department_id=${selectedDeptId}`)
      .then(r => r.json())
      .then(d => { if (!cancelled && d.success) setDeptTasks(d.tasks ?? []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDeptTasksLoading(false) })

    return () => { cancelled = true }
  }, [selectedDeptId, companyId, loading])

  const selectedDeptName = departments.find(d => d.department_id === selectedDeptId)?.department_name ?? ''

  // Timeline fetch — re-runs whenever dept changes
  const fetchTimeline = useCallback(async (cid: string, deptId: string) => {
    if (!cid || !deptId) return
    setTimelineLoading(true)
    try {
      const today = formatDateKey(new Date())
      const res = await fetch(`/api/shift?company_id=${cid}&date_from=${today}&date_to=${today}`)
      const data = await res.json()
      if (data.success) {
        const deptRows = (data.rows as TimelineRow[]).filter(
          r => r.department_id === deptId && r.user_id !== null
        )
        setTimelineRows(sortRowsByRole(deptRows))
      }
    } catch {}
    finally { setTimelineLoading(false) }
  }, [])

  useEffect(() => {
    if (!companyId || !selectedDeptId) return
    void fetchTimeline(companyId, selectedDeptId)
  }, [companyId, selectedDeptId, fetchTimeline])

  // ── Derived panel data ────────────────────────────────────────────────────────
  function priorityRank(p?: string | null) {
    if (p === 'Urgent') return 0; if (p === 'High') return 1
    if (p === 'Medium') return 2; if (p === 'Low') return 3; return 4
  }

  const sortedTasks = [...deptTasks].sort((a, b) => {
    const byP = priorityRank(a.priority) - priorityRank(b.priority)
    return byP !== 0 ? byP : new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  })

  const priorityFocusTasks = sortedTasks
    .filter(t => t.priority === 'Urgent' || t.priority === 'High')
    .sort((a, b) => {
      if (a.status === 'Complete' && b.status !== 'Complete') return 1
      if (a.status !== 'Complete' && b.status === 'Complete') return -1
      return priorityRank(a.priority) - priorityRank(b.priority)
    })

  const focusAssigned    = priorityFocusTasks.filter(t => t.status === 'Assigned' || !t.status).length
  const focusInProgress  = priorityFocusTasks.filter(t => t.status === 'In Progress').length
  const focusReview      = priorityFocusTasks.filter(t => t.status === 'Review').length
  const focusComplete    = priorityFocusTasks.filter(t => t.status === 'Complete').length

  const focusDonutSegs = (() => {
    const total = priorityFocusTasks.length
    const raw = [
      { count: focusAssigned,   color: '#94A3B8', label: 'Assigned' },
      { count: focusInProgress, color: '#4F46E5', label: 'In Progress' },
      { count: focusReview,     color: '#D97706', label: 'Review' },
      { count: focusComplete,   color: '#059669', label: 'Complete' },
    ]
    let cum = 0
    return raw.map(seg => {
      const frac = total > 0 ? seg.count / total : 0
      const start = cum; cum += frac
      return { ...seg, frac, start }
    })
  })()

  const activityFeed: ActivityFeedEvent[] = [...deptTasks]
    .filter(t => t.status !== 'Assigned' && t.updated_at)
    .sort((a, b) => new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime())
    .slice(0, 20)
    .map(t => ({
      id: `task_${t.id}`,
      actor_name: t.assignee_name ?? 'Team member',
      description: `${t.assignee_name ?? 'Team member'} moved "${t.title}" to ${t.status}`,
      status: t.status,
      timestamp: t.updated_at!,
    }))

  // Team on shift today scoped to this dept
  const deptTeamRows = timelineRows.filter(r => r.shifts.length > 0)

  // ── Timeline rendering helpers ──────────────────────────────────────────────
  const PERSON_COL = 180
  const ROW_H = 58
  const TIMELINE_PAD_PCT = 4

  const activeRows = timelineRows.filter(r => r.shifts.length > 0)

  const autoFrom = activeRows.length > 0
    ? Math.max(0, Math.floor(Math.min(...activeRows.flatMap(r => r.shifts.map(s => timeToMinutes(s.start_time)))) / 60) - 1)
    : 7
  const autoTo = activeRows.length > 0
    ? Math.min(24, Math.ceil(Math.max(...activeRows.flatMap(r => r.shifts.map(s => timeToMinutes(s.end_time)))) / 60) + 1)
    : 23

  const hourTicks: number[] = []
  for (let h = timeFrom; h <= timeTo; h++) hourTicks.push(h)

  function positionForTime(minutes: number): number {
    const start = timeFrom * 60
    const end = timeTo * 60
    return ((Math.max(start, Math.min(end, minutes)) - start) / Math.max(end - start, 1)) * 100
  }

  function positionForTimeWithPad(minutes: number): number {
    const raw = positionForTime(minutes)
    return TIMELINE_PAD_PCT + (raw / 100) * (100 - TIMELINE_PAD_PCT * 2)
  }

  function renderHourAxis() {
    return (
      <div style={{ display: 'flex', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', borderRadius: '12px 12px 0 0' }}>
        <div style={{ width: 8 + PERSON_COL, flexShrink: 0 }} />
        <div style={{ position: 'relative', height: 36, flex: 1 }}>
          {hourTicks.map(h => (
            <div key={h} style={{ position: 'absolute', top: 0, left: `${positionForTimeWithPad(h * 60)}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', pointerEvents: 'none' }}>
              <span style={{ display: 'block', marginTop: 9, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', userSelect: 'none', letterSpacing: '0.02em' }}>
                {formatHourLabel(h)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

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
    const deptOrder: string[] = []
    const deptMap: Record<string, { name: string; rows: TimelineRow[] }> = {}
    for (const row of rows) {
      if (!deptMap[row.department_id]) {
        deptOrder.push(row.department_id)
        deptMap[row.department_id] = { name: row.department_name, rows: [] }
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
              <div key={`${row.user_id ?? row.department_id}_${rowIdx}`} style={{ display: 'flex', height: ROW_H, borderTop: isDeptBoundary ? EDGE : 'none', background: '#FFFFFF' }}>
                <div style={{ width: PERSON_COL, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: row.role === 'Manager' ? '#EFF6FF' : '#F3F4F6', color: row.role === 'Manager' ? BLUE : '#4B5563', borderRadius: 999 }}>
                      {row.role === 'Manager' ? <UserCog size={13} /> : <UserRound size={13} />}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.full_name}
                    </span>
                  </div>
                </div>
                <div style={{ position: 'relative', flex: 1 }}>
                  {hourTicks.map(h => (
                    <div key={`grid-${h}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${positionForTimeWithPad(h * 60)}%`, width: 0, borderLeft: '1px solid rgba(15,23,42,0.12)', pointerEvents: 'none', zIndex: 2 }} />
                  ))}
                  {row.shifts.map((shift: TimelineShiftBlock) => {
                    const startMin = timeToMinutes(shift.start_time)
                    const endMin = timeToMinutes(shift.end_time)
                    if (endMin <= segStart || startMin >= segEnd) return null
                    const left = positionForTimeWithPad(startMin)
                    const right = positionForTimeWithPad(endMin)
                    const width = right - left
                    if (width <= 0) return null
                    return (
                      <div key={shift.id} style={{ position: 'absolute', top: 10, bottom: 10, left: `${left}%`, width: `${Math.max(width, 1.5)}%`, borderRadius: 999, background: BLUE, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none', padding: '0 10px' }}>
                          {formatShiftHour(shift.start_time)} – {formatShiftHour(shift.end_time)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        })}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: APP_BG, fontFamily: 'inherit' }}>
      <style>{`
        @keyframes dotPulse {
          0% { opacity: 1; transform: scale(1); }
          60% { opacity: 0.4; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }
        .stat-card { transition: box-shadow 0.22s ease, transform 0.22s ease; }
        .stat-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.10), 0 0 0 1.5px rgba(37,99,235,0.18) !important; transform: translateY(-3px) scale(1.015); }
        .panel-card { transition: box-shadow 0.22s ease, transform 0.22s ease; }
        .panel-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.09), 0 0 0 1.5px rgba(0,0,0,0.07) !important; transform: translateY(-2px); }
        .feed-item { transition: background 0.15s ease, transform 0.15s ease; }
        .feed-item:hover { background: #F8FAFC !important; transform: translateX(2px); }
        .task-item { transition: background 0.15s ease, transform 0.15s ease; }
        .task-item:hover { background: #F8FAFC !important; transform: translateX(2px); }
        .team-row { transition: background 0.15s ease, transform 0.12s ease; }
        .team-row:hover { background: #EFF6FF !important; transform: translateX(2px); }

        .mark-btn { transition: background 0.15s ease, transform 0.12s ease; }
        .mark-btn:hover { transform: scale(1.05); }
        .msg-btn { transition: color 0.15s ease, transform 0.15s ease; }
        .msg-btn:hover { transform: scale(1.18); }
      `}</style>
      <ManagerSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '20px 28px', gap: 0 }}>
        {/* Page header */}
        <div style={{ marginBottom: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: BLUE, marginBottom: 4 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              {selectedDeptName ? `Today's Overview · ${selectedDeptName}` : "Today's Overview"}
            </h1>
            {!loading && departments.length > 1 && (
              <div ref={deptDropdownRef} style={{ position: 'relative', display: 'inline-block', marginTop: 8 }}>
                <button
                  onClick={() => setDeptDropdownOpen(o => !o)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 999, padding: '3px 10px 3px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: BLUE }}
                >
                  {selectedDeptName || 'All Departments'}
                  <ChevronDown size={12} style={{ transition: 'transform 0.15s', transform: deptDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                </button>
                {deptDropdownOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 200, zIndex: 50, overflow: 'hidden' }}>
                    {departments.map(d => (
                      <button key={d.department_id} type="button"
                        onClick={() => { setSelectedDeptId(d.department_id); setDeptDropdownOpen(false) }}
                        style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: d.department_id === selectedDeptId ? '#EFF6FF' : 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: d.department_id === selectedDeptId ? BLUE : '#374151', fontWeight: d.department_id === selectedDeptId ? 600 : 400, transition: 'background 0.1s' }}
                        onMouseEnter={e => { if (d.department_id !== selectedDeptId) e.currentTarget.style.background = '#F3F4F6' }}
                        onMouseLeave={e => { if (d.department_id !== selectedDeptId) e.currentTarget.style.background = 'none' }}
                      >
                        {d.department_name}{d.department_id === primaryDeptId ? ' (Primary)' : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {userName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#1E3A5F', color: '#FFFFFF', flexShrink: 0 }}>
                  <UserCog size={13} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{userName}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF' }}>
              <Spinner dark /> Loading…
            </div>
          ) : (
            <>
              {/* Updated chip */}
              {lastRefreshed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, marginBottom: -8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', flexShrink: 0, display: 'inline-block', animation: 'dotPulse 1.4s ease-out infinite', marginLeft: 5 }} />
                  <span style={{ fontSize: 10, fontWeight: 500, color: '#94A3B8', letterSpacing: '0.03em' }}>
                    Updated {timeAgo(lastRefreshed.toISOString())}
                  </span>
                </div>
              )}
              {/* Stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 14, flexShrink: 0 }}>
                {[
                  { label: 'Staff on Shift',    value: statsLoading ? null : staffOnShift,    icon: <Users size={16} style={{ color: '#2563EB' }} />,    accentBg: '#EFF6FF' },
                  { label: 'Casual Workers',    value: statsLoading ? null : casualOnShift,   icon: <UserRound size={16} style={{ color: '#EC4899' }} />, accentBg: '#FDF2F8' },
                  { label: 'Total Tasks',       value: statsLoading ? null : totalTasks,      icon: <ClipboardList size={16} style={{ color: '#3B82F6' }} />, accentBg: '#EFF6FF' },
                  { label: 'Tasks In Progress', value: statsLoading ? null : tasksInProgress, icon: <Timer size={16} style={{ color: '#8B5CF6' }} />,     accentBg: '#F5F3FF' },
                  { label: 'Tasks In Review',   value: statsLoading ? null : tasksInReview,   icon: <Eye size={16} style={{ color: '#F59E0B' }} />,       accentBg: '#FFFBEB' },
                  { label: 'Tasks Complete',    value: statsLoading ? null : tasksComplete,   icon: <CheckCircle size={16} style={{ color: '#10B981' }} />, accentBg: '#ECFDF5' },
                ].map(card => (
                  <article key={card.label} style={{
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
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: card.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {card.icon}
                      </div>
                    </div>
                    <p style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1, margin: 0, letterSpacing: '-0.5px' }}>
                      {card.value === null ? <Spinner size={14} dark /> : card.value.toLocaleString()}
                    </p>
                  </article>
                ))}
              </div>

              {/* Department Schedule Timeline */}
              <div className="panel-card" style={{ minWidth: 0, padding: '16px 20px', background: '#FFFFFF', borderRadius: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                {/* Timeline header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarDays size={16} style={{ color: BLUE }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
                      Schedule
                    </span>
                    {timelineLoading && <Spinner size={13} dark />}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label="Options"
                      style={{ display: 'flex', width: 36, height: 36, cursor: 'pointer', alignItems: 'center', justifyContent: 'center', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280' }}
                    >
                      <MoreHorizontal size={16} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={10} style={{ width: 280, borderRadius: 16, padding: 16, border: '1px solid #E5E7EB', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <SlidersHorizontal size={12} style={{ color: BLUE }} />
                        Time window
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                        {[
                          { label: 'Auto-fit', onClick: () => { setTimeFrom(autoFrom); setTimeTo(autoTo); setIsAutoFit(true) }, active: isAutoFit },
                          { label: 'Full day', onClick: () => { setTimeFrom(0); setTimeTo(24); setIsAutoFit(false) }, active: !isAutoFit && timeFrom === 0 && timeTo === 24 },
                        ].map(opt => (
                          <button key={opt.label} type="button" onClick={opt.onClick} style={{ cursor: 'pointer', borderRadius: 10, border: opt.active ? `1.5px solid ${BLUE}44` : '1px solid #E5E7EB', background: opt.active ? '#EFF6FF' : '#F9FAFB', padding: '8px 6px', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: opt.active ? BLUE : '#374151' }}>{opt.label}</p>
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {[
                          { label: 'From', val: timeFrom, dec: () => { setIsAutoFit(false); setTimeFrom(Math.max(0, timeFrom - 1)) }, inc: () => { setIsAutoFit(false); setTimeFrom(Math.min(timeTo - 1, timeFrom + 1)) } },
                          { label: 'To', val: timeTo, dec: () => { setIsAutoFit(false); setTimeTo(Math.max(timeFrom + 1, timeTo - 1)) }, inc: () => { setIsAutoFit(false); setTimeTo(Math.min(24, timeTo + 1)) } },
                        ].map(ctrl => (
                          <div key={ctrl.label} style={{ borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB', padding: '8px 10px' }}>
                            <p style={{ margin: '0 0 6px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>{ctrl.label}</p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                              <button type="button" onClick={ctrl.dec} style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{formatHourLabel(ctrl.val)}</span>
                              <button type="button" onClick={ctrl.inc} style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Timeline grid */}
                {timelineLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Spinner size={20} dark /></div>
                ) : activeRows.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                    <CalendarDays size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No shifts scheduled today</p>
                  </div>
                ) : (
                  <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                    {renderHourAxis()}
                    {renderTimelineContent(activeRows)}
                  </div>
                )}

              </div>

              {/* ── ROW 3: Focus | Team | Live Feed | Tasks ─── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>

                {/* ── Focus ── */}
                <div className="panel-card" style={{ background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Target size={15} style={{ color: BLUE }} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px' }}>Focus</span>
                    </div>
                  </div>
                  <div style={{ }}>
                    {deptTasksLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner size={20} dark /></div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Donut */}
                        {(() => {
                          const total = priorityFocusTasks.length
                          const RM = 55, SW = 16, CX = 80, CY = 80
                          const C = 2 * Math.PI * RM
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                              <div style={{ flexShrink: 0 }}>
                                <svg width={160} height={160} viewBox="0 0 160 160">
                                  {total === 0 ? (
                                    <circle cx={CX} cy={CY} r={RM} fill="none" stroke="#F3F4F6" strokeWidth={SW} />
                                  ) : focusDonutSegs.map((seg, i) => {
                                    if (seg.count === 0) return null
                                    return (
                                      <circle key={i} cx={CX} cy={CY} r={RM} fill="none" stroke={seg.color} strokeWidth={SW}
                                        strokeDasharray={`${seg.frac * C} ${C}`}
                                        transform={`rotate(${-90 + seg.start * 360} ${CX} ${CY})`}
                                        strokeLinecap="butt"
                                      />
                                    )
                                  })}
                                  <text x={CX} y={CY - 10} textAnchor="middle" dominantBaseline="middle" fill="#0F172A" fontSize="24" fontWeight="800" fontFamily="inherit">{total}</text>
                                  <text x={CX} y={CY + 12} textAnchor="middle" dominantBaseline="middle" fill="#94A3B8" fontSize="11" fontWeight="500" fontFamily="inherit">tasks</text>
                                </svg>
                              </div>
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
                        {priorityFocusTasks.length === 0 ? (
                          <div style={{ padding: '24px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                            <Target size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                            <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No urgent or high priority tasks</p>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {priorityFocusTasks.map(task => {
                              const stageMap: Record<string, { color: string; bg: string }> = {
                                'Assigned':    { color: '#64748B', bg: '#F1F5F9' },
                                'In Progress': { color: '#4F46E5', bg: '#EEF2FF' },
                                'Review':      { color: '#D97706', bg: '#FFFBEB' },
                                'Complete':    { color: '#059669', bg: '#ECFDF5' },
                              }
                              const stage = stageMap[task.status ?? 'Assigned'] ?? stageMap['Assigned']
                              const isComplete = task.status === 'Complete'
                              const isExpanded = expandedTaskId === task.id
                              const pStyle = task.priority === 'Urgent'
                                ? { bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA' }
                                : { bg: '#FFEDD5', color: '#C2410C', border: '#FDBA74' }
                              return (
                                <div key={task.id} className="task-item"
                                  style={{ borderRadius: 12, border: '1px solid #EBEBEB', padding: '10px 12px', background: '#FAFAFA', cursor: 'pointer' }}
                                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 60, height: 24, borderRadius: 8, fontSize: 11, fontWeight: 700, background: pStyle.bg, color: pStyle.color, border: `1px solid ${pStyle.border}` }}>{task.priority}</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: isComplete ? '#94A3B8' : '#0F172A', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isComplete ? 'line-through' : 'none' }}>{task.title}</span>
                                    {task.assignee_name && <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', flexShrink: 0 }}>{task.assignee_name}</span>}
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, minWidth: 76, height: 24, borderRadius: 999, fontSize: 11, fontWeight: 600, background: stage.bg, color: stage.color }}>{task.status ?? 'Assigned'}</span>
                                  </div>
                                  {isExpanded && task.assigned_user_id && (
                                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
                                      <button type="button" onClick={e => { e.stopPropagation(); router.push(`/manager/communication?tab=messages&partner_id=${task.assigned_user_id}&prefill=${encodeURIComponent(`Regarding: "${task.title}"`)}`) }}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', padding: '5px 10px', fontSize: 11, color: '#64748B', cursor: 'pointer' }}>
                                        <MessageCircle size={11} /> Send Message
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
                </div>

                {/* ── Team ── */}
                <div className="panel-card" style={{ background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={15} style={{ color: BLUE }} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px' }}>Team</span>
                    </div>
                  </div>
                  <div style={{ }}>
                    {timelineLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}><Spinner size={16} dark /></div>
                    ) : deptTeamRows.length === 0 ? (
                      <div style={{ padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                        <Users size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                        <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No one is on shift today</p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 4px' }}>
                        {deptTeamRows.map((row, i) => (
                          <div key={`${row.user_id}_${i}`} className="team-row"
                            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 10, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: row.role === 'Manager' ? '#EFF6FF' : '#F3F4F6', color: row.role === 'Manager' ? BLUE : '#4B5563', borderRadius: 999 }}>
                              {row.role === 'Manager' ? <UserCog size={13} /> : <UserRound size={13} />}
                            </div>
                            <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{row.full_name}</p>
                            <button onClick={() => router.push(`/manager/communication?tab=messages&partner_id=${row.user_id}`)}
                              aria-label={`Message ${row.full_name}`} className="msg-btn"
                              style={{ flexShrink: 0, cursor: 'pointer', background: 'transparent', border: 'none', padding: 4, borderRadius: 6, color: '#CBD5E1' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = BLUE }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#CBD5E1' }}>
                              <MessageCircle size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Live Feed ── */}
                <div className="panel-card" style={{ background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Activity size={15} style={{ color: BLUE }} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px' }}>Live Feed</span>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'dotPulse 1.4s ease-out infinite' }} />
                    </div>
                    {activityFeed.length > 0 && (
                      <button type="button" className="mark-btn"
                        onClick={() => setMarkedFeedItems(new Set(activityFeed.map(e => e.id)))}
                        style={{ cursor: 'pointer', borderRadius: 999, border: '1px solid #E2E8F0', background: '#fff', padding: '5px 14px', fontSize: 11, fontWeight: 600, color: '#64748B' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div style={{ }}>
                    {deptTasksLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner size={16} dark /></div>
                    ) : activityFeed.length === 0 ? (
                      <div style={{ padding: '32px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                        <Activity size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                        <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No activity yet today</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {activityFeed.map(event => {
                          const statusColors: Record<string, { dot: string; bg: string }> = {
                            'In Progress': { dot: '#4F46E5', bg: '#EEF2FF' },
                            'Review':      { dot: '#D97706', bg: '#FFFBEB' },
                            'Complete':    { dot: '#059669', bg: '#ECFDF5' },
                          }
                          const { dot: dotColor, bg: dotBg } = statusColors[event.status] ?? { dot: '#4F46E5', bg: '#EEF2FF' }
                          const isMarked = markedFeedItems.has(event.id)
                          return (
                            <div key={event.id} className="feed-item"
                              style={{ borderRadius: 14, border: '1px solid #F1F5F9', background: isMarked ? '#FAFAFA' : '#fff', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: isMarked ? '#F1F5F9' : dotBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <div style={{ width: 7, height: 7, borderRadius: 999, background: isMarked ? '#CBD5E1' : dotColor }} />
                                </div>
                                <p style={{ margin: 0, fontSize: 12, color: isMarked ? '#94A3B8' : '#334155', lineHeight: 1.5, flex: 1 }}>{event.description}</p>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>{timeAgo(event.timestamp)}</span>
                                <button type="button" className="mark-btn"
                                  onClick={() => setMarkedFeedItems(prev => new Set(prev).add(event.id))}
                                  style={{ cursor: isMarked ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: 70, height: 24, borderRadius: 999, border: isMarked ? '1px solid #BBF7D0' : '1px solid #E2E8F0', background: isMarked ? '#F0FDF4' : '#F8FAFC', color: isMarked ? '#16A34A' : '#64748B', fontSize: 11, fontWeight: 600 }}>
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
                </div>

                {/* ── Tasks ── */}
                <div className="panel-card" style={{ background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ClipboardList size={15} style={{ color: BLUE }} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px' }}>Tasks</span>
                    </div>
                  </div>
                  <div style={{ }}>
                    {deptTasksLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner size={16} dark /></div>
                    ) : sortedTasks.length === 0 ? (
                      <div style={{ padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                        <ClipboardList size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                        <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No tasks assigned yet</p>
                      </div>
                    ) : (() => {
                      const medLowTasks = sortedTasks.filter(t => t.priority === 'Medium' || t.priority === 'Low')
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
                              <div key={task.id} className="task-item"
                                style={{ borderRadius: 12, border: '1px solid #EBEBEB', background: '#FAFAFA', padding: '10px 12px', cursor: 'pointer' }}
                                onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 60, height: 24, borderRadius: 8, fontSize: 11, fontWeight: 700, background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>{task.priority}</span>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                                  {task.assignee_name && <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', flexShrink: 0 }}>{task.assignee_name}</span>}
                                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, minWidth: 76, height: 24, borderRadius: 999, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{task.status ?? 'Assigned'}</span>
                                </div>
                                {isExpanded && task.assigned_user_id && (
                                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
                                    <button type="button" onClick={e => { e.stopPropagation(); router.push(`/manager/communication?tab=messages&partner_id=${task.assigned_user_id}&prefill=${encodeURIComponent(`Regarding: "${task.title}"`)}`) }}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', padding: '5px 10px', fontSize: 11, color: '#64748B', cursor: 'pointer' }}>
                                      <MessageCircle size={11} /> Send Message
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
                </div>

              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
