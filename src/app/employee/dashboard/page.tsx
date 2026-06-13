'use client'

import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  UserRound, UserCog,
  CalendarDays, MoreHorizontal, SlidersHorizontal,
  ChevronLeft, ChevronRight, CheckCircle, Clock, Eye, Layers, AlertCircle,
  MessageSquare, Megaphone, Search, SquarePen, Globe,
  Send, Pin, PinOff, ImagePlus, Paperclip, FileText, Download, X,
  Crown, UserCog as UserCogIcon,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase'
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
const ACCENT = '#16A34A'
const ACCENT_LIGHT = '#F0FDF4'
const DARK_BG = '#14532D'

// ─── Communication types (mirrored from EP Communication page) ────────────────

type CommAnnouncement = {
  id: string
  from_user_id: string
  company_id: string
  department_id: string | null
  title: string
  content: string
  created_at: string
  created_by_name?: string | null
  poster_role?: string | null
}

type CommConversation = {
  partnerId: string
  partnerName: string
  partnerRole: string
  lastMessage: string
  lastTime: string
  unreadCount: number
  partnerDeleted?: boolean
  companyId?: string | null
  companyName?: string | null
}

type CommMessage = {
  id: string
  from_user_id: string
  to_user_id: string
  content: string
  created_at: string
  is_read: boolean
}

// ─── Communication helpers ────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  Owner: '#FFFFFF', Partner: '#FFFFFF', Manager: '#16A34A', Employee: '#4B5563',
}
const ROLE_BG: Record<string, string> = {
  Owner: '#0F172A', Partner: '#0F172A', Manager: '#F0FDF4', Employee: '#F3F4F6',
}

function commFormatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function commHashColor(name: string): string {
  const palette = ['#16A34A', '#8B5CF6', '#0EA5E9', '#10B981', '#EC4899', '#F97316', '#D97706', '#6366F1']
  let h = 5381
  for (let i = 0; i < name.length; i++) h = (h << 5) + h + name.charCodeAt(i)
  return palette[Math.abs(h) % palette.length]
}

function CommAvatar({ name, size = 36, role }: { name: string; size?: number; role?: string }) {
  const color = role ? (ROLE_COLOR[role] ?? commHashColor(name)) : commHashColor(name)
  const bg = role ? (ROLE_BG[role] ?? `${color}18`) : `${color}18`
  const iconSize = Math.round(size * 0.46)
  const isDark = role === 'Owner' || role === 'Partner'
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: isDark ? 'none' : `2px solid ${color}22` }}>
      {role === 'Owner' || role === 'Partner' ? <Crown size={iconSize} />
        : role === 'Manager' ? <UserCogIcon size={iconSize} />
        : <UserRound size={iconSize} />}
    </div>
  )
}

function CommSpinner({ size = 15 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

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

function DashboardDatePicker({ value, onChange, markedDates, minDate }: {
  value: string
  onChange: (date: string) => void
  markedDates: Set<string>
  minDate?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 292 })
  const [viewMonth, setViewMonth] = useState(value.slice(0, 7))
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (event: MouseEvent) => {
      if (triggerRef.current?.contains(event.target as Node) || popoverRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const popoverHeight = 320
      const fitsBelow = rect.bottom + popoverHeight + 8 <= window.innerHeight
      setViewMonth(value.slice(0, 7))
      setPos({
        top: fitsBelow ? rect.bottom + 6 : rect.top - popoverHeight - 6,
        left: rect.right - Math.max(rect.width, 292),
        width: Math.max(rect.width, 292),
      })
    }
    setOpen(current => !current)
  }

  const today = formatDateKey(new Date())
  const minSelectable = minDate ?? '2000-01-01'
  const [year, month] = viewMonth.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const cells: (string | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)

  const minMonth = minSelectable.slice(0, 7)
  const canGoPrev = viewMonth > minMonth
  const goPrev = () => {
    const next = new Date(year, month - 2, 1)
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    if (nextMonth >= minMonth) setViewMonth(nextMonth)
  }
  const goNext = () => {
    const next = new Date(year, month, 1)
    setViewMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
  }

  const displayLabel = new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })

  const popover = open ? (
    <div ref={popoverRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 16, boxShadow: '0 8px 32px rgba(15,23,42,0.14)', padding: '14px 16px', width: pos.width }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" onClick={goPrev} disabled={!canGoPrev} style={{ width: 26, height: 26, border: `1px solid ${BORDER}`, borderRadius: 7, background: '#FFFFFF', cursor: canGoPrev ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canGoPrev ? '#64748B' : '#D1D5DB' }}><ChevronLeft size={13} /></button>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{monthLabel}</span>
        <button type="button" onClick={goNext} style={{ width: 26, height: 26, border: `1px solid ${BORDER}`, borderRadius: 7, background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><ChevronRight size={13} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textAlign: 'center', height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{day}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} style={{ height: 36 }} />
          if (date < minSelectable) return <div key={date} style={{ height: 36 }} />
          const isSelected = date === value
          const isToday = date === today
          const isPast = date < today
          const hasMarker = markedDates.has(date)
          return (
            <button key={date} type="button" onClick={() => { onChange(date); setOpen(false) }}
              style={{ height: 36, width: '100%', border: isToday && !isSelected ? `2px solid ${GREEN}` : 'none', borderRadius: 8, background: isSelected ? GREEN : 'transparent', color: isSelected ? '#FFFFFF' : isToday ? GREEN : '#0F172A', fontWeight: isSelected || isToday ? 700 : 400, fontSize: 13, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 0 }}
              onMouseEnter={event => { if (!isSelected) event.currentTarget.style.background = '#F8FAFC' }}
              onMouseLeave={event => { if (!isSelected) event.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ lineHeight: 1 }}>{parseInt(date.split('-')[2])}</span>
              {hasMarker && <span style={{ width: 4, height: 4, borderRadius: '50%', background: isPast ? '#94A3B8' : isSelected ? 'rgba(255,255,255,0.85)' : GREEN, flexShrink: 0 }} />}
            </button>
          )
        })}
      </div>
    </div>
  ) : null

  return (
    <>
      <button ref={triggerRef} type="button" onClick={handleOpen} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 12px', border: `1px solid ${BORDER}`, borderRadius: 9, background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#0F172A', minWidth: 140 }}>
        <CalendarDays size={14} color="#64748B" style={{ flexShrink: 0 }} />
        <span>{displayLabel}</span>
      </button>
      {typeof document !== 'undefined' && createPortal(popover, document.body)}
    </>
  )
}

