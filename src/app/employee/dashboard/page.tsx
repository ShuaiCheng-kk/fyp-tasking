'use client'

import { Fragment, useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  UserRound, UserCog,
  CalendarDays, MoreHorizontal, SlidersHorizontal,
  ChevronLeft, ChevronRight, CheckCircle, Clock, Eye, Layers, AlertCircle,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import EmployeeSidebar from '@/components/EmployeeSidebar'
import { Task, KanbanGroup } from '@/types/Task'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const GREEN = '#16A34A'
const APP_BG = '#F1F5F9'
const PANEL = '#FFFFFF'
const BORDER = '#E5E7EB'

type Department = { id: string; name: string }
type Member = { id: string; full_name: string; role: string; department_id: string | null }
type ShiftOption = TimelineShiftBlock & {
  assignee_name: string
  user_id: string | null
  department_id: string
}

const COLUMNS: Task['status'][] = ['Assigned', 'In Progress', 'Review', 'Complete']
const PRIORITY_ORDER: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 }
const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Low:    { bg: '#F1F5F9', text: '#475569' },
  Medium: { bg: '#DBEAFE', text: '#1D4ED8' },
  High:   { bg: '#FFEDD5', text: '#C2410C' },
  Urgent: { bg: '#FEE2E2', text: '#B91C1C' },
}
const STATUS_CONFIG: Record<Task['status'], { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  'Assigned':    { label: 'Assigned',    color: '#475569', bg: '#E2E8F0', icon: <Layers size={13} /> },
  'In Progress': { label: 'In Progress', color: '#2563EB', bg: '#DBEAFE', icon: <Clock size={13} /> },
  'Review':      { label: 'Review',      color: '#EA580C', bg: '#FED7AA', icon: <Eye size={13} /> },
  'Complete':    { label: 'Complete',    color: GREEN, bg: '#BBF7D0', icon: <CheckCircle size={13} /> },
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function isDueOverdue(due: string): boolean {
  return new Date(due) < new Date()
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

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function sortRowsByRole(rows: TimelineRow[]): TimelineRow[] {
  const rank = (r: string) => r === 'Manager' ? 0 : r === 'Employee' ? 1 : 2
  return [...rows].sort((a, b) => rank(a.role) - rank(b.role) || a.full_name.localeCompare(b.full_name))
}

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export default function EmployeeDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [loading, setLoading] = useState(true)

  const [companyId, setCompanyId] = useState('')
  const [departmentId, setDepartmentId] = useState('')

  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Stats
  const [staffOnShift, setStaffOnShift] = useState(0)
  const [casualOnShift, setCasualOnShift] = useState(0)
  const [totalTasks, setTotalTasks] = useState(0)
  const [tasksInProgress, setTasksInProgress] = useState(0)
  const [tasksInReview, setTasksInReview] = useState(0)
  const [tasksComplete, setTasksComplete] = useState(0)

  // Timeline
  const [timelineRows, setTimelineRows] = useState<TimelineRow[]>([])
  const [calWeekRows, setCalWeekRows] = useState<TimelineRow[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineDate, setTimelineDate] = useState(() => formatDateKey(new Date()))
  const [shiftViewMode, setShiftViewMode] = useState<'timeline' | 'calendar'>('timeline')
  const [timeFrom, setTimeFrom] = useState(7)
  const [timeTo, setTimeTo] = useState(23)
  const [isAutoFit, setIsAutoFit] = useState(false)

  // Kanban
  const [departments, setDepartments] = useState<Department[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([])
  const [kanban, setKanban] = useState<KanbanGroup | null>(null)
  const [kanbanLoading, setKanbanLoading] = useState(false)
  const [taskDate, setTaskDate] = useState(() => formatDateKey(new Date()))
  const [selectedCWId, setSelectedCWId] = useState('')

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
      if (meData.user?.full_name) setUserName(meData.user.full_name)

      const dashRes = await fetch(`/api/employee/dashboard?user_id=${userId}`)
      const dashData = await dashRes.json()
      if (cancelled) return

      if (!dashData.success) { setLoading(false); return }

      const { company_id, department_id, department_name } = dashData
      setCompanyId(company_id ?? '')
      setDepartmentId(department_id ?? '')
      setDepartmentName(department_name ?? '')

      if (!cancelled) { setLoading(false); setLastRefreshed(new Date()) }

      if (!company_id || !department_id) { setStatsLoading(false); return }

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
          type TRow = { role: string; department_id: string; shifts: unknown[] }
          const deptRows = (shiftData.rows as TRow[]).filter(
            r => r.department_id === department_id && r.shifts.length > 0
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

    }
    void run()
    return () => { cancelled = true }
  }, [router])

  const fetchTimeline = useCallback(async (cid: string, deptId: string, date: string) => {
    if (!cid || !deptId) return
    setTimelineLoading(true)
    try {
      const res = await fetch(`/api/shift?company_id=${cid}&date_from=${date}&date_to=${date}`)
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

  const fetchCalWeek = useCallback(async (cid: string, deptId: string, anchorDate: string) => {
    if (!cid || !deptId) return
    setTimelineLoading(true)
    try {
      const anchor = new Date(`${anchorDate}T00:00:00`)
      const dow = (anchor.getDay() + 6) % 7
      const mon = addDays(anchor, -dow)
      const sun = addDays(mon, 6)
      const res = await fetch(`/api/shift?company_id=${cid}&date_from=${formatDateKey(mon)}&date_to=${formatDateKey(sun)}`)
      const data = await res.json()
      if (data.success) {
        const deptRows = (data.rows as TimelineRow[]).filter(
          r => r.department_id === deptId && r.user_id !== null
        )
        setCalWeekRows(sortRowsByRole(deptRows))
      }
    } catch {}
    finally { setTimelineLoading(false) }
  }, [])

  useEffect(() => {
    if (!companyId || !departmentId) return
    if (shiftViewMode === 'calendar') {
      void fetchCalWeek(companyId, departmentId, timelineDate)
    } else {
      void fetchTimeline(companyId, departmentId, timelineDate)
    }
  }, [companyId, departmentId, timelineDate, shiftViewMode, fetchTimeline, fetchCalWeek])

  useEffect(() => {
    if (!companyId || !departmentId) return
    let cancelled = false
    Promise.all([
      fetch(`/api/company/departments?company_id=${companyId}`).then(r => r.json()),
      fetch(`/api/team/members?company_id=${companyId}&department_id=${departmentId}`).then(r => r.json()),
    ]).then(([deptData, memberData]) => {
      if (cancelled) return
      if (deptData.success) {
        setDepartments((deptData.departments as Department[]).filter(d => d.id === departmentId))
      }
      if (memberData.success) {
        setMembers((memberData.members as Member[]).filter(m => m.department_id === departmentId || m.role === 'Casual Worker'))
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [companyId, departmentId])

  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    const today = new Date()
    const dateFrom = formatDateKey(addDays(today, -30))
    const dateTo = formatDateKey(addDays(today, 14))

    fetch(`/api/shift?company_id=${companyId}&date_from=${dateFrom}&date_to=${dateTo}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled || !data.success) return
        const options: ShiftOption[] = (data.rows ?? []).flatMap((row: TimelineRow) =>
          row.shifts.map(shift => ({
            ...shift,
            assignee_name: row.full_name,
            user_id: row.user_id,
            department_id: row.department_id,
          })),
        )
        setShiftOptions(options)
      })
      .catch(() => { if (!cancelled) setShiftOptions([]) })
    return () => { cancelled = true }
  }, [companyId])

  const fetchKanban = useCallback(async (cid: string) => {
    if (!cid) return
    setKanbanLoading(true)
    try {
      const res = await fetch(`/api/task?company_id=${cid}&kanban=true`)
      const data = await res.json()
      if (data.success) setKanban(data.groups)
    } catch {}
    finally { setKanbanLoading(false) }
  }, [])

  useEffect(() => {
    if (!companyId) return
    void fetchKanban(companyId)
  }, [companyId, fetchKanban])

  const visibleDeptIds = useMemo(() => new Set(departments.map(d => d.id)), [departments])
  const assignableMembers = members.filter(m => m.role === 'Casual Worker')
  const minTaskDate = useMemo(() => {
    const d = addDays(new Date(), -7)
    const dow = (d.getDay() + 6) % 7
    return formatDateKey(addDays(d, -dow))
  }, [])

  const filteredKanbanTasks = (col: Task['status']): Task[] => {
    if (!kanban) return []
    return (kanban[col] ?? [])
      .filter(t => visibleDeptIds.size === 0 || visibleDeptIds.has(t.department_id))
      .filter(t => !selectedCWId || t.assigned_user_id === selectedCWId)
      .filter(t => {
        if (t.shift_id) {
          const date = t.shift_date ?? shiftOptions.find(s => s.id === t.shift_id)?.shift_date ?? null
          return date === taskDate
        }
        if (t.due_at) return t.due_at.slice(0, 10) === taskDate
        return false
      })
      .sort((a, b) => (PRIORITY_ORDER[a.priority ?? ''] ?? 4) - (PRIORITY_ORDER[b.priority ?? ''] ?? 4))
  }

  const kanbanDateTasks = COLUMNS.flatMap(col => filteredKanbanTasks(col))
  const busyCWIds = new Set(kanbanDateTasks.map(t => t.assigned_user_id).filter(Boolean) as string[])
  const availableCWs = assignableMembers.filter(m => !busyCWIds.has(m.id))
  const busyCWs = assignableMembers.filter(m => busyCWIds.has(m.id))

  function renderDashboardTaskCard(task: Task) {
    const assignee = members.find(m => m.id === task.assigned_user_id)
    const priority = task.priority ? PRIORITY_COLORS[task.priority] : null
    const overdue = task.due_at && task.status !== 'Complete' && isDueOverdue(task.due_at)
    return (
      <div key={task.id} className="task-card" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 7 }}>
          <div>
            {priority && task.priority && (
              <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '3px 9px', borderRadius: 99, background: priority.bg, color: priority.text, letterSpacing: '0.01em' }}>
                {task.priority}
              </span>
            )}
          </div>
        </div>
        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: '0 0 10px', lineHeight: 1.4 }}>
          {task.title}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {assignee ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <div className="task-card-icon" style={{ width: 22, height: 22, borderRadius: '50%', background: '#F0FDF4', border: `1.5px solid ${GREEN}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <UserRound size={12} color={GREEN} strokeWidth={2} />
              </div>
              <span style={{ fontSize: '0.75rem', color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {assignee.full_name}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: '0.75rem', color: '#CBD5E1', fontStyle: 'italic' }}>No assignee</span>
          )}
          {task.due_at && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {overdue && <AlertCircle size={11} color="#EF4444" />}
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: overdue ? '#EF4444' : '#9CA3AF' }}>
                {new Date(task.due_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Timeline rendering
  const PERSON_COL = 240
  const ROW_H = 58
  const TIMELINE_PAD_PCT = 4

  const activeRows = timelineRows.filter(r => r.shifts.length > 0)
  const minTimelineDate = useMemo(() => formatDateKey(addDays(new Date(), -30)), [])
  const todayStr = formatDateKey(new Date())
  const datesWithShifts = useMemo(() => {
    const dates = new Set<string>()
    for (const row of [...timelineRows, ...calWeekRows]) {
      for (const shift of row.shifts) dates.add(shift.shift_date)
    }
    return dates
  }, [timelineRows, calWeekRows])

  function setTimelineByOffset(offset: number) {
    setTimelineDate(formatDateKey(addDays(new Date(`${timelineDate}T00:00:00`), offset)))
  }

  function setTimelineWeekByOffset(offset: number) {
    const anchor = new Date(`${timelineDate}T00:00:00`)
    const dow = (anchor.getDay() + 6) % 7
    const mon = addDays(anchor, -dow)
    setTimelineDate(formatDateKey(addDays(mon, offset * 7)))
  }

  function formatDateInput(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  }

  function calendarWeekLabel() {
    const anchor = new Date(`${timelineDate}T00:00:00`)
    const dow = (anchor.getDay() + 6) % 7
    const mon = addDays(anchor, -dow)
    const sun = addDays(mon, 6)
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('en-US', { month: 'short' })}`
    return `${fmt(mon)} - ${fmt(sun)} ${sun.getFullYear()}`
  }

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
      <div style={{ display: 'flex', background: 'linear-gradient(135deg, #052E16 0%, #14532D 100%)', borderRadius: '12px 12px 0 0' }}>
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
    const EDGE = '2px solid rgba(5,46,22,0.35)'
    return (
      <div style={{ borderRight: EDGE, borderBottom: EDGE }}>
        {deptOrder.map((deptId, deptIdx) => {
          const dept = deptMap[deptId]
          return dept.rows.map((row, rowIdx) => {
            const isDeptBoundary = deptIdx > 0 && rowIdx === 0
            return (
              <div key={`${row.user_id ?? row.department_id}_${rowIdx}`} style={{ display: 'flex', height: ROW_H, borderTop: isDeptBoundary ? EDGE : 'none', background: '#FFFFFF' }}>
                <div style={{ width: PERSON_COL, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: row.role === 'Manager' ? '#F0FDF4' : '#F3F4F6', color: row.role === 'Manager' ? GREEN : '#4B5563', borderRadius: 999 }}>
                      {row.role === 'Manager' ? <UserCog size={13} /> : <UserRound size={13} />}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                      {row.full_name}
                    </span>
                  </div>
                </div>
                <div style={{ position: 'relative', flex: 1 }}>
                  {hourTicks.map(h => (
                    <div key={`grid-${h}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${positionForTimeWithPad(h * 60)}%`, width: 0, borderLeft: '1px solid rgba(5,46,22,0.10)', pointerEvents: 'none', zIndex: 2 }} />
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
                      <div key={shift.id} style={{ position: 'absolute', top: 10, bottom: 10, left: `${left}%`, width: `${Math.max(width, 1.5)}%`, borderRadius: 999, background: GREEN, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
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

  function renderCalendarView() {
    const anchor = new Date(`${timelineDate}T00:00:00`)
    const dow = (anchor.getDay() + 6) % 7
    const monday = addDays(anchor, -dow)
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i)
      return {
        date,
        key: formatDateKey(date),
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        day: date.getDate(),
      }
    })
    const rows = calWeekRows.filter(r => r.shifts.length > 0)
    if (rows.length === 0) {
      return (
        <div style={{ padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
          <CalendarDays size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
          <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No shifts scheduled this week</p>
        </div>
      )
    }
    return (
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px repeat(7, minmax(120px, 1fr))', background: '#052E16', color: '#FFFFFF' }}>
          <div style={{ minHeight: 42, borderRight: '1px solid rgba(255,255,255,0.12)' }} />
          {days.map(day => (
            <div key={day.key} style={{ minHeight: 42, padding: '8px 10px', borderRight: '1px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.62)' }}>{day.label}</span>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{day.day}</span>
            </div>
          ))}
        </div>
        {rows.map((row, idx) => (
          <div key={`${row.user_id}_${idx}`} style={{ display: 'grid', gridTemplateColumns: '220px repeat(7, minmax(120px, 1fr))', minHeight: 74, borderBottom: idx === rows.length - 1 ? 'none' : '1px solid #E5E7EB', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderRight: '1px solid #E5E7EB', minWidth: 0 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: row.role === 'Manager' ? '#F0FDF4' : '#F3F4F6', color: row.role === 'Manager' ? GREEN : '#4B5563', borderRadius: 999 }}>
                {row.role === 'Manager' ? <UserCog size={13} /> : <UserRound size={13} />}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.full_name}</span>
            </div>
            {days.map(day => {
              const dayShifts = row.shifts.filter(shift => shift.shift_date === day.key)
              return (
                <div key={day.key} style={{ padding: 8, borderRight: '1px solid #EEF2F7', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {dayShifts.length === 0 ? (
                    <div style={{ height: '100%', minHeight: 42, borderRadius: 10, background: '#F8FAFC' }} />
                  ) : dayShifts.map(shift => (
                    <div key={shift.id} style={{ borderRadius: 10, background: GREEN, border: '1px solid #15803D', color: '#FFFFFF', padding: '7px 9px', boxShadow: '0 4px 12px rgba(22,163,74,0.22)' }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 800 }}>{formatShiftHour(shift.start_time)} - {formatShiftHour(shift.end_time)}</p>
                      {shift.title && <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.82)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shift.title}</p>}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
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
        .stat-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.10), 0 0 0 1.5px rgba(22,163,74,0.18) !important; transform: translateY(-3px) scale(1.015); }
        .panel-card { transition: box-shadow 0.22s ease, transform 0.22s ease; }
        .panel-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.09), 0 0 0 1.5px rgba(0,0,0,0.07) !important; transform: translateY(-2px); }
        .feed-item { transition: background 0.15s ease, transform 0.15s ease; }
        .feed-item:hover { background: #F0FDF4 !important; transform: translateX(2px); }
        .task-item { transition: background 0.15s ease, transform 0.15s ease; }
        .task-item:hover { background: #F0FDF4 !important; transform: translateX(2px); }
        .team-row { transition: background 0.15s ease, transform 0.12s ease; }
        .team-row:hover { background: #F0FDF4 !important; transform: translateX(2px); }
        .mark-btn { transition: background 0.15s ease, transform 0.12s ease; }
        .mark-btn:hover { transform: scale(1.05); }
      `}</style>
      <EmployeeSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '20px 28px', gap: 0 }}>
        {/* Page header */}
        <div style={{ marginBottom: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: GREEN, marginBottom: 4 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              {departmentName ? `Today's Overview · ${departmentName}` : "Today's Overview"}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {userName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#14532D', color: '#FFFFFF', flexShrink: 0 }}>
                  <UserRound size={13} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#111827', fontFamily: 'var(--font-heading)' }}>{userName}</span>
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
              {/* Schedule Timeline */}
              <div className="panel-card" style={{ minWidth: 0, padding: '16px 20px', background: '#FFFFFF', borderRadius: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarDays size={16} style={{ color: GREEN }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Schedule</span>
                    {timelineLoading && <Spinner size={13} dark />}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {shiftViewMode === 'calendar' ? (
                      <>
                        <button type="button" onClick={() => setTimelineWeekByOffset(-1)} style={{ width: 38, height: 38, borderRadius: 9, border: '1px solid #E5E7EB', background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: '#0F172A' }}>
                          <ChevronLeft size={16} />
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', padding: '0 10px', minWidth: 176, textAlign: 'center', height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF' }}>
                          {calendarWeekLabel()}
                        </span>
                        <button type="button" onClick={() => setTimelineWeekByOffset(1)} style={{ width: 38, height: 38, borderRadius: 9, border: '1px solid #E5E7EB', background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: '#0F172A' }}>
                          <ChevronRight size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => setTimelineDate(todayStr)} style={{ height: 38, padding: '0 14px', border: '1px solid #E5E7EB', borderRadius: 8, background: timelineDate === todayStr ? GREEN : '#FFFFFF', color: timelineDate === todayStr ? '#FFFFFF' : '#0F172A', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          Today
                        </button>
                        <button type="button" onClick={() => setTimelineByOffset(-1)} disabled={timelineDate <= minTimelineDate} style={{ width: 38, height: 38, borderRadius: 9, border: '1px solid #E5E7EB', background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: timelineDate <= minTimelineDate ? 'default' : 'pointer', color: '#0F172A', opacity: timelineDate <= minTimelineDate ? 0.3 : 1 }}>
                          <ChevronLeft size={16} />
                        </button>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 12px', border: '1px solid #E5E7EB', borderRadius: 9, background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#0F172A', minWidth: 146, position: 'relative' }}>
                          <CalendarDays size={14} color="#64748B" style={{ flexShrink: 0 }} />
                          <span>{formatDateInput(timelineDate)}</span>
                          <input
                            type="date"
                            value={timelineDate}
                            min={minTimelineDate}
                            onChange={e => setTimelineDate(e.target.value)}
                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                          />
                        </label>
                        <button type="button" onClick={() => setTimelineByOffset(1)} style={{ width: 38, height: 38, borderRadius: 9, border: '1px solid #E5E7EB', background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: '#0F172A' }}>
                          <ChevronRight size={16} />
                        </button>
                      </>
                    )}
                    <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label="Timeline options"
                      style={{ display: 'flex', width: 36, height: 36, cursor: 'pointer', alignItems: 'center', justifyContent: 'center', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280' }}
                    >
                      <MoreHorizontal size={16} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={10} style={{ width: 280, borderRadius: 16, padding: 16, border: '1px solid #E5E7EB', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>
                        View
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
                        {[
                          { value: 'timeline' as const, label: 'Timeline' },
                          { value: 'calendar' as const, label: 'Calendar' },
                        ].map(opt => (
                          <button key={opt.value} type="button" onClick={() => setShiftViewMode(opt.value)} style={{ cursor: 'pointer', borderRadius: 10, border: shiftViewMode === opt.value ? `1.5px solid ${GREEN}88` : '1px solid #E5E7EB', background: shiftViewMode === opt.value ? '#F0FDF4' : '#F9FAFB', padding: '8px 6px', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: shiftViewMode === opt.value ? GREEN : '#374151' }}>{opt.label}</p>
                          </button>
                        ))}
                      </div>
                      <div style={{ height: 1, background: '#F1F5F9', margin: '0 0 16px' }} />
                      <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <SlidersHorizontal size={12} style={{ color: GREEN }} />
                        Time window
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                        {[
                          { label: 'Auto-fit', onClick: () => { setTimeFrom(autoFrom); setTimeTo(autoTo); setIsAutoFit(true) }, active: isAutoFit },
                          { label: 'Full day', onClick: () => { setTimeFrom(0); setTimeTo(24); setIsAutoFit(false) }, active: !isAutoFit && timeFrom === 0 && timeTo === 24 },
                        ].map(opt => (
                          <button key={opt.label} type="button" onClick={opt.onClick} style={{ cursor: 'pointer', borderRadius: 10, border: opt.active ? `1.5px solid ${GREEN}44` : '1px solid #E5E7EB', background: opt.active ? '#F0FDF4' : '#F9FAFB', padding: '8px 6px', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: opt.active ? GREEN : '#374151' }}>{opt.label}</p>
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
                </div>

                {timelineLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Spinner size={20} dark /></div>
                ) : shiftViewMode === 'calendar' ? (
                  renderCalendarView()
                ) : activeRows.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                    <CalendarDays size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No shifts scheduled for this date</p>
                  </div>
                ) : (
                  <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                    {renderHourAxis()}
                    {renderTimelineContent(activeRows)}
                  </div>
                )}
              </div>

              <div className="panel-card" style={{ background: '#FFFFFF', borderRadius: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', overflow: 'hidden', minHeight: 560, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <UserRound size={15} style={{ color: GREEN }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px' }}>Casual Worker:</span>
                    </div>
                    <button type="button" onClick={() => setSelectedCWId('')} className="dept-pill" style={{ padding: '5px 13px', borderRadius: 99, border: selectedCWId === '' ? `2px solid ${GREEN}` : '1.5px solid #E5E7EB', background: selectedCWId === '' ? GREEN : 'transparent', color: selectedCWId === '' ? '#FFFFFF' : '#374151', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0 }}>
                      All
                    </button>
                    {assignableMembers.map(m => (
                      <button key={m.id} type="button" onClick={() => setSelectedCWId(selectedCWId === m.id ? '' : m.id)} className="dept-pill" style={{ padding: '5px 13px', borderRadius: 99, border: selectedCWId === m.id ? `2px solid ${GREEN}` : '1.5px solid #E5E7EB', background: selectedCWId === m.id ? GREEN : 'transparent', color: selectedCWId === m.id ? '#FFFFFF' : '#374151', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0 }}>
                        {m.full_name}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button type="button" onClick={() => setTaskDate(formatDateKey(new Date()))} style={{ height: 38, padding: '0 14px', border: '1px solid #E2E8F0', borderRadius: 8, background: taskDate === formatDateKey(new Date()) ? GREEN : '#FFFFFF', color: taskDate === formatDateKey(new Date()) ? '#FFFFFF' : '#0F172A', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      Today
                    </button>
                    <button type="button" onClick={() => setTaskDate(formatDateKey(addDays(new Date(`${taskDate}T00:00:00`), -1)))} disabled={taskDate <= minTaskDate} style={{ width: 38, height: 38, borderRadius: 9, border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: taskDate <= minTaskDate ? 'default' : 'pointer', color: '#0F172A', opacity: taskDate <= minTaskDate ? 0.3 : 1 }}>
                      <ChevronLeft size={16} />
                    </button>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 12px', border: '1px solid #E2E8F0', borderRadius: 9, background: '#FFFFFF', fontSize: 13, fontWeight: 500, color: '#0F172A', minWidth: 140 }}>
                      <CalendarDays size={14} color="#64748B" style={{ flexShrink: 0 }} />
                      <span>{new Date(`${taskDate}T00:00:00`).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                    </div>
                    <button type="button" onClick={() => setTaskDate(formatDateKey(addDays(new Date(`${taskDate}T00:00:00`), 1)))} style={{ width: 38, height: 38, borderRadius: 9, border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: '#0F172A' }}>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {kanbanLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 360 }}>
                    <Spinner size={24} dark />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    {!selectedCWId && assignableMembers.length > 0 && (
                      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                        <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {availableCWs.length > 0 && (
                            <>
                              <p style={{ margin: '0 2px 2px', fontSize: '0.68rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Available</p>
                              {availableCWs.map(m => (
                                <div key={m.id} className="member-card" style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #F1F5F9', borderRadius: 12, padding: '9px 10px', background: '#FFFFFF' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#F0FDF4', color: GREEN, flexShrink: 0 }}>
                                    <UserRound size={13} />
                                  </span>
                                  <p style={{ margin: 0, color: '#111827', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.full_name}</p>
                                </div>
                              ))}
                            </>
                          )}
                          {busyCWs.length > 0 && (
                            <>
                              <p style={{ margin: `${availableCWs.length > 0 ? '10px' : '0'} 2px 2px`, fontSize: '0.68rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Has Tasks</p>
                              {busyCWs.map(m => (
                                <div key={m.id} className="member-card" style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #F1F5F9', borderRadius: 12, padding: '9px 10px', background: '#FFFFFF' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#F0FDF4', color: GREEN, flexShrink: 0 }}>
                                    <UserRound size={13} />
                                  </span>
                                  <p style={{ margin: 0, color: '#111827', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.full_name}</p>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'row', alignItems: 'stretch', padding: '16px 16px 20px', gap: 0 }}>
                      {COLUMNS.map((col, colIdx) => {
                        const cfg = STATUS_CONFIG[col]
                        const tasks = filteredKanbanTasks(col)
                        return (
                          <Fragment key={col}>
                            {colIdx > 0 && (
                              <div style={{ flexShrink: 0, width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="24" height="18" viewBox="0 0 24 18" fill="none">
                                  <line x1="0" y1="9" x2="17" y2="9" stroke="#94A3B8" strokeWidth="2" />
                                  <polyline points="11,3 19,9 11,15" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                                </svg>
                              </div>
                            )}
                            <div className="kanban-col" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#F7F8FA', borderRadius: 12, overflow: 'hidden', minHeight: 0, border: '1px solid #F0F1F3' }}>
                              <div style={{ padding: '11px 14px 10px', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, borderBottom: '1px solid #ECEEF1' }}>
                                <div style={{ color: cfg.color, display: 'flex', alignItems: 'center' }}>{cfg.icon}</div>
                                <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: cfg.color, flex: 1 }}>{cfg.label}</span>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: 99 }}>{tasks.length}</span>
                              </div>
                              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 12px' }}>
                                {tasks.length === 0 ? (
                                  <div style={{ margin: '8px 0', padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                                    {{ Assigned: <Layers size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />, 'In Progress': <Clock size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />, Review: <Eye size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />, Complete: <CheckCircle size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} /> }[col]}
                                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No {cfg.label.toLowerCase()} tasks</p>
                                  </div>
                                ) : (
                                  tasks.map(renderDashboardTaskCard)
                                )}
                              </div>
                            </div>
                          </Fragment>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