export default function EmployeeDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [loading, setLoading] = useState(true)

  const [companyId, setCompanyId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [employeeId, setEmployeeId] = useState('')

  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // ── New conversation modal ────────────────────────────────────────────────
  const [newConvOpen, setNewConvOpen] = useState(false)
  const [newConvMembers, setNewConvMembers] = useState<{ id: string; full_name: string; role: string }[]>([])
  const [newConvSearch, setNewConvSearch] = useState('')
  const [newConvLoading, setNewConvLoading] = useState(false)

  // ── Communication panel state ──────────────────────────────────────────────
  const supabaseComm = createClient()
  const [commTab, setCommTab] = useState<'chat' | 'announcements'>('chat')
  const [commInternalUserId, setCommInternalUserId] = useState<string | null>(null)
  const [commCompanyId, setCommCompanyId] = useState<string | null>(null)
  const [commUserRole, setCommUserRole] = useState('')
  const [commUserDeptId, setCommUserDeptId] = useState<string | null>(null)
  const [commDepartments, setCommDepartments] = useState<{ id: string; name: string }[]>([])
  const [unreadMessages, setUnreadMessages] = useState(0)

  const [announcements, setAnnouncements] = useState<CommAnnouncement[]>([])
  const [selectedAnn, setSelectedAnn] = useState<CommAnnouncement | null>(null)
  const [annReadIds, setAnnReadIds] = useState<Set<string>>(new Set())
  const [annSearch, setAnnSearch] = useState('')

  const [conversations, setConversations] = useState<CommConversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<CommConversation[]>([])
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [convSearch, setConvSearch] = useState('')

  const [openPanelIds, setOpenPanelIds] = useState<string[]>([])
  const [panelMessages, setPanelMessages] = useState<Record<string, CommMessage[]>>({})
  const [panelInputs, setPanelInputs] = useState<Record<string, string>>({})
  const [panelSending, setPanelSending] = useState<Record<string, boolean>>({})
  const [panelAttachFile, setPanelAttachFile] = useState<Record<string, File | null>>({})
  const [panelAttachPreview, setPanelAttachPreview] = useState<Record<string, string | null>>({})
  const [panelUploading, setPanelUploading] = useState<Record<string, boolean>>({})
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [draggingPanel, setDraggingPanel] = useState<string | null>(null)
  const panelPhotoRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const panelFileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const panelEndRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [conversationsFetched, setConversationsFetched] = useState(false)

  const unreadAnnCount = announcements.filter(a => !annReadIds.has(a.id)).length

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
  const [shiftMarkerRows, setShiftMarkerRows] = useState<TimelineRow[]>([])
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
  const todayStr = formatDateKey(new Date())
  const minSelectableDate = useMemo(() => {
    const date = addDays(new Date(), -7)
    const dow = (date.getDay() + 6) % 7
    return formatDateKey(addDays(date, -dow))
  }, [])
  const maxMarkerDate = useMemo(() => formatDateKey(addDays(new Date(), 14)), [])

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
      setEmployeeId(dashData.employee_id ?? '')
      setDepartmentName(department_name ?? '')
      if (dashData.employee_id) {
        setMembers([{
          id: dashData.employee_id,
          full_name: meData.user?.full_name ?? 'Me',
          role: 'Employee',
          department_id: department_id ?? null,
        }])
      }

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
        const deptRows = (data.rows as TimelineRow[])
          .filter(r => r.department_id === deptId && r.user_id !== null)
          .filter(r => date === todayStr || r.user_id === employeeId)
        setTimelineRows(sortRowsByRole(deptRows))
      }
    } catch {}
    finally { setTimelineLoading(false) }
  }, [employeeId, todayStr])

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
        const deptRows = (data.rows as TimelineRow[])
          .filter(r => r.department_id === deptId && r.user_id !== null)
          .map(row => ({
            ...row,
            shifts: row.shifts.filter(shift => shift.shift_date === todayStr || row.user_id === employeeId),
          }))
          .filter(row => row.shifts.length > 0)
        setCalWeekRows(sortRowsByRole(deptRows))
      }
    } catch {}
    finally { setTimelineLoading(false) }
  }, [employeeId, todayStr])

  const fetchShiftMarkers = useCallback(async (cid: string, deptId: string) => {
    if (!cid || !deptId) return
    try {
      const res = await fetch(`/api/shift?company_id=${cid}&date_from=${minSelectableDate}&date_to=${maxMarkerDate}`)
      const data = await res.json()
      if (data.success) {
        const rows = (data.rows as TimelineRow[])
          .filter(row => row.department_id === deptId && row.user_id !== null)
          .map(row => ({
            ...row,
            shifts: row.shifts.filter(shift => shift.shift_date === todayStr || row.user_id === employeeId),
          }))
          .filter(row => row.shifts.length > 0)
        setShiftMarkerRows(rows)
      }
    } catch {
      setShiftMarkerRows([])
    }
  }, [employeeId, maxMarkerDate, minSelectableDate, todayStr])

  useEffect(() => {
    if (!companyId || !departmentId) return
    if (shiftViewMode === 'calendar') {
      void fetchCalWeek(companyId, departmentId, timelineDate)
    } else {
      void fetchTimeline(companyId, departmentId, timelineDate)
    }
    void fetchShiftMarkers(companyId, departmentId)
  }, [companyId, departmentId, timelineDate, shiftViewMode, fetchTimeline, fetchCalWeek, fetchShiftMarkers])

  useEffect(() => {
    if (!companyId || !departmentId) return
    let cancelled = false
    fetch(`/api/company/departments?company_id=${companyId}`)
      .then(r => r.json())
      .then(deptData => {
      if (cancelled) return
      if (deptData.success) {
        setDepartments((deptData.departments as Department[]).filter(d => d.id === departmentId))
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

  // ── Communication panel fetch logic ──────────────────────────────────────────

  const fetchCommUnreadCount = useCallback(() => {
    if (!commInternalUserId || !commCompanyId) return
    fetch(`/api/inbox/unread-count?user_id=${commInternalUserId}&company_id=${commCompanyId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setUnreadMessages(d.unread_messages ?? 0) })
  }, [commInternalUserId, commCompanyId])

  const fetchCommAnnouncements = useCallback(() => {
    if (!commCompanyId || !commUserRole) return
    const params = new URLSearchParams({ company_id: commCompanyId, role: commUserRole })
    if (commInternalUserId) params.set('user_id', commInternalUserId)
    if (commUserDeptId) params.set('department_id', commUserDeptId)
    fetch(`/api/inbox/announcements?${params}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) return
        const rows = (d.announcements ?? []) as CommAnnouncement[]
        setAnnouncements(commUserRole === 'Employee'
          ? rows.filter(ann => ann.department_id === commUserDeptId && ann.poster_role === 'Manager')
          : rows)
      })
  }, [commCompanyId, commUserRole, commUserDeptId, commInternalUserId])

  const fetchCommConversations = useCallback(() => {
    if (!commInternalUserId) return
    fetch(`/api/inbox/messages?user_id=${commInternalUserId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setConversations(d.conversations ?? [])
          setConversationsFetched(true)
        }
      })
  }, [commInternalUserId])

  useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id')
    const cid = localStorage.getItem('tasking_company_id') ?? localStorage.getItem(`tasking_company_id_${uid}`)
    setCommCompanyId(cid)
    if (uid) {
      fetch(`/api/user/me?user_id=${uid}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            setCommInternalUserId(d.user.id)
            setCommUserRole(d.user.role ?? '')
            setCommUserDeptId(d.user.department_id ?? null)
            if (cid) {
              fetch(`/api/inbox/announcements/read?user_id=${d.user.id}&company_id=${cid}`)
                .then(r => r.json())
                .then(rd => { if (rd.success) setAnnReadIds(new Set(rd.readIds)) })
                .catch(() => {})
            }
          }
        })
    }
  }, [])

  useEffect(() => {
    if (!commCompanyId) return
    const uid = localStorage.getItem('tasking_user_id') ?? ''
    fetch(`/api/company/departments?company_id=${commCompanyId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setCommDepartments(d.departments ?? []) })
    void uid
  }, [commCompanyId])

  useEffect(() => {
    if (!commInternalUserId || !commCompanyId || !commUserRole) return
    fetchCommAnnouncements()
    fetchCommUnreadCount()
  }, [commInternalUserId, commCompanyId, commUserRole, fetchCommAnnouncements, fetchCommUnreadCount])

  useEffect(() => {
    if (!commInternalUserId || !commCompanyId || announcements.length === 0) return
    const unreadIds = announcements.filter(a => !annReadIds.has(a.id)).map(a => a.id)
    if (unreadIds.length === 0) return
    const next = new Set(annReadIds)
    unreadIds.forEach(id => next.add(id))
    setAnnReadIds(next)
    fetch('/api/inbox/announcements/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: commInternalUserId, announcement_ids: unreadIds }),
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcements, commCompanyId, commInternalUserId])

  useEffect(() => {
    if (!commInternalUserId) return
    fetchCommConversations()
    try {
      const raw = localStorage.getItem(`pinned_convs_${commInternalUserId}`)
      if (raw) setPinnedIds(new Set(JSON.parse(raw)))
    } catch {}
  }, [commInternalUserId, fetchCommConversations])

  useEffect(() => {
    const q = convSearch.toLowerCase()
    const base = q ? conversations.filter(c => c.partnerName.toLowerCase().includes(q)) : conversations
    const sorted = [...base].sort((a, b) => {
      const aPin = pinnedIds.has(a.partnerId) ? 0 : 1
      const bPin = pinnedIds.has(b.partnerId) ? 0 : 1
      return aPin - bPin
    })
    setFilteredConversations(sorted)
  }, [convSearch, conversations, pinnedIds])

  useEffect(() => {
    if (!commCompanyId) return
    const channel = supabaseComm
      .channel('dash-comm-announcements')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements', filter: `company_id=eq.${commCompanyId}` },
        () => fetchCommAnnouncements())
      .subscribe()
    return () => { supabaseComm.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commCompanyId])

  useEffect(() => {
    if (!commInternalUserId) return
    const channel = supabaseComm
      .channel('dash-comm-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_user_id=eq.${commInternalUserId}` },
        (payload) => {
          const newMsg = payload.new as CommMessage
          setPanelMessages(prev => {
            if (prev[newMsg.from_user_id] !== undefined) {
              fetch(`/api/inbox/messages/${newMsg.from_user_id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: commInternalUserId }),
              }).catch(() => {})
              return { ...prev, [newMsg.from_user_id]: [...prev[newMsg.from_user_id], newMsg] }
            }
            return prev
          })
          fetchCommConversations()
          fetchCommUnreadCount()
        })
      .subscribe()
    return () => { supabaseComm.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commInternalUserId])

  function fetchPanelMessages(partnerId: string) {
    if (!commInternalUserId) return
    fetch(`/api/inbox/messages/${partnerId}?user_id=${commInternalUserId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setPanelMessages(prev => ({ ...prev, [partnerId]: d.messages ?? [] }))
          fetch(`/api/inbox/messages/${partnerId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: commInternalUserId }),
          }).then(() => { fetchCommUnreadCount(); fetchCommConversations() }).catch(() => {})
        }
      })
  }

  useEffect(() => {
    for (const pid of openPanelIds) {
      panelEndRefs.current[pid]?.scrollIntoView({ behavior: 'smooth' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelMessages])

  function openCommPanel(partnerId: string) {
    setOpenPanelIds(prev => {
      if (prev.includes(partnerId)) return prev
      const next = prev.length >= 4 ? [...prev.slice(1), partnerId] : [...prev, partnerId]
      return next
    })
    if (!panelMessages[partnerId]) fetchPanelMessages(partnerId)
  }

  function closeCommPanel(partnerId: string) {
    setOpenPanelIds(prev => prev.filter(id => id !== partnerId))
    setPanelMessages(prev => { const n = { ...prev }; delete n[partnerId]; return n })
    setPanelInputs(prev => { const n = { ...prev }; delete n[partnerId]; return n })
    setPanelSending(prev => { const n = { ...prev }; delete n[partnerId]; return n })
    setPanelAttachFile(prev => { const n = { ...prev }; delete n[partnerId]; return n })
    setPanelAttachPreview(prev => { const n = { ...prev }; delete n[partnerId]; return n })
    setPanelUploading(prev => { const n = { ...prev }; delete n[partnerId]; return n })
  }

  function swapCommPanels(idA: string, idB: string) {
    setOpenPanelIds(prev => {
      const next = [...prev]
      const iA = next.indexOf(idA)
      const iB = next.indexOf(idB)
      if (iA === -1 || iB === -1) return prev
      ;[next[iA], next[iB]] = [next[iB], next[iA]]
      return next
    })
  }

  async function handleCommSendMessage(partnerId: string) {
    const conv = conversations.find(c => c.partnerId === partnerId)
    const content = (panelInputs[partnerId] ?? '').trim()
    if (!content || !conv || !commInternalUserId || !commCompanyId) return
    setPanelSending(prev => ({ ...prev, [partnerId]: true }))
    const optimistic: CommMessage = {
      id: `tmp-${Date.now()}`, from_user_id: commInternalUserId, to_user_id: partnerId,
      content, created_at: new Date().toISOString(), is_read: false,
    }
    setPanelMessages(prev => ({ ...prev, [partnerId]: [...(prev[partnerId] ?? []), optimistic] }))
    setPanelInputs(prev => ({ ...prev, [partnerId]: '' }))
    try {
      const res = await fetch('/api/inbox/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_user_id: commInternalUserId, to_user_id: partnerId, company_id: commCompanyId, content }),
      })
      const data = await res.json()
      if (data.success) {
        setPanelMessages(prev => ({
          ...prev,
          [partnerId]: (prev[partnerId] ?? []).map(m => m.id === optimistic.id ? data.message : m),
        }))
        fetchCommConversations()
      }
    } finally { setPanelSending(prev => ({ ...prev, [partnerId]: false })) }
  }

  function pickCommAttachment(partnerId: string, file: File) {
    setPanelAttachFile(prev => ({ ...prev, [partnerId]: file }))
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = e => setPanelAttachPreview(prev => ({ ...prev, [partnerId]: e.target?.result as string }))
      reader.readAsDataURL(file)
    } else {
      setPanelAttachPreview(prev => ({ ...prev, [partnerId]: null }))
    }
  }

  function clearCommAttachment(partnerId: string) {
    setPanelAttachFile(prev => ({ ...prev, [partnerId]: null }))
    setPanelAttachPreview(prev => ({ ...prev, [partnerId]: null }))
    const photoEl = panelPhotoRefs.current[partnerId]
    const fileEl = panelFileRefs.current[partnerId]
    if (photoEl) photoEl.value = ''
    if (fileEl) fileEl.value = ''
  }

  async function uploadAndSendCommAttachment(partnerId: string) {
    const file = panelAttachFile[partnerId]
    const conv = conversations.find(c => c.partnerId === partnerId)
    if (!file || !conv || !commInternalUserId || !commCompanyId) return
    setPanelUploading(prev => ({ ...prev, [partnerId]: true }))
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('company_id', commCompanyId)
      const upRes = await fetch('/api/inbox/upload', { method: 'POST', body: form })
      const upData = await upRes.json()
      if (!upData.success) throw new Error(upData.error ?? 'Upload failed')
      const isImage = file.type.startsWith('image/')
      const prefix = isImage ? '[image:]' : `[file:${upData.name}]`
      const content = `${prefix}${upData.url}`
      const msgRes = await fetch('/api/inbox/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_user_id: commInternalUserId, to_user_id: partnerId, company_id: commCompanyId, content }),
      })
      const msgData = await msgRes.json()
      if (msgData.success) {
        setPanelMessages(prev => ({ ...prev, [partnerId]: [...(prev[partnerId] ?? []), msgData.message] }))
        fetchCommConversations()
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setPanelUploading(prev => ({ ...prev, [partnerId]: false }))
      clearCommAttachment(partnerId)
    }
  }

  function toggleCommPin(partnerId: string) {
    if (!commInternalUserId) return
    setPinnedIds(prev => {
      const next = new Set(prev)
      if (next.has(partnerId)) next.delete(partnerId)
      else next.add(partnerId)
      localStorage.setItem(`pinned_convs_${commInternalUserId}`, JSON.stringify([...next]))
      return next
    })
  }

  async function openNewConvModal() {
    setNewConvOpen(true)
    setNewConvSearch('')
    setNewConvMembers([])
    setNewConvLoading(true)
    try {
      // companyId is set from /api/employee/dashboard — most reliable source
      const cid = companyId || commCompanyId
      if (!cid) return

      // Filter to own department so employee only sees their managers + colleagues
      const deptParam = departmentId ? `&department_id=${departmentId}` : ''
      const res = await fetch(`/api/team/members?company_id=${cid}${deptParam}`)
      const data = await res.json()
      if (data.success) {
        setNewConvMembers(
          (data.members ?? []).filter((m: { id: string; role: string }) =>
            m.id !== employeeId && (m.role === 'Manager' || m.role === 'Employee')
          )
        )
      }
    } catch {}
    finally { setNewConvLoading(false) }
  }

  function startNewConv(member: { id: string; full_name: string; role: string }) {
    setNewConvOpen(false)
    setNewConvSearch('')
    if (!conversations.find(c => c.partnerId === member.id)) {
      setConversations(prev => [
        { partnerId: member.id, partnerName: member.full_name, partnerRole: member.role, lastMessage: '', lastTime: new Date().toISOString(), unreadCount: 0 },
        ...prev,
      ])
    }
    openCommPanel(member.id)
    setCommTab('chat')
  }

  function handleSelectAnn(ann: CommAnnouncement) {
    setSelectedAnn(ann)
    if (!commInternalUserId || annReadIds.has(ann.id)) return
    const next = new Set(annReadIds)
    next.add(ann.id)
    setAnnReadIds(next)
    fetch('/api/inbox/announcements/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: commInternalUserId, announcement_ids: [ann.id] }),
    }).catch(() => {})
  }

  const filteredAnnouncements = annSearch
    ? announcements.filter(ann =>
        ann.title.toLowerCase().includes(annSearch.toLowerCase()) ||
        ann.content.toLowerCase().includes(annSearch.toLowerCase()))
    : announcements

  const visibleDeptIds = useMemo(() => new Set(departments.map(d => d.id)), [departments])
  const minTaskDate = minSelectableDate

  const filteredKanbanTasks = (col: Task['status']): Task[] => {
    if (!kanban) return []
    return (kanban[col] ?? [])
      .filter(t => visibleDeptIds.size === 0 || visibleDeptIds.has(t.department_id))
      .filter(t => Boolean(employeeId) && (t.assigned_user_id === employeeId || t.assigned_by === employeeId))
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

  const datesWithTasks = useMemo(() => {
    const dates = new Set<string>()
    if (!kanban || !employeeId) return dates
    for (const task of COLUMNS.flatMap(col => kanban[col] ?? [])) {
      if (visibleDeptIds.size > 0 && !visibleDeptIds.has(task.department_id)) continue
      if (task.assigned_user_id !== employeeId && task.assigned_by !== employeeId) continue
      const date = task.shift_id
        ? task.shift_date ?? shiftOptions.find(shift => shift.id === task.shift_id)?.shift_date ?? null
        : task.due_at?.slice(0, 10) ?? null
      if (date) dates.add(date)
    }
    return dates
  }, [employeeId, kanban, shiftOptions, visibleDeptIds])

  function renderDashboardTaskCard(task: Task, idx = 0) {
    const assignee = members.find(m => m.id === task.assigned_user_id)
    const priority = task.priority ? PRIORITY_COLORS[task.priority] : null
    const overdue = task.due_at && task.status !== 'Complete' && isDueOverdue(task.due_at)
    return (
      <div key={task.id} className="task-card" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', marginBottom: 8, animationDelay: `${idx * 60}ms` }}>
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
  const minTimelineDate = minSelectableDate
  const datesWithShifts = useMemo(() => {
    const dates = new Set<string>()
    for (const row of shiftMarkerRows) {
      for (const shift of row.shifts) dates.add(shift.shift_date)
    }
    return dates
  }, [shiftMarkerRows])

  function setTimelineByOffset(offset: number) {
    setTimelineDate(formatDateKey(addDays(new Date(`${timelineDate}T00:00:00`), offset)))
  }

  function setTimelineWeekByOffset(offset: number) {
    const anchor = new Date(`${timelineDate}T00:00:00`)
    const dow = (anchor.getDay() + 6) % 7
    const mon = addDays(anchor, -dow)
    setTimelineDate(formatDateKey(addDays(mon, offset * 7)))
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
            const rowDelay = `${(deptIdx * 10 + rowIdx) * 60}ms`
            return (
              <div key={`${row.user_id ?? row.department_id}_${rowIdx}`} className="timeline-row" style={{ display: 'flex', height: ROW_H, borderTop: isDeptBoundary ? EDGE : 'none', background: '#FFFFFF', animationDelay: rowDelay }}>
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
                      <div key={shift.id} className="shift-bar" style={{ position: 'absolute', top: 10, bottom: 10, left: `${left}%`, width: `${Math.max(width, 1.5)}%`, borderRadius: 999, background: `linear-gradient(90deg, #16A34A 0%, #22C55E 100%)`, boxShadow: '0 2px 8px rgba(22,163,74,0.30)', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', animationDelay: `${rowIdx * 80 + 100}ms` }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none', padding: '0 10px', letterSpacing: '0.01em' }}>
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
        /* ── Keyframes ── */
        @keyframes dotPulse {
          0%   { opacity: 1; transform: scale(1); }
          60%  { opacity: 0.4; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position: 600px 0; }
        }
        @keyframes shiftGrow {
          from { opacity: 0; transform: scaleX(0.4); }
          to   { opacity: 1; transform: scaleX(1); }
        }
        @keyframes kanbanFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGreen {
          0%, 100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.35); }
          50%       { box-shadow: 0 0 0 6px rgba(22,163,74,0); }
        }

        /* ── Page sections ── */
        .dash-header  { animation: fadeUp 0.45s ease both; }
        .dash-left    { animation: fadeUp 0.5s ease 0.05s both; }
        .dash-right   { animation: slideInRight 0.5s ease 0.08s both; }

        /* ── Cards ── */
        .panel-card {
          transition: box-shadow 0.25s ease, transform 0.25s ease;
        }
        .panel-card:hover {
          box-shadow: 0 12px 36px rgba(0,0,0,0.10), 0 0 0 1.5px rgba(22,163,74,0.15) !important;
          transform: translateY(-3px);
        }

        /* ── Shift bars ── */
        .shift-bar {
          transform-origin: left center;
          animation: shiftGrow 0.55s cubic-bezier(0.34,1.56,0.64,1) both;
          transition: filter 0.2s ease, transform 0.2s ease;
        }
        .shift-bar:hover {
          filter: brightness(1.12);
          transform: scaleY(1.08);
        }

        /* ── Shift timeline rows ── */
        .timeline-row {
          animation: fadeUp 0.38s ease both;
          transition: background 0.15s ease;
        }
        .timeline-row:hover { background: #F0FDF4 !important; }

        /* ── Kanban columns ── */
        .kanban-col {
          animation: kanbanFadeUp 0.42s ease both;
          transition: box-shadow 0.22s ease, transform 0.22s ease;
        }
        .kanban-col:hover {
          box-shadow: 0 6px 24px rgba(0,0,0,0.07) !important;
          transform: translateY(-2px);
        }

        /* ── Task cards ── */
        .task-card {
          transition: box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
          animation: kanbanFadeUp 0.32s ease both;
        }
        .task-card:hover {
          box-shadow: 0 6px 18px rgba(22,163,74,0.12) !important;
          border-color: rgba(22,163,74,0.35) !important;
          transform: translateY(-2px);
        }

        /* ── Comm panel ── */
        .emp-conv-card {
          transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }
        .emp-conv-card:hover {
          transform: translateX(3px);
          box-shadow: 2px 0 10px rgba(22,163,74,0.08);
        }
        .emp-ann-card {
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          animation: kanbanFadeUp 0.3s ease both;
        }
        .emp-ann-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(15,23,42,0.08) !important;
        }
        .emp-msg-bubble { animation: fadeUp 0.22s ease both; }

        /* ── Skeleton shimmer ── */
        .skeleton {
          background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
          background-size: 600px 100%;
          animation: shimmer 1.4s infinite linear;
          border-radius: 8px;
        }

        /* ── Misc interactive ── */
        .mark-btn { transition: background 0.15s ease, transform 0.12s ease; }
        .mark-btn:hover { transform: scale(1.05); }
        .feed-item { transition: background 0.15s ease, transform 0.15s ease; }
        .feed-item:hover { background: #F0FDF4 !important; transform: translateX(2px); }
        .stat-card { transition: box-shadow 0.22s ease, transform 0.22s ease; }
        .stat-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.10), 0 0 0 1.5px rgba(22,163,74,0.18) !important; transform: translateY(-3px) scale(1.015); }
      `}</style>
      <EmployeeSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '20px 28px', gap: 0 }}>
        {/* Page header */}
        <div className="dash-header" style={{ marginBottom: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Dashboard
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

        {/* Two-column layout: left = Schedule + Tasks, right = Chat/Announcements */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', paddingBottom: 24 }}>

          {/* LEFT column */}
          <div className="dash-left" style={{ flex: '0 0 calc(55% - 10px)', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF' }}>
              <Spinner dark /> Loading…
            </div>
          ) : (
            <>
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
                        <DashboardDatePicker value={timelineDate} onChange={setTimelineDate} markedDates={datesWithShifts} minDate={minTimelineDate} />
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
                      <Layers size={15} style={{ color: GREEN }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px' }}>Tasks</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button type="button" onClick={() => setTaskDate(formatDateKey(new Date()))} style={{ height: 38, padding: '0 14px', border: '1px solid #E2E8F0', borderRadius: 8, background: taskDate === formatDateKey(new Date()) ? GREEN : '#FFFFFF', color: taskDate === formatDateKey(new Date()) ? '#FFFFFF' : '#0F172A', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      Today
                    </button>
                    <button type="button" onClick={() => setTaskDate(formatDateKey(addDays(new Date(`${taskDate}T00:00:00`), -1)))} disabled={taskDate <= minTaskDate} style={{ width: 38, height: 38, borderRadius: 9, border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: taskDate <= minTaskDate ? 'default' : 'pointer', color: '#0F172A', opacity: taskDate <= minTaskDate ? 0.3 : 1 }}>
                      <ChevronLeft size={16} />
                    </button>
                    <DashboardDatePicker value={taskDate} onChange={setTaskDate} markedDates={datesWithTasks} minDate={minTaskDate} />
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
                            <div className="kanban-col" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#F7F8FA', borderRadius: 12, overflow: 'hidden', minHeight: 0, border: '1px solid #F0F1F3', animationDelay: `${colIdx * 80}ms` }}>
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
                                  tasks.map((t, i) => renderDashboardTaskCard(t, i))
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
          </div>{/* end left column */}

          {/* RIGHT column — Communication panel */}
          <div className="dash-right" style={{ flex: '0 0 calc(45% - 10px)', minWidth: 0, position: 'sticky', top: 0, maxHeight: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: 'calc(100vh - 100px)' }}>

              {/* Tab bar */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {([
                    { key: 'chat' as const,          label: 'Chat',          icon: <MessageSquare size={12} />, badge: unreadMessages },
                    { key: 'announcements' as const, label: 'Announcements', icon: <Megaphone size={12} />,     badge: unreadAnnCount },
                  ]).map(tab => {
                    const active = commTab === tab.key
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setCommTab(tab.key)}
                        style={{
                          padding: '5px 12px', borderRadius: '99px', cursor: 'pointer',
                          fontWeight: 600, fontSize: '0.775rem',
                          background: active ? DARK_BG : 'transparent',
                          border: active ? `2px solid ${DARK_BG}` : '1.5px solid #E5E7EB',
                          color: active ? '#FFFFFF' : '#374151',
                          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                          transition: 'all 0.13s ease',
                        }}
                      >
                        {tab.icon}
                        {tab.label}
                        {tab.badge > 0 && (
                          <span style={{ minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: ACCENT, color: '#fff', fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                {commTab === 'chat' && (
                  <button
                    onClick={openNewConvModal}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: ACCENT, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.775rem', color: '#fff', cursor: 'pointer', height: 34 }}
                  >
                    <SquarePen size={12} strokeWidth={2.5} /> New
                  </button>
                )}
              </div>

              {/* Chat panel */}
              {commTab === 'chat' && (
                <div style={{ flex: '1 1 0', minHeight: 300, display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)', gap: 8, overflow: 'hidden', padding: 10 }}>
                  {/* Conversations list */}
                  <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 10px 8px', flexShrink: 0 }}>
                      <div style={{ height: 32, display: 'flex', alignItems: 'center', gap: 6, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '0 9px' }}>
                        <Search size={12} color="#94A3B8" />
                        <input value={convSearch} onChange={e => setConvSearch(e.target.value)} placeholder="Search..." style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 11.5, color: '#0F172A', fontWeight: 500 }} />
                      </div>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '0 8px 8px' }}>
                      {filteredConversations.length === 0 ? (
                        <div style={{ height: 120, borderRadius: 10, background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 6, fontSize: 12, fontWeight: 600 }}>
                          <MessageSquare size={20} strokeWidth={1.5} />
                          {convSearch ? 'No results' : 'No conversations'}
                        </div>
                      ) : filteredConversations.map(conv => {
                        const active = openPanelIds.includes(conv.partnerId)
                        const isPinned = pinnedIds.has(conv.partnerId)
                        const previewText = conv.lastMessage.startsWith('[image:]') ? '📷 Photo'
                          : conv.lastMessage.match(/^\[file:(.+?)\]/) ? `📎 File`
                          : conv.lastMessage
                        return (
                          <button key={conv.partnerId} onClick={() => openCommPanel(conv.partnerId)} className="emp-conv-card"
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', background: active ? ACCENT_LIGHT : 'transparent', border: 'none', borderRadius: 9, cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: 2, borderLeft: active ? `3px solid ${ACCENT}` : '3px solid transparent' }}
                          >
                            <CommAvatar name={conv.partnerName} size={34} role={conv.partnerRole} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 3 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                                  <span style={{ fontWeight: conv.unreadCount > 0 ? 800 : 600, fontSize: 12, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.partnerName}</span>
                                  {isPinned && <Pin size={9} strokeWidth={2.5} style={{ color: ACCENT, flexShrink: 0 }} />}
                                </div>
                                <span style={{ fontSize: 10, color: '#9CA3AF', flexShrink: 0, fontWeight: 500 }}>{commFormatTime(conv.lastTime)}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                                <span style={{ fontSize: 11, color: conv.unreadCount > 0 ? '#374151' : '#9CA3AF', fontWeight: conv.unreadCount > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{previewText}</span>
                                {conv.unreadCount > 0 && (
                                  <div style={{ minWidth: 16, height: 16, borderRadius: 999, background: ACCENT, color: '#fff', fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', flexShrink: 0 }}>{conv.unreadCount}</div>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Message panels */}
                  <div style={{ minWidth: 0, minHeight: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {openPanelIds.length === 0 ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                        <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                          <div style={{ width: 44, height: 44, borderRadius: 14, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', color: ACCENT }}>
                            <MessageSquare size={20} strokeWidth={1.5} />
                          </div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 12, color: '#374151' }}>Select a conversation</p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: openPanelIds.length === 1 ? '1fr' : '1fr 1fr', gridTemplateRows: openPanelIds.length <= 2 ? '1fr' : '1fr 1fr', gap: 6 }}>
                        {openPanelIds.map((partnerId, idx) => {
                          const conv = conversations.find(c => c.partnerId === partnerId)
                          if (!conv) return null
                          const msgs = panelMessages[partnerId] ?? []
                          const input = panelInputs[partnerId] ?? ''
                          const sending = panelSending[partnerId] ?? false
                          const attachFile = panelAttachFile[partnerId] ?? null
                          const attachPreview = panelAttachPreview[partnerId] ?? null
                          const uploading = panelUploading[partnerId] ?? false
                          const isPinned = pinnedIds.has(partnerId)
                          const spanStyle: React.CSSProperties = openPanelIds.length === 3 && idx === 0 ? { gridRow: '1 / 3' } : {}
                          return (
                            <div key={partnerId} style={{ ...spanStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FFFFFF', borderRadius: 12, border: dragOver === partnerId ? `2px dashed ${ACCENT}` : '1px solid #E5E7EB', transition: 'border-color 0.15s' }}
                              onDragOver={e => { e.preventDefault(); setDragOver(partnerId) }}
                              onDragLeave={() => setDragOver(null)}
                              onDrop={e => { e.preventDefault(); setDragOver(null); const did = e.dataTransfer.getData('panelId'); if (did && did !== partnerId) swapCommPanels(did, partnerId); setDraggingPanel(null) }}
                            >
                              {/* Panel header */}
                              <div draggable onDragStart={e => { e.dataTransfer.setData('panelId', partnerId); setDraggingPanel(partnerId) }} onDragEnd={() => setDraggingPanel(null)}
                                style={{ padding: '8px 10px 0', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, cursor: openPanelIds.length > 1 ? 'grab' : 'default', userSelect: 'none' }}>
                                <CommAvatar name={conv.partnerName} size={26} role={conv.partnerRole} />
                                <span style={{ fontWeight: 800, fontSize: 12, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{conv.partnerName}</span>
                                <button onClick={() => toggleCommPin(partnerId)} title={isPinned ? 'Unpin' : 'Pin'}
                                  style={{ flexShrink: 0, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isPinned ? ACCENT_LIGHT : '#F8FAFC', border: isPinned ? `1.5px solid rgba(22,163,74,0.35)` : '1.5px solid #E2E8F0', borderRadius: 6, cursor: 'pointer', color: isPinned ? ACCENT : '#94A3B8' }}>
                                  {isPinned ? <PinOff size={9} strokeWidth={2.5} /> : <Pin size={9} strokeWidth={2.5} />}
                                </button>
                                <button onClick={() => closeCommPanel(partnerId)} title="Close"
                                  style={{ flexShrink: 0, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 6, cursor: 'pointer', color: '#94A3B8' }}>
                                  <X size={9} strokeWidth={2.5} />
                                </button>
                              </div>
                              <div style={{ height: 1, background: DARK_BG, margin: '6px 0 0', flexShrink: 0 }} />
                              {/* Messages */}
                              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {msgs.map(msg => {
                                  const isMine = msg.from_user_id === commInternalUserId
                                  const isImage = msg.content.startsWith('[image:]')
                                  const fileMatch = msg.content.match(/^\[file:(.+?)\](.+)$/)
                                  const isFile = Boolean(fileMatch)
                                  const imgUrl = isImage ? msg.content.slice('[image:]'.length) : null
                                  const fileName = fileMatch?.[1] ?? null
                                  const fileUrl = fileMatch?.[2] ?? null
                                  return (
                                    <div key={msg.id} className="emp-msg-bubble" style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 5 }}>
                                      {!isMine && <CommAvatar name={conv.partnerName} size={18} role={conv.partnerRole} />}
                                      {isImage && imgUrl ? (
                                        <div style={{ maxWidth: '65%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', gap: 2 }}>
                                          <a href={imgUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: 10, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                                            <img src={imgUrl} alt="attachment" style={{ display: 'block', maxWidth: '100%', maxHeight: 140, objectFit: 'cover' }} />
                                          </a>
                                          <span style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: 600 }}>{commFormatTime(msg.created_at)}</span>
                                        </div>
                                      ) : isFile && fileUrl ? (
                                        <div style={{ maxWidth: '70%', padding: '7px 9px', borderRadius: isMine ? '11px 11px 3px 11px' : '11px 11px 11px 3px', background: isMine ? ACCENT_LIGHT : '#FFFFFF', border: isMine ? `1px solid ${ACCENT}33` : '1px solid #EDF2F7' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <div style={{ width: 26, height: 26, borderRadius: 7, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={12} color={ACCENT} /></div>
                                            <div style={{ minWidth: 0 }}>
                                              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</p>
                                              <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={fileName ?? true} style={{ fontSize: 10, color: ACCENT, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2, textDecoration: 'none' }}><Download size={8} /> Download</a>
                                            </div>
                                          </div>
                                          <div style={{ fontSize: 9.5, marginTop: 3, color: '#94A3B8', fontWeight: 600, textAlign: isMine ? 'right' : 'left' }}>{commFormatTime(msg.created_at)}</div>
                                        </div>
                                      ) : (
                                        <div style={{ maxWidth: '70%', padding: '7px 10px', borderRadius: isMine ? '11px 11px 3px 11px' : '11px 11px 11px 3px', background: isMine ? ACCENT_LIGHT : '#FFFFFF', border: isMine ? `1px solid ${ACCENT}33` : '1px solid #EDF2F7', color: '#0F172A', fontSize: 12, fontWeight: 500, lineHeight: 1.5 }}>
                                          {msg.content}
                                          <div style={{ fontSize: 9.5, marginTop: 2, color: '#94A3B8', fontWeight: 600, textAlign: isMine ? 'right' : 'left' }}>{commFormatTime(msg.created_at)}</div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                                <div ref={el => { panelEndRefs.current[partnerId] = el }} />
                              </div>
                              {/* Attachment preview */}
                              {attachFile && (
                                <div style={{ padding: '4px 10px 0', background: '#FFFFFF', flexShrink: 0 }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '4px 8px', maxWidth: '100%' }}>
                                    {attachPreview ? (
                                      <img src={attachPreview} alt="preview" style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} />
                                    ) : (
                                      <div style={{ width: 26, height: 26, borderRadius: 6, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={12} color={ACCENT} /></div>
                                    )}
                                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{attachFile.name}</p>
                                    <button onClick={() => clearCommAttachment(partnerId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2, display: 'flex', flexShrink: 0 }}><X size={10} /></button>
                                  </div>
                                </div>
                              )}
                              <div style={{ height: 1, background: DARK_BG, flexShrink: 0 }} />
                              {/* Input bar */}
                              <div style={{ padding: '6px 8px', background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                <input type="file" accept="image/*" style={{ display: 'none' }} ref={el => { panelPhotoRefs.current[partnerId] = el }} onChange={e => { const f = e.target.files?.[0]; if (f) pickCommAttachment(partnerId, f) }} />
                                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" style={{ display: 'none' }} ref={el => { panelFileRefs.current[partnerId] = el }} onChange={e => { const f = e.target.files?.[0]; if (f) pickCommAttachment(partnerId, f) }} />
                                {!conv.partnerDeleted && (
                                  <button onClick={() => panelPhotoRefs.current[partnerId]?.click()} title="Send photo" style={{ flexShrink: 0, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', color: '#64748B' }}>
                                    <ImagePlus size={12} strokeWidth={2} />
                                  </button>
                                )}
                                {!conv.partnerDeleted && (
                                  <button onClick={() => panelFileRefs.current[partnerId]?.click()} title="Send file" style={{ flexShrink: 0, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', color: '#64748B' }}>
                                    <Paperclip size={11} strokeWidth={2} />
                                  </button>
                                )}
                                <input value={input} onChange={e => setPanelInputs(p => ({ ...p, [partnerId]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !conv.partnerDeleted) { e.preventDefault(); if (attachFile) uploadAndSendCommAttachment(partnerId); else handleCommSendMessage(partnerId) } }}
                                  placeholder={conv.partnerDeleted ? 'Account removed' : 'Message…'}
                                  disabled={conv.partnerDeleted}
                                  style={{ flex: 1, height: 30, padding: '0 9px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12, fontWeight: 500, outline: 'none', background: conv.partnerDeleted ? '#F8FAFC' : '#FFFFFF', color: conv.partnerDeleted ? '#94A3B8' : '#0F172A' }}
                                />
                                {!conv.partnerDeleted && (
                                  <button onClick={() => { if (attachFile) uploadAndSendCommAttachment(partnerId); else handleCommSendMessage(partnerId) }}
                                    disabled={sending || uploading || (!input.trim() && !attachFile)}
                                    style={{ height: 30, padding: '0 10px', background: (sending || uploading || (!input.trim() && !attachFile)) ? '#E5E7EB' : ACCENT, color: (sending || uploading || (!input.trim() && !attachFile)) ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 8, cursor: (sending || uploading || (!input.trim() && !attachFile)) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                                    {(sending || uploading) ? <CommSpinner size={10} /> : <Send size={10} />} Send
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Announcements panel */}
              {commTab === 'announcements' && (
                <div style={{ flex: '1 1 0', minHeight: 300, display: 'grid', gridTemplateColumns: '200px minmax(0,1fr)', gap: 8, overflow: 'hidden', padding: 10 }}>
                  {/* Left: list */}
                  <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 10px 0', flexShrink: 0 }}>
                      <div style={{ height: 30, display: 'flex', alignItems: 'center', gap: 6, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '0 9px' }}>
                        <Search size={12} color="#94A3B8" />
                        <input value={annSearch} onChange={e => setAnnSearch(e.target.value)} placeholder="Search..." style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 11.5, color: '#0F172A', fontWeight: 500 }} />
                      </div>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: 8 }}>
                      {filteredAnnouncements.length === 0 ? (
                        <div style={{ height: 120, borderRadius: 10, background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 6, fontSize: 12, fontWeight: 600 }}>
                          <Megaphone size={20} strokeWidth={1.5} />
                          {annSearch ? 'No results' : 'No announcements'}
                        </div>
                      ) : filteredAnnouncements.map((ann, i) => {
                        const unread = !annReadIds.has(ann.id)
                        const selected = selectedAnn?.id === ann.id
                        const deptName = ann.department_id ? (commDepartments.find(d => d.id === ann.department_id)?.name ?? 'Dept') : null
                        return (
                          <button key={ann.id} onClick={() => handleSelectAnn(ann)} className="emp-ann-card"
                            style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: 10, background: selected ? ACCENT_LIGHT : '#FFFFFF', border: selected ? `1.5px solid rgba(22,163,74,0.35)` : '1.5px solid #EDF2F7', borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: 6, boxShadow: selected ? `0 4px 12px rgba(22,163,74,0.08)` : '0 1px 3px rgba(0,0,0,0.03)', animationDelay: `${i * 0.04}s` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 6, height: 6, borderRadius: 999, background: unread ? ACCENT : '#CBD5E1', flexShrink: 0 }} />
                              <span style={{ fontWeight: unread ? 800 : 600, fontSize: 12, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{ann.title}</span>
                            </div>
                            <div style={{ paddingLeft: 12 }}>
                              <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 2, background: deptName ? ACCENT_LIGHT : '#F1F5F9', color: deptName ? ACCENT : '#64748B' }}>
                                {deptName ? null : <Globe size={8} />}
                                {deptName ?? 'Company-wide'}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {/* Right: detail */}
                  <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                    {selectedAnn ? (
                      <>
                        <div style={{ flexShrink: 0, background: '#FFFFFF', borderBottom: '1px solid #EDF2F7', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: ACCENT_LIGHT, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Megaphone size={15} />
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <h2 style={{ margin: 0, color: '#0F172A', fontSize: 14, lineHeight: 1.2, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedAnn.title}</h2>
                            <p style={{ margin: '2px 0 0', color: '#64748B', fontSize: 11, fontWeight: 600 }}>
                              {selectedAnn.created_by_name ?? 'Employee'} · {new Date(selectedAnn.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                          <span style={{ height: 24, padding: '0 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3, background: selectedAnn.department_id ? ACCENT_LIGHT : '#F1F5F9', color: selectedAnn.department_id ? ACCENT : '#64748B', flexShrink: 0 }}>
                            {selectedAnn.department_id ? null : <Globe size={9} />}
                            {selectedAnn.department_id ? (commDepartments.find(d => d.id === selectedAnn.department_id)?.name ?? 'Dept') : 'Company-wide'}
                          </span>
                        </div>
                        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px' }}>
                          <p style={{ margin: 0, color: '#334155', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{selectedAnn.content}</p>
                        </div>
                      </>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                        <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                          <div style={{ width: 44, height: 44, borderRadius: 14, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', color: ACCENT }}>
                            <Megaphone size={20} strokeWidth={1.5} />
                          </div>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 12 }}>Select an announcement</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>{/* end right column */}

        </div>{/* end two-column */}
      </main>

      {/* New conversation modal */}
      {newConvOpen && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setNewConvOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#FFFFFF', borderRadius: 20, boxShadow: '0 16px 48px rgba(0,0,0,0.18)', width: 360, maxHeight: 480, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {/* Header */}
            <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>New Conversation</span>
              <button onClick={() => setNewConvOpen(false)} style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #E5E7EB', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}>
                <X size={13} />
              </button>
            </div>
            {/* Search */}
            <div style={{ padding: '10px 14px', flexShrink: 0 }}>
              <div style={{ height: 34, display: 'flex', alignItems: 'center', gap: 7, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: '0 10px' }}>
                <Search size={13} color="#94A3B8" />
                <input
                  autoFocus
                  value={newConvSearch}
                  onChange={e => setNewConvSearch(e.target.value)}
                  placeholder="Search members…"
                  style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12.5, color: '#0F172A', fontWeight: 500 }}
                />
              </div>
            </div>
            {/* Member list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 12px' }}>
              {newConvLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner size={20} dark /></div>
              ) : (() => {
                const filtered = newConvSearch
                  ? newConvMembers.filter(m => m.full_name.toLowerCase().includes(newConvSearch.toLowerCase()))
                  : newConvMembers
                if (filtered.length === 0) return (
                  <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
                    {newConvSearch ? 'No results' : 'No members found'}
                  </div>
                )
                return filtered.map(m => (
                  <button
                    key={m.id}
                    onClick={() => startNewConv(m)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', border: 'none', background: 'transparent', borderRadius: 10, cursor: 'pointer', textAlign: 'left', marginBottom: 2 }}
                    onMouseEnter={e => { e.currentTarget.style.background = ACCENT_LIGHT }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <CommAvatar name={m.full_name} size={34} role={m.role} />
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name}</p>
                  </button>
                ))
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
