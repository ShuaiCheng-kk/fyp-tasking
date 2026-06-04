'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ChevronLeft, ChevronRight, Calendar,
  Briefcase, CheckCircle, Clock, Eye,
  Zap, AlertTriangle, Building2, Plus, Pencil, Trash2, Users, Copy, Repeat, Upload,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import OwnerSidebar from '@/components/OwnerSidebar'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'
import { Task } from '@/types/Task'

// ─── Local types ──────────────────────────────────────────────────────────────

type TaskStats = {
  assigned: number
  inProgress: number
  review: number
  complete: number
}

type ActivityFeedEvent = {
  type: 'shift_started' | 'task_updated' | 'shift_uncovered'
  actor_name: string
  department: string
  timestamp: string
  description: string
}

type Department = {
  id: string
  name: string
  company_id?: string
  created_at?: string
}

type TeamMember = {
  id: string
  full_name: string
  role: string
  department_id: string | null
}

type DepartmentManagerAssignment = {
  department_id: string
  manager_id: string
  manager_name: string
}

type Company = {
  id: string
  name: string
  plan: string
}

type ShiftFormState = {
  title: string
  instruction: string
  shift_date: string
  start_time: string
  end_time: string
  assigned_user_id: string
  acceptance_deadline_at: string
  recurrence_rule: 'daily' | 'weekly' | 'custom'
  recurrence_end_date: string
  custom_interval_days: number
  duplicate_shift_date: string
  duplicate_start_time: string
  duplicate_end_time: string
}

function parseDepartmentImportCsv(text: string): string[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const withoutHeader = lines[0]?.toLowerCase().includes('department') ? lines.slice(1) : lines
  return [...new Set(withoutHeader.map(line => line.split(',')[0]?.trim()).filter(Boolean))]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + (m || 0)
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

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const DEPT_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899', '#F97316', '#EF4444']
function deptColor(deptId: string): string {
  let h = 0
  for (let i = 0; i < deptId.length; i++) h = deptId.charCodeAt(i) + ((h << 5) - h)
  return DEPT_COLORS[Math.abs(h) % DEPT_COLORS.length]
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return ''
  return value.slice(0, 16)
}

function defaultShiftForm(date: string): ShiftFormState {
  return {
    title: '',
    instruction: '',
    shift_date: date,
    start_time: '09:00',
    end_time: '17:00',
    assigned_user_id: '',
    acceptance_deadline_at: '',
    recurrence_rule: 'weekly',
    recurrence_end_date: '',
    custom_interval_days: 1,
    duplicate_shift_date: date,
    duplicate_start_time: '09:00',
    duplicate_end_time: '17:00',
  }
}

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

const modalInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #E5E7EB',
  borderRadius: '8px',
  fontSize: '0.9375rem',
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#FFFFFF',
}

const modalLabelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  fontSize: '0.875rem',
  color: '#374151',
  marginBottom: '8px',
}

function InlineError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626', lineHeight: 1.5 }}>
      {message}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, accent, loading,
}: {
  label: string
  value: number
  icon: React.ReactNode
  accent: string
  loading: boolean
}) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '14px',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', letterSpacing: '0.02em', textTransform: 'uppercase' }}>{label}</span>
        <div style={{ width: 30, height: 30, borderRadius: '8px', background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      {loading ? (
        <div style={{ height: 32, display: 'flex', alignItems: 'center' }}><Spinner size={18} dark /></div>
      ) : (
        <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value.toLocaleString()}</span>
      )}
    </div>
  )
}

// ─── Plan badge popover ───────────────────────────────────────────────────────

function PlanBadge({
  plan,
  currentCompanyId,
  headerText,
}: {
  plan: string
  currentCompanyId: string
  headerText: string
}) {
  const [open, setOpen] = useState(false)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [upgradeError, setUpgradeError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isPro = plan === 'Paid' || plan === 'Pro'

  const handlePlanChange = async (newPlan: 'Free' | 'Paid') => {
    if (!currentCompanyId) return
    setUpgradeLoading(true); setUpgradeError('')
    try {
      const res = await fetch('/api/company/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: currentCompanyId, plan: newPlan }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setOpen(false)
      window.location.reload()
    } catch (err) {
      setUpgradeError(err instanceof Error ? err.message : 'Failed to update plan')
    } finally {
      setUpgradeLoading(false)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '4px 10px',
          borderRadius: '99px',
          fontSize: '0.8rem',
          fontWeight: 600,
          background: isPro ? 'rgba(16,185,129,0.18)' : 'rgba(156,163,175,0.18)',
          color: isPro ? '#059669' : headerText,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {isPro ? 'Pro' : 'Free'}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          background: '#FFFFFF', border: '1px solid #E5E7EB',
          borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          minWidth: '220px', zIndex: 50, padding: '16px',
        }}>
          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827', margin: '0 0 6px' }}>
            Current plan: <span style={{ color: isPro ? '#059669' : '#6B7280' }}>{isPro ? 'Pro' : 'Free'}</span>
          </p>
          <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: '0 0 12px', lineHeight: 1.5 }}>
            {isPro ? 'You have access to all Pro features.' : 'Upgrade to Pro for advanced features.'}
          </p>
          {upgradeError && (
            <p style={{ fontSize: '0.8rem', color: '#DC2626', margin: '0 0 10px' }}>{upgradeError}</p>
          )}
          {isPro ? (
            <button
              onClick={() => handlePlanChange('Free')}
              disabled={upgradeLoading}
              style={{ width: '100%', padding: '8px', background: '#F3F4F6', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.8125rem', color: '#374151', cursor: 'pointer', opacity: upgradeLoading ? 0.6 : 1 }}
            >
              {upgradeLoading ? <Spinner size={13} dark /> : 'Downgrade to Free'}
            </button>
          ) : (
            <button
              onClick={() => handlePlanChange('Paid')}
              disabled={upgradeLoading}
              style={{ width: '100%', padding: '8px', background: '#059669', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: 'pointer', opacity: upgradeLoading ? 0.6 : 1 }}
            >
              {upgradeLoading ? <Spinner size={13} /> : 'Upgrade to Pro'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const router = useRouter()

  const [userId,         setUserId]         = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [companyId,      setCompanyId]      = useState('')
  const [ownerName,      setOwnerName]      = useState('')
  const [companyName,    setCompanyName]    = useState('')
  const [companies,      setCompanies]      = useState<Company[]>([])
  const [currentPlan,    setCurrentPlan]    = useState('Free')
  const [dashboardRole,  setDashboardRole]  = useState('')
  const [initialReady,   setInitialReady]   = useState(false)
  const [headerTheme] = useState<{ bg: string; text: string; border: string }>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('tasking_user_role') === 'Partner') {
      return { bg: '#FFFFFF', text: '#1C1C1E', border: '1px solid #E5E7EB' }
    }
    return { bg: '#1C1C1E', text: '#FFFFFF', border: 'none' }
  })
  const [removalOverlay, setRemovalOverlay] = useState<{ companyName: string } | null>(null)
  const [dropdownOpen,   setDropdownOpen]   = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Task stats
  const [taskStats,        setTaskStats]        = useState<TaskStats | null>(null)
  const [taskStatsLoading, setTaskStatsLoading] = useState(false)
  const [todayShiftCount,  setTodayShiftCount]  = useState(0)

  // Activity feed
  const [activityFeed,        setActivityFeed]        = useState<ActivityFeedEvent[]>([])
  const [activityFeedLoading, setActivityFeedLoading] = useState(false)

  // Departments and members for shift assignment
  const [departments,          setDepartments]          = useState<Department[]>([])
  const [members,              setMembers]              = useState<TeamMember[]>([])
  const [departmentManagers,    setDepartmentManagers]   = useState<DepartmentManagerAssignment[]>([])
  const [assignmentDataLoading, setAssignmentDataLoading] = useState(false)

  // Timeline
  const [timelineRows,    setTimelineRows]    = useState<TimelineRow[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineView,    setTimelineView]    = useState<'global' | 'dept'>('global')
  const [timelineDate,    setTimelineDate]    = useState(() => formatDateKey(new Date()))

  const [assignTarget, setAssignTarget] = useState<{ member: TeamMember; department: Department } | null>(null)
  const [selectedShift, setSelectedShift] = useState<{ shift: TimelineShiftBlock; row: TimelineRow } | null>(null)
  const [selectedShiftTasks, setSelectedShiftTasks] = useState<Task[]>([])
  const [selectedShiftTasksLoading, setSelectedShiftTasksLoading] = useState(false)
  const [shiftForm, setShiftForm] = useState<ShiftFormState>(() => defaultShiftForm(timelineDate))
  const [shiftFormLoading, setShiftFormLoading] = useState(false)
  const [shiftFormError, setShiftFormError] = useState('')
  const [shiftFormCanOverride, setShiftFormCanOverride] = useState(false)
  const [scheduleScope, setScheduleScope] = useState<'day' | 'week'>('day')
  const [scheduleActionLoading, setScheduleActionLoading] = useState(false)
  const [scheduleActionError, setScheduleActionError] = useState('')
  const [undoLoading, setUndoLoading] = useState(false)
  const [departmentModal, setDepartmentModal] = useState<'add' | 'edit' | 'delete' | null>(null)
  const [activeDepartment, setActiveDepartment] = useState<Department | null>(null)
  const [departmentNameInput, setDepartmentNameInput] = useState('')
  const [departmentActionLoading, setDepartmentActionLoading] = useState(false)
  const [departmentActionError, setDepartmentActionError] = useState('')
  const [departmentImportOpen, setDepartmentImportOpen] = useState(false)
  const [departmentImportRows, setDepartmentImportRows] = useState<string[]>([])
  const [departmentImportLoading, setDepartmentImportLoading] = useState(false)
  const [departmentImportError, setDepartmentImportError] = useState('')
  const [departmentImportResult, setDepartmentImportResult] = useState('')
  const [managerModalDepartment, setManagerModalDepartment] = useState<Department | null>(null)
  const [selectedManagerId, setSelectedManagerId] = useState('')
  const [managerActionLoading, setManagerActionLoading] = useState(false)
  const [managerActionError, setManagerActionError] = useState('')

  const todayStr = formatDateKey(new Date())
  const minTimelineDate = formatDateKey(addDays(new Date(), -2))
  const maxTimelineDate = formatDateKey(addDays(new Date(), 7))
  const canGoPrevious = timelineDate > minTimelineDate
  const canGoNext = timelineDate < maxTimelineDate
  const selectedTimelineDate = new Date(`${timelineDate}T00:00:00`)

  // ── Header theme ───────────────────────────────────────────────────────────

  // ── Click outside dropdown ─────────────────────────────────────────────────

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
            if (d.user?.full_name) setOwnerName(d.user.full_name)
            if (d.user?.id) setInternalUserId(d.user.id)
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
    } catch {}
    finally { setTaskStatsLoading(false); setActivityFeedLoading(false) }
  }, [])

  useEffect(() => {
    if (!companyId) return
    const timer = window.setTimeout(() => { void fetchDashboardData(companyId) }, 0)
    return () => window.clearTimeout(timer)
  }, [companyId, fetchDashboardData])

  const fetchAssignmentData = useCallback(async (cid: string) => {
    if (!cid) return
    setAssignmentDataLoading(true)
    try {
      const [deptRes, memberRes, managerRes] = await Promise.all([
        fetch(`/api/company/departments?company_id=${cid}`),
        fetch(`/api/team/members?company_id=${cid}`),
        fetch(`/api/team/department-manager?company_id=${cid}`),
      ])
      const deptData = await deptRes.json()
      const memberData = await memberRes.json()
      const managerData = await managerRes.json()
      if (deptData.success) setDepartments(deptData.departments ?? [])
      if (managerData.success) setDepartmentManagers(managerData.assignments ?? [])
      if (memberData.success) {
        setMembers((memberData.members ?? []).filter((member: TeamMember) =>
          ['Manager', 'Employee', 'Casual Worker'].includes(member.role),
        ))
      }
    } catch {
      setDepartments([])
      setMembers([])
      setDepartmentManagers([])
    } finally {
      setAssignmentDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!companyId) return
    const timer = window.setTimeout(() => { void fetchAssignmentData(companyId) }, 0)
    return () => window.clearTimeout(timer)
  }, [companyId, fetchAssignmentData])

  // Timeline fetch

  const fetchTimeline = useCallback(async (cid: string, date: string) => {
    if (!cid) return
    setTimelineLoading(true)
    try {
      const res = await fetch(`/api/shift?company_id=${cid}&date_from=${date}&date_to=${date}`)
      const data = await res.json()
      if (data.success) {
        setTimelineRows(data.rows ?? [])
        const allShifts: TimelineShiftBlock[] = (data.rows ?? []).flatMap((r: TimelineRow) => r.shifts)
        setTodayShiftCount(allShifts.length)
      }
    } catch {}
    finally { setTimelineLoading(false) }
  }, [])

  useEffect(() => {
    if (!companyId) return
    const timer = window.setTimeout(() => { void fetchTimeline(companyId, timelineDate) }, 0)
    return () => window.clearTimeout(timer)
  }, [companyId, timelineDate, fetchTimeline])

  const changeTimelineDate = (days: number) => {
    const next = formatDateKey(addDays(selectedTimelineDate, days))
    if (next < minTimelineDate || next > maxTimelineDate) return
    setTimelineDate(next)
  }

  // ── Timeline rendering ─────────────────────────────────────────────────────

  const PERSON_COL = 172
  const ROW_H = 62
  const TIME_START = 7 * 60   // 07:00
  const TIME_END   = 23 * 60  // 23:00
  const HOURS      = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]

  function positionForTime(minutes: number, segmentStart = TIME_START, segmentEnd = TIME_END): number {
    const segmentSpan = segmentEnd - segmentStart
    return ((Math.max(segmentStart, Math.min(segmentEnd, minutes)) - segmentStart) / segmentSpan) * 100
  }

  function renderTimeAxis(segmentStartHour: number, segmentEndHour: number) {
    const segmentStart = segmentStartHour * 60
    const segmentEnd = segmentEndHour * 60
    const hours = HOURS.filter(hour => hour >= segmentStartHour && hour <= segmentEndHour)
    return (
      <div style={{ display: 'flex', background: '#1C1C1E' }}>
        <div style={{ width: PERSON_COL, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)', height: 32, display: 'flex', alignItems: 'center', paddingLeft: 12, boxSizing: 'border-box' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'rgba(255,255,255,0.72)' }}>
            {segmentStartHour}:00-{segmentEndHour}:00
          </span>
        </div>
        <div style={{ flex: 1, position: 'relative', height: 32 }}>
          {hours.map((hour, index) => (
            <span
              key={hour}
              style={{
                position: 'absolute',
                left: `${positionForTime(hour * 60, segmentStart, segmentEnd)}%`,
                top: '50%',
                transform: index === 0 ? 'translateY(-50%)' : index === hours.length - 1 ? 'translate(-100%, -50%)' : 'translate(-50%, -50%)',
                fontSize: '0.7rem',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.55)',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            >
              {`${hour}:00`}
            </span>
          ))}
        </div>
      </div>
    )
  }

  function renderTimelineRows(rows: TimelineRow[], segmentStart = TIME_START, segmentEnd = TIME_END) {
    if (rows.length === 0) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', color: '#9CA3AF', fontSize: '0.875rem' }}>
          No shifts scheduled for this date
        </div>
      )
    }
    return rows.map((row, idx) => (
      <div key={`${row.user_id ?? row.department_id}_${idx}`} style={{ display: 'flex', height: ROW_H, borderTop: '1px solid #E5E7EB', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
        {/* Person column */}
        <div style={{ width: PERSON_COL, flexShrink: 0, borderRight: '1px solid #E5E7EB', padding: '6px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: deptColor(row.department_id), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 700, fontSize: '0.65rem', flexShrink: 0 }}>
              {row.full_name.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.full_name}
            </span>
          </div>
          <div style={{ paddingLeft: 32, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6B7280', background: '#F1F5F9', padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase' }}>
              {row.role}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.department_name}
            </span>
          </div>
        </div>
        {/* Gantt bar area */}
        <div style={{ flex: 1, position: 'relative', background: 'inherit' }}>
          {/* Hour grid lines */}
          {HOURS.filter(h => h * 60 > segmentStart && h * 60 < segmentEnd).map(h => (
            <div key={h} style={{ position: 'absolute', left: `${positionForTime(h * 60, segmentStart, segmentEnd)}%`, top: 0, bottom: 0, borderLeft: '1px solid #EEF2F7', pointerEvents: 'none' }} />
          ))}
          {row.shifts.map(shift => {
            const startMin = timeToMinutes(shift.start_time)
            const endMin   = timeToMinutes(shift.end_time)
            if (endMin <= segmentStart || startMin >= segmentEnd) return null
            const left  = positionForTime(startMin, segmentStart, segmentEnd)
            const right = positionForTime(endMin, segmentStart, segmentEnd)
            const width = right - left
            if (width <= 0) return null
            const color = deptColor(shift.department_id)
            const isPublished = shift.publication_status === 'published'
            const isResponseOverdue = Boolean(
              isPublished &&
              shift.acceptance_deadline_at &&
              shift.assignment_status === 'assigned' &&
              new Date(shift.acceptance_deadline_at).getTime() < Date.now(),
            )
            return (
              <div
                key={shift.id}
                onClick={() => openShiftDetail(shift, row)}
                title={`${row.full_name} · ${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)} · ${row.department_name}`}
                style={{
                  position: 'absolute',
                  left: `calc(${left}% + 2px)`,
                  width: `calc(${Math.max(width, 1.5)}% - 4px)`,
                  top: 8, bottom: 8,
                  background: isResponseOverdue ? '#F97316' : color,
                  borderRadius: 6,
                  border: isPublished ? 'none' : '1px dashed rgba(17,24,39,0.35)',
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  overflow: 'hidden',
                  boxShadow: isPublished ? '0 2px 6px rgba(0,0,0,0.18)' : 'none',
                  opacity: isPublished ? 1 : 0.72,
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
                </span>
                <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#FFFFFF', flexShrink: 0 }}>
                  {isResponseOverdue ? 'LATE' : isPublished ? 'PUB' : 'DRAFT'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    ))
  }

  // Department view groups rows by dept
  function renderDeptView(segmentStart = TIME_START, segmentEnd = TIME_END) {
    const grouped: Record<string, { name: string; rows: TimelineRow[] }> = {}
    for (const row of timelineRows) {
      if (!grouped[row.department_id]) grouped[row.department_id] = { name: row.department_name, rows: [] }
      grouped[row.department_id].rows.push(row)
    }
    const deptIds = Object.keys(grouped)
    if (deptIds.length === 0) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', color: '#9CA3AF', fontSize: '0.875rem' }}>
          No shifts scheduled for this date
        </div>
      )
    }
    return deptIds.map(deptId => (
      <div key={deptId}>
        {/* Dept header row */}
        <div style={{ display: 'flex', background: '#F8FAFC', borderTop: '1px solid #E5E7EB' }}>
          <div style={{ width: PERSON_COL, flexShrink: 0, borderRight: '1px solid #E5E7EB', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: deptColor(deptId) }} />
            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#374151' }}>{grouped[deptId].name}</span>
          </div>
          <div style={{ flex: 1 }} />
        </div>
        {renderTimelineRows(grouped[deptId].rows, segmentStart, segmentEnd)}
      </div>
    ))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const refreshShiftViews = async () => {
    if (!companyId) return
    await Promise.all([
      fetchTimeline(companyId, timelineDate),
      fetchDashboardData(companyId),
    ])
  }

  const openAssignShift = (member: TeamMember, department: Department) => {
    setAssignTarget({ member, department })
    setSelectedShift(null)
    setShiftForm({
      ...defaultShiftForm(timelineDate),
      assigned_user_id: member.id,
    })
    setShiftFormError('')
    setShiftFormCanOverride(false)
  }

  const openShiftDetail = (shift: TimelineShiftBlock, row: TimelineRow) => {
    setSelectedShift({ shift, row })
    setAssignTarget(null)
    setSelectedShiftTasks([])
    setSelectedShiftTasksLoading(true)
    fetch(`/api/task?company_id=${companyId}&shift_id=${shift.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setSelectedShiftTasks(data.tasks ?? [])
      })
      .catch(() => setSelectedShiftTasks([]))
      .finally(() => setSelectedShiftTasksLoading(false))
    setShiftForm({
      title: shift.title ?? '',
      instruction: shift.instruction ?? '',
      shift_date: shift.shift_date,
      start_time: shift.start_time.slice(0, 5),
      end_time: shift.end_time.slice(0, 5),
      assigned_user_id: row.user_id ?? '',
      acceptance_deadline_at: toDateTimeLocal(shift.acceptance_deadline_at),
      recurrence_rule: shift.recurrence_rule ?? 'weekly',
      recurrence_end_date: '',
      custom_interval_days: 1,
      duplicate_shift_date: formatDateKey(addDays(new Date(`${shift.shift_date}T00:00:00`), 1)),
      duplicate_start_time: shift.start_time.slice(0, 5),
      duplicate_end_time: shift.end_time.slice(0, 5),
    })
    setShiftFormError('')
    setShiftFormCanOverride(false)
  }

  const validateShiftForm = () => {
    if (!shiftForm.shift_date) return 'Shift date is required'
    if (!shiftForm.start_time || !shiftForm.end_time) return 'Start and end time are required'
    if (shiftForm.start_time >= shiftForm.end_time) return 'Start time must be before end time'
    if (shiftForm.shift_date < minTimelineDate || shiftForm.shift_date > maxTimelineDate) {
      return 'Shift date must be within the allowed timeline window'
    }
    if (shiftForm.acceptance_deadline_at && shiftForm.acceptance_deadline_at > `${shiftForm.shift_date}T${shiftForm.start_time}`) {
      return 'Respond by must be before the shift starts'
    }
    return ''
  }

  const handleCreateShift = async () => {
    if (!assignTarget || !companyId || !internalUserId) return
    const error = validateShiftForm()
    if (error) { setShiftFormError(error); return }
    setShiftFormLoading(true)
    setShiftFormError('')
    try {
      const res = await fetch('/api/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          department_id: assignTarget.department.id,
          title: shiftForm.title || null,
          instruction: shiftForm.instruction || null,
          shift_date: shiftForm.shift_date,
          start_time: shiftForm.start_time,
          end_time: shiftForm.end_time,
          created_by: internalUserId,
          assigned_user_id: shiftForm.assigned_user_id,
          acceptance_deadline_at: shiftForm.acceptance_deadline_at || null,
          override_clopening: shiftFormCanOverride,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to assign shift')
      setAssignTarget(null)
      setShiftFormCanOverride(false)
      setTimelineDate(shiftForm.shift_date)
      await refreshShiftViews()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign shift'
      setShiftFormCanOverride(message.startsWith('CLOPENING_CONFLICT:'))
      setShiftFormError(message.replace('CLOPENING_CONFLICT: ', ''))
    } finally {
      setShiftFormLoading(false)
    }
  }

  const handleUpdateShift = async () => {
    if (!selectedShift || !companyId || !internalUserId) return
    const error = validateShiftForm()
    if (error) { setShiftFormError(error); return }
    setShiftFormLoading(true)
    setShiftFormError('')
    try {
      const res = await fetch(`/api/shift/${selectedShift.shift.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: shiftForm.title || null,
          instruction: shiftForm.instruction || null,
          shift_date: shiftForm.shift_date,
          start_time: shiftForm.start_time,
          end_time: shiftForm.end_time,
          assigned_user_id: shiftForm.assigned_user_id || null,
          assigned_by: internalUserId,
          acceptance_deadline_at: shiftForm.acceptance_deadline_at || null,
          override_clopening: shiftFormCanOverride,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update shift')
      setSelectedShift(null)
      setShiftFormCanOverride(false)
      setTimelineDate(shiftForm.shift_date)
      await refreshShiftViews()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update shift'
      setShiftFormCanOverride(message.startsWith('CLOPENING_CONFLICT:'))
      setShiftFormError(message.replace('CLOPENING_CONFLICT: ', ''))
    } finally {
      setShiftFormLoading(false)
    }
  }

  const handleDeleteShift = async () => {
    if (!selectedShift || !internalUserId) return
    setShiftFormLoading(true)
    setShiftFormError('')
    try {
      const res = await fetch(`/api/shift/${selectedShift.shift.id}?actor_id=${internalUserId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to delete shift')
      setSelectedShift(null)
      await refreshShiftViews()
    } catch (err) {
      setShiftFormError(err instanceof Error ? err.message : 'Failed to delete shift')
    } finally {
      setShiftFormLoading(false)
    }
  }

  const handleUndoShiftAction = async () => {
    if (!companyId || !internalUserId) return
    setUndoLoading(true)
    setScheduleActionError('')
    try {
      const res = await fetch('/api/shift/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, actor_id: internalUserId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to undo')
      await refreshShiftViews()
    } catch (err) {
      setScheduleActionError(err instanceof Error ? err.message : 'Failed to undo')
    } finally {
      setUndoLoading(false)
    }
  }

  const handleSchedulePublication = async (publicationStatus: 'draft' | 'published') => {
    if (!companyId) return
    setScheduleActionLoading(true)
    setScheduleActionError('')
    const dateFrom = scheduleScope === 'day' ? timelineDate : timelineDate
    const dateTo = scheduleScope === 'day' ? timelineDate : formatDateKey(addDays(selectedTimelineDate, 6))
    try {
      const res = await fetch('/api/shift/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          date_from: dateFrom,
          date_to: dateTo,
          publication_status: publicationStatus,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update schedule')
      await refreshShiftViews()
    } catch (err) {
      setScheduleActionError(err instanceof Error ? err.message : 'Failed to update schedule')
    } finally {
      setScheduleActionLoading(false)
    }
  }

  const handleDuplicateShift = async () => {
    if (!selectedShift || !internalUserId) return
    if (!shiftForm.duplicate_shift_date || !shiftForm.duplicate_start_time || !shiftForm.duplicate_end_time) {
      setShiftFormError('Duplicate date and time are required')
      return
    }
    if (shiftForm.duplicate_start_time >= shiftForm.duplicate_end_time) {
      setShiftFormError('Duplicate start time must be before end time')
      return
    }
    setShiftFormLoading(true)
    setShiftFormError('')
    try {
      const res = await fetch(`/api/shift/${selectedShift.shift.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_date: shiftForm.duplicate_shift_date,
          start_time: shiftForm.duplicate_start_time,
          end_time: shiftForm.duplicate_end_time,
          assigned_user_id: shiftForm.assigned_user_id || null,
          created_by: internalUserId,
          override_clopening: shiftFormCanOverride,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to duplicate shift')
      setTimelineDate(shiftForm.duplicate_shift_date)
      setSelectedShift(null)
      setShiftFormCanOverride(false)
      await refreshShiftViews()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to duplicate shift'
      setShiftFormCanOverride(message.startsWith('CLOPENING_CONFLICT:'))
      setShiftFormError(message.replace('CLOPENING_CONFLICT: ', ''))
    } finally {
      setShiftFormLoading(false)
    }
  }

  const handleCreateRecurrence = async () => {
    if (!selectedShift || !internalUserId) return
    if (!shiftForm.recurrence_end_date) {
      setShiftFormError('Recurrence end date is required')
      return
    }
    setShiftFormLoading(true)
    setShiftFormError('')
    try {
      const res = await fetch(`/api/shift/${selectedShift.shift.id}/recurrence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recurrence_rule: shiftForm.recurrence_rule,
          recurrence_end_date: shiftForm.recurrence_end_date,
          custom_interval_days: shiftForm.custom_interval_days,
          assigned_user_id: shiftForm.assigned_user_id || null,
          created_by: internalUserId,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to create recurring shifts')
      setSelectedShift(null)
      await refreshShiftViews()
    } catch (err) {
      setShiftFormError(err instanceof Error ? err.message : 'Failed to create recurring shifts')
    } finally {
      setShiftFormLoading(false)
    }
  }

  const openAddDepartment = () => {
    setDepartmentModal('add')
    setActiveDepartment(null)
    setDepartmentNameInput('')
    setDepartmentActionError('')
  }

  const openDepartmentImport = () => {
    setDepartmentImportOpen(true)
    setDepartmentImportRows([])
    setDepartmentImportError('')
    setDepartmentImportResult('')
  }

  const handleDepartmentImportFile = async (file: File | null) => {
    setDepartmentImportError('')
    setDepartmentImportResult('')
    if (!file) return
    const rows = parseDepartmentImportCsv(await file.text())
    setDepartmentImportRows(rows)
    if (rows.length === 0) setDepartmentImportError('No valid departments found.')
  }

  const confirmDepartmentImport = async () => {
    if (!companyId || departmentImportRows.length === 0) return
    setDepartmentImportLoading(true)
    setDepartmentImportError('')
    setDepartmentImportResult('')
    try {
      const res = await fetch('/api/import/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, departments: departmentImportRows }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to import departments')
      const created = data.result?.created?.length ?? 0
      const skipped = data.result?.skipped?.length ?? 0
      setDepartmentImportResult(`${created} department(s) created. ${skipped} skipped.`)
      await fetchAssignmentData(companyId)
    } catch (err) {
      setDepartmentImportError(err instanceof Error ? err.message : 'Failed to import departments')
    } finally {
      setDepartmentImportLoading(false)
    }
  }

  const openEditDepartment = (department: Department) => {
    setDepartmentModal('edit')
    setActiveDepartment(department)
    setDepartmentNameInput(department.name)
    setDepartmentActionError('')
  }

  const openDeleteDepartment = (department: Department) => {
    setDepartmentModal('delete')
    setActiveDepartment(department)
    setDepartmentNameInput(department.name)
    setDepartmentActionError('')
  }

  const openManagerModal = (department: Department) => {
    const current = departmentManagers.find(item => item.department_id === department.id)
    setManagerModalDepartment(department)
    setSelectedManagerId(current?.manager_id ?? '')
    setManagerActionError('')
  }

  const handleSaveDepartment = async () => {
    if (!companyId) return
    const name = departmentNameInput.trim()
    if (!name) { setDepartmentActionError('Department name is required'); return }
    setDepartmentActionLoading(true)
    setDepartmentActionError('')
    try {
      const isEdit = departmentModal === 'edit'
      const res = await fetch(isEdit ? '/api/company/update-department' : '/api/company/create-department', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit
          ? { department_id: activeDepartment?.id, name }
          : { company_id: companyId, name }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save department')
      setDepartmentModal(null)
      setActiveDepartment(null)
      await fetchAssignmentData(companyId)
    } catch (err) {
      setDepartmentActionError(err instanceof Error ? err.message : 'Failed to save department')
    } finally {
      setDepartmentActionLoading(false)
    }
  }

  const handleDeleteDepartment = async () => {
    if (!companyId || !activeDepartment) return
    setDepartmentActionLoading(true)
    setDepartmentActionError('')
    try {
      const res = await fetch('/api/company/delete-department', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: activeDepartment.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to delete department')
      setDepartmentModal(null)
      setActiveDepartment(null)
      await Promise.all([fetchAssignmentData(companyId), fetchTimeline(companyId, timelineDate)])
    } catch (err) {
      setDepartmentActionError(err instanceof Error ? err.message : 'Failed to delete department')
    } finally {
      setDepartmentActionLoading(false)
    }
  }

  const handleSetDepartmentManager = async () => {
    if (!companyId || !internalUserId || !managerModalDepartment || !selectedManagerId) return
    setManagerActionLoading(true)
    setManagerActionError('')
    try {
      const res = await fetch('/api/team/department-manager', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          department_id: managerModalDepartment.id,
          manager_id: selectedManagerId,
          assigned_by: internalUserId,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update manager')
      setManagerModalDepartment(null)
      await fetchAssignmentData(companyId)
    } catch (err) {
      setManagerActionError(err instanceof Error ? err.message : 'Failed to update manager')
    } finally {
      setManagerActionLoading(false)
    }
  }

  const totalTasks = taskStats
    ? taskStats.assigned + taskStats.inProgress + taskStats.review + taskStats.complete
    : 0
  const shiftModalOpen = Boolean(assignTarget || selectedShift)
  const shiftModalDepartment = assignTarget?.department ?? departments.find(department => department.id === selectedShift?.shift.department_id)
  const shiftModalMembers = shiftModalDepartment
    ? members.filter(member => member.department_id === shiftModalDepartment.id)
    : members

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F1F5F9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <OwnerSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <div style={{ padding: '18px 32px', background: headerTheme.bg, borderBottom: headerTheme.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
          {dashboardRole !== 'Manager' && companies.length > 1 ? (
            <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button onClick={() => setDropdownOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 700, fontSize: '1.1875rem', color: headerTheme.text, userSelect: 'none' }}>
                {companyName ? `${companyName} — Overview` : 'Overview'}
                <ChevronDown size={16} strokeWidth={2.5} style={{ color: headerTheme.text, opacity: 0.6, transition: 'transform 0.15s', transform: dropdownOpen ? 'rotate(180deg)' : 'none' }} />
              </button>
              {dropdownOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '6px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: '200px', zIndex: 50, overflow: 'hidden' }}>
                  {companies.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => {
                        if (!userId) return
                        localStorage.setItem(`tasking_company_id_${userId}`, c.id)
                        localStorage.setItem(`tasking_last_company_name_${c.id}`, c.name)
                        setDropdownOpen(false); setCompanyId(c.id); setCompanyName(c.name); setCurrentPlan(c.plan || 'Free')
                      }}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: c.id === companyId ? '#FFF7ED' : 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: c.id === companyId ? '#EA580C' : '#374151', fontWeight: c.id === companyId ? 600 : 400 }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: headerTheme.text, margin: 0 }}>
              {companyName ? `${companyName} — Overview` : 'Overview'}
            </h1>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {ownerName && <span style={{ fontSize: '0.9rem', color: headerTheme.text, opacity: 0.85 }}>{ownerName}</span>}
            {companyId && (
              <PlanBadge
                plan={currentPlan}
                currentCompanyId={companyId}
                headerText={headerTheme.text}
              />
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '28px 32px', flex: 1 }}>

          {initialReady && !companyId && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '14px 18px', fontSize: '0.9rem', color: '#92400E', marginBottom: '24px' }}>
              No company is linked to your profile yet. If you just accepted an invitation, try signing out and signing in again.
            </div>
          )}

          {companyId && (
            <>
              {/* ── A: STAT CARDS ROW ─────────────────────────────────────── */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
                <StatCard label="Visible Shifts" value={todayShiftCount}            icon={<Briefcase size={15} />}   accent="#3B82F6" loading={timelineLoading}   />
                <StatCard label="Total Tasks"     value={totalTasks}                 icon={<Building2 size={15} />}   accent="#6B7280" loading={taskStatsLoading} />
                <StatCard label="In Progress"     value={taskStats?.inProgress ?? 0} icon={<Clock size={15} />}       accent="#3B82F6" loading={taskStatsLoading} />
                <StatCard label="In Review"       value={taskStats?.review ?? 0}     icon={<Eye size={15} />}         accent="#F97316" loading={taskStatsLoading} />
                <StatCard label="Complete"        value={taskStats?.complete ?? 0}   icon={<CheckCircle size={15} />} accent="#10B981" loading={taskStatsLoading} />
              </div>

              {/* ── B: TODAY'S LIVE FEED ──────────────────────────────────── */}
              <div style={{ marginBottom: 28, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Today&apos;s Live Feed</span>
                </div>
                {activityFeedLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner size={20} dark /></div>
                ) : activityFeed.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', maxHeight: 80 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Zap size={13} color="#9CA3AF" />
                    </div>
                    <span style={{ fontSize: '0.875rem', color: '#9CA3AF' }}>No activity yet today.</span>
                  </div>
                ) : (
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {activityFeed.slice(0, 10).map((event, idx) => {
                      const isShift = event.type === 'shift_started'
                      const isAlert = event.type === 'shift_uncovered'
                      const iconColor = isAlert ? '#EF4444' : isShift ? '#F97316' : '#3B82F6'
                      const iconBg   = isAlert ? '#FEF2F2' : isShift ? '#FFF7ED' : '#EFF6FF'
                      const Icon     = isAlert ? AlertTriangle : isShift ? Briefcase : Zap
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px', borderTop: idx === 0 ? 'none' : '1px solid #F8FAFC' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                            <Icon size={14} color={iconColor} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: '#111827', lineHeight: 1.45, fontWeight: 500 }}>{event.description}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{event.department}</span>
                              <span style={{ fontSize: '0.75rem', color: '#CBD5E1' }}>·</span>
                              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{timeAgo(event.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── C: ALLOCATION TIMELINE (today, read-only) ─────────────── */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                {/* Timeline header */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>Allocation Timeline</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: '#9CA3AF' }}>
                      <Calendar size={13} />
                      {selectedTimelineDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    {timelineLoading && <Spinner size={14} dark />}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => changeTimelineDate(-1)}
                        disabled={!canGoPrevious}
                        title="Previous day"
                        style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', color: canGoPrevious ? '#374151' : '#CBD5E1', cursor: canGoPrevious ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <button
                        onClick={() => setTimelineDate(todayStr)}
                        disabled={timelineDate === todayStr}
                        style={{ height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid #E5E7EB', background: timelineDate === todayStr ? '#F8FAFC' : '#FFFFFF', color: timelineDate === todayStr ? '#9CA3AF' : '#374151', cursor: timelineDate === todayStr ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => changeTimelineDate(1)}
                        disabled={!canGoNext}
                        title="Next day"
                        style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', color: canGoNext ? '#374151' : '#CBD5E1', cursor: canGoNext ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <select value={scheduleScope} onChange={event => setScheduleScope(event.target.value as 'day' | 'week')} style={{ height: 30, border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', color: '#374151', fontSize: '0.78rem', fontWeight: 700, padding: '0 8px', outline: 'none' }}>
                        <option value="day">Day</option>
                        <option value="week">Week</option>
                      </select>
                      <button onClick={() => handleSchedulePublication('published')} disabled={scheduleActionLoading} style={{ height: 30, padding: '0 10px', border: 'none', borderRadius: 8, background: '#F97316', color: '#FFFFFF', cursor: scheduleActionLoading ? 'default' : 'pointer', fontSize: '0.78rem', fontWeight: 800, opacity: scheduleActionLoading ? 0.65 : 1 }}>
                        Publish
                      </button>
                      <button onClick={() => handleSchedulePublication('draft')} disabled={scheduleActionLoading} style={{ height: 30, padding: '0 10px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', color: '#374151', cursor: scheduleActionLoading ? 'default' : 'pointer', fontSize: '0.78rem', fontWeight: 800, opacity: scheduleActionLoading ? 0.65 : 1 }}>
                        Unpublish
                      </button>
                      <button onClick={handleUndoShiftAction} disabled={undoLoading} style={{ height: 30, padding: '0 10px', border: '1px solid #F97316', borderRadius: 8, background: '#FFF7ED', color: '#C2410C', cursor: undoLoading ? 'default' : 'pointer', fontSize: '0.78rem', fontWeight: 800, opacity: undoLoading ? 0.65 : 1 }}>
                        Undo
                      </button>
                    </div>
                    <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 8, padding: 3, gap: 2 }}>
                      {(['global', 'dept'] as const).map(v => (
                        <button
                          key={v}
                          onClick={() => setTimelineView(v)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 6,
                            border: 'none',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            background: timelineView === v ? '#FFFFFF' : 'transparent',
                            color: timelineView === v ? '#111827' : '#6B7280',
                            boxShadow: timelineView === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                            transition: 'all 0.12s',
                          }}
                        >
                          {v === 'global' ? 'Global View' : 'Department View'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {scheduleActionError && (
                  <div style={{ padding: '8px 20px', borderBottom: '1px solid #FEE2E2', background: '#FEF2F2', color: '#B91C1C', fontSize: '0.8rem', fontWeight: 600 }}>
                    {scheduleActionError}
                  </div>
                )}

                {renderTimeAxis(7, 15)}
                <div style={{ minHeight: 120 }}>
                  {timelineView === 'global'
                    ? renderTimelineRows(timelineRows, 7 * 60, 15 * 60)
                    : renderDeptView(7 * 60, 15 * 60)
                  }
                </div>
                {renderTimeAxis(15, 23)}
                <div style={{ minHeight: 120 }}>
                  {timelineView === 'global'
                    ? renderTimelineRows(timelineRows, 15 * 60, 23 * 60)
                    : renderDeptView(15 * 60, 23 * 60)
                  }
                </div>
              </div>

              <div style={{ marginTop: 28, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Departments & Shift Assignment</span>
                    {assignmentDataLoading && <Spinner size={14} dark />}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={openDepartmentImport}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 11px', border: 'none', borderRadius: 8, background: '#111827', color: '#FFFFFF', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      <Upload size={14} /> Import
                    </button>
                    <button
                      onClick={openAddDepartment}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 11px', border: 'none', borderRadius: 8, background: '#F97316', color: '#FFFFFF', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      <Plus size={14} /> Add Department
                    </button>
                  </div>
                </div>
                {departments.length === 0 ? (
                  <div style={{ padding: '18px 20px', fontSize: '0.875rem', color: '#9CA3AF' }}>
                    No departments found for this company.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, padding: 16 }}>
                    {departments.map(department => {
                      const deptMembers = members.filter(member => member.department_id === department.id)
                      const manager = departmentManagers.find(item => item.department_id === department.id)
                      return (
                        <div key={department.id} style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', background: '#FFFFFF' }}>
                          <div style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 9, height: 9, borderRadius: '50%', background: deptColor(department.id) }} />
                              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827', minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{department.name}</span>
                              <span style={{ fontSize: '0.75rem', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{deptMembers.length} people</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                              <span style={{ fontSize: '0.75rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Manager: <strong style={{ color: '#111827' }}>{manager?.manager_name || 'Unassigned'}</strong>
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                <button onClick={() => openEditDepartment(department)} title="Edit department" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E5E7EB', borderRadius: 7, background: '#FFFFFF', color: '#6B7280', cursor: 'pointer' }}><Pencil size={13} /></button>
                                <button onClick={() => openManagerModal(department)} title="Change manager" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E5E7EB', borderRadius: 7, background: '#FFFFFF', color: '#6B7280', cursor: 'pointer' }}><Users size={13} /></button>
                                <button onClick={() => openDeleteDepartment(department)} title="Delete department" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #FECACA', borderRadius: 7, background: '#FFFFFF', color: '#DC2626', cursor: 'pointer' }}><Trash2 size={13} /></button>
                              </div>
                            </div>
                          </div>
                          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {deptMembers.length === 0 ? (
                              <div style={{ padding: '10px 8px', fontSize: '0.8125rem', color: '#CBD5E1' }}>No schedulable members in this department.</div>
                            ) : deptMembers.map(member => (
                              <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#F8FAFC', borderRadius: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1C1C1E', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>
                                  {member.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 650, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.full_name}</p>
                                  <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#9CA3AF' }}>{member.role}</p>
                                </div>
                                <button
                                  onClick={() => openAssignShift(member, department)}
                                  style={{ padding: '6px 10px', border: 'none', borderRadius: 7, background: '#F97316', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  Assign Shift
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {departmentModal && (
        <div onClick={() => setDepartmentModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
          <div onClick={event => event.stopPropagation()} style={{ width: 460, background: '#FFFFFF', borderRadius: 16, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.14)' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 800, color: '#111827' }}>
              {departmentModal === 'add' ? 'Add Department' : departmentModal === 'edit' ? 'Edit Department' : 'Delete Department'}
            </h2>
            {departmentModal === 'delete' ? (
              <p style={{ margin: 0, fontSize: '0.92rem', color: '#374151', lineHeight: 1.6 }}>
                Delete <strong>{activeDepartment?.name}</strong>? This removes the department record.
              </p>
            ) : (
              <div>
                <label style={modalLabelStyle}>Department Name</label>
                <input autoFocus value={departmentNameInput} onChange={event => setDepartmentNameInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void handleSaveDepartment() }} placeholder="Operations" style={modalInputStyle} />
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <InlineError message={departmentActionError} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setDepartmentModal(null)} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#374151', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={departmentModal === 'delete' ? handleDeleteDepartment : handleSaveDepartment}
                disabled={departmentActionLoading}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: 'none', background: departmentModal === 'delete' ? '#DC2626' : '#F97316', color: '#FFFFFF', fontWeight: 800, fontSize: '0.875rem', cursor: departmentActionLoading ? 'default' : 'pointer', opacity: departmentActionLoading ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {departmentActionLoading && <Spinner size={14} />}
                {departmentModal === 'delete' ? 'Delete' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {departmentImportOpen && (
        <div onClick={() => setDepartmentImportOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
          <div onClick={event => event.stopPropagation()} style={{ width: 500, background: '#FFFFFF', borderRadius: 16, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.14)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem', fontWeight: 800, color: '#111827' }}>Import Departments</h2>
            <p style={{ margin: '0 0 16px', color: '#6B7280', fontSize: '0.875rem', lineHeight: 1.5 }}>
              Upload a CSV with one department name per row. No invitation emails are sent.
            </p>
            <input type="file" accept=".csv,text/csv,text/plain" onChange={event => void handleDepartmentImportFile(event.target.files?.[0] ?? null)} style={modalInputStyle} />
            {departmentImportRows.length > 0 && (
              <div style={{ marginTop: 16, border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
                {departmentImportRows.map(name => (
                  <div key={name} style={{ padding: '9px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '0.86rem', color: '#374151', fontWeight: 700 }}>{name}</div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <InlineError message={departmentImportError} />
              {departmentImportResult && <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#15803D', lineHeight: 1.5 }}>{departmentImportResult}</div>}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setDepartmentImportOpen(false)} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#374151', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={confirmDepartmentImport}
                disabled={departmentImportLoading || departmentImportRows.length === 0}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: 'none', background: '#F97316', color: '#FFFFFF', fontWeight: 800, fontSize: '0.875rem', cursor: departmentImportLoading || departmentImportRows.length === 0 ? 'default' : 'pointer', opacity: departmentImportLoading || departmentImportRows.length === 0 ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {departmentImportLoading && <Spinner size={14} />}
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {managerModalDepartment && (
        <div onClick={() => setManagerModalDepartment(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
          <div onClick={event => event.stopPropagation()} style={{ width: 460, background: '#FFFFFF', borderRadius: 16, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.14)' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 800, color: '#111827' }}>Change Manager</h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.87rem', color: '#6B7280' }}>{managerModalDepartment.name}</p>
            <label style={modalLabelStyle}>Manager</label>
            <select value={selectedManagerId} onChange={event => setSelectedManagerId(event.target.value)} style={{ ...modalInputStyle, appearance: 'none', cursor: 'pointer' }}>
              <option value="">Select manager</option>
              {members.filter(member => member.role === 'Manager').map(manager => (
                <option key={manager.id} value={manager.id}>{manager.full_name}</option>
              ))}
            </select>
            <div style={{ marginTop: 14 }}>
              <InlineError message={managerActionError} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setManagerModalDepartment(null)} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#374151', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleSetDepartmentManager}
                disabled={managerActionLoading || !selectedManagerId}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: 'none', background: '#F97316', color: '#FFFFFF', fontWeight: 800, fontSize: '0.875rem', cursor: managerActionLoading || !selectedManagerId ? 'default' : 'pointer', opacity: managerActionLoading || !selectedManagerId ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {managerActionLoading && <Spinner size={14} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {shiftModalOpen && (
        <div onClick={() => { setAssignTarget(null); setSelectedShift(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
          <div onClick={event => event.stopPropagation()} style={{ width: 520, background: '#FFFFFF', borderRadius: 16, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.14)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#111827' }}>
                  {assignTarget ? 'Assign Shift' : 'Shift Details'}
                </h2>
                <p style={{ margin: '5px 0 0', fontSize: '0.85rem', color: '#6B7280' }}>
                  {shiftModalDepartment?.name ?? selectedShift?.shift.department_name ?? 'Department'} · {assignTarget?.member.full_name ?? selectedShift?.row.full_name ?? 'Open Shift'}
                </p>
              </div>
              <button onClick={() => { setAssignTarget(null); setSelectedShift(null) }} style={{ border: 'none', background: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}>
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={modalLabelStyle}>Title</label>
                <input value={shiftForm.title} onChange={event => setShiftForm(prev => ({ ...prev, title: event.target.value }))} placeholder="Opening shift" style={modalInputStyle} />
              </div>
              <div>
                <label style={modalLabelStyle}>Instruction</label>
                <textarea value={shiftForm.instruction} onChange={event => setShiftForm(prev => ({ ...prev, instruction: event.target.value }))} rows={3} placeholder="Optional shift notes" style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.45 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={modalLabelStyle}>Date</label>
                  <input type="date" min={minTimelineDate} max={maxTimelineDate} value={shiftForm.shift_date} onChange={event => setShiftForm(prev => ({ ...prev, shift_date: event.target.value }))} style={modalInputStyle} />
                </div>
                <div>
                  <label style={modalLabelStyle}>Assigned To</label>
                  <select value={shiftForm.assigned_user_id} onChange={event => setShiftForm(prev => ({ ...prev, assigned_user_id: event.target.value }))} style={{ ...modalInputStyle, appearance: 'none', cursor: 'pointer' }}>
                    {!assignTarget && <option value="">Open Shift</option>}
                    {shiftModalMembers.map(member => (
                      <option key={member.id} value={member.id}>{member.full_name} ({member.role})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={modalLabelStyle}>Start Time</label>
                  <input type="time" value={shiftForm.start_time} onChange={event => setShiftForm(prev => ({ ...prev, start_time: event.target.value }))} style={modalInputStyle} />
                </div>
                <div>
                  <label style={modalLabelStyle}>End Time</label>
                  <input type="time" value={shiftForm.end_time} onChange={event => setShiftForm(prev => ({ ...prev, end_time: event.target.value }))} style={modalInputStyle} />
                </div>
              </div>
              <div>
                <label style={modalLabelStyle}>Respond By</label>
                <input type="datetime-local" value={shiftForm.acceptance_deadline_at} onChange={event => setShiftForm(prev => ({ ...prev, acceptance_deadline_at: event.target.value }))} style={modalInputStyle} />
              </div>
              {selectedShift && (
                <div style={{ padding: 12, border: '1px solid #E5E7EB', borderRadius: 10, background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <label style={{ ...modalLabelStyle, margin: 0 }}>Shift Tasks</label>
                    <button
                      onClick={() => router.push('/owner/tasks')}
                      style={{ border: 'none', background: 'transparent', color: '#F97316', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                    >
                      Open Tasks
                    </button>
                  </div>
                  {selectedShiftTasksLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6B7280', fontSize: '0.82rem' }}>
                      <Spinner size={14} dark /> Loading tasks
                    </div>
                  ) : selectedShiftTasks.length === 0 ? (
                    <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.82rem' }}>No tasks linked to this shift.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedShiftTasks.slice(0, 5).map(task => (
                        <div key={task.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: '#FFFFFF', border: '1px solid #EEF2F7' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: '#111827', fontSize: '0.82rem', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                            <div style={{ marginTop: 3, color: '#64748B', fontSize: '0.72rem' }}>{task.percentage_complete}% complete</div>
                          </div>
                          <span style={{ padding: '3px 8px', borderRadius: 99, background: task.status === 'Complete' ? '#DCFCE7' : task.status === 'Review' ? '#FFEDD5' : task.status === 'In Progress' ? '#DBEAFE' : '#E2E8F0', color: task.status === 'Complete' ? '#15803D' : task.status === 'Review' ? '#C2410C' : task.status === 'In Progress' ? '#1D4ED8' : '#475569', fontSize: '0.7rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                            {task.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {selectedShift && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end', padding: 10, border: '1px solid #E5E7EB', borderRadius: 10, background: '#F8FAFC' }}>
                  <div>
                    <label style={modalLabelStyle}>Duplicate Date</label>
                    <input type="date" value={shiftForm.duplicate_shift_date} onChange={event => setShiftForm(prev => ({ ...prev, duplicate_shift_date: event.target.value }))} style={modalInputStyle} />
                  </div>
                  <div>
                    <label style={modalLabelStyle}>Start</label>
                    <input type="time" value={shiftForm.duplicate_start_time} onChange={event => setShiftForm(prev => ({ ...prev, duplicate_start_time: event.target.value }))} style={modalInputStyle} />
                  </div>
                  <div>
                    <label style={modalLabelStyle}>End</label>
                    <input type="time" value={shiftForm.duplicate_end_time} onChange={event => setShiftForm(prev => ({ ...prev, duplicate_end_time: event.target.value }))} style={modalInputStyle} />
                  </div>
                  <button onClick={handleDuplicateShift} disabled={shiftFormLoading} title="Duplicate shift" style={{ height: 40, width: 42, border: 'none', borderRadius: 8, background: '#111827', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: shiftFormLoading ? 'default' : 'pointer', opacity: shiftFormLoading ? 0.65 : 1 }}>
                    <Copy size={15} />
                  </button>
                </div>
              )}
              {selectedShift && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 92px auto', gap: 8, alignItems: 'end', padding: 10, border: '1px solid #E5E7EB', borderRadius: 10, background: '#FFFFFF' }}>
                  <div>
                    <label style={modalLabelStyle}>Repeat</label>
                    <select value={shiftForm.recurrence_rule} onChange={event => setShiftForm(prev => ({ ...prev, recurrence_rule: event.target.value as ShiftFormState['recurrence_rule'] }))} style={{ ...modalInputStyle, appearance: 'none', cursor: 'pointer' }}>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label style={modalLabelStyle}>Until</label>
                    <input type="date" value={shiftForm.recurrence_end_date} onChange={event => setShiftForm(prev => ({ ...prev, recurrence_end_date: event.target.value }))} style={modalInputStyle} />
                  </div>
                  <div>
                    <label style={modalLabelStyle}>Days</label>
                    <input type="number" min={1} max={31} value={shiftForm.custom_interval_days} onChange={event => setShiftForm(prev => ({ ...prev, custom_interval_days: Number(event.target.value) }))} disabled={shiftForm.recurrence_rule !== 'custom'} style={{ ...modalInputStyle, opacity: shiftForm.recurrence_rule === 'custom' ? 1 : 0.45 }} />
                  </div>
                  <button onClick={handleCreateRecurrence} disabled={shiftFormLoading || !shiftForm.recurrence_end_date} title="Create recurring shifts" style={{ height: 40, width: 42, border: 'none', borderRadius: 8, background: '#F97316', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: shiftFormLoading || !shiftForm.recurrence_end_date ? 'default' : 'pointer', opacity: shiftFormLoading || !shiftForm.recurrence_end_date ? 0.65 : 1 }}>
                    <Repeat size={15} />
                  </button>
                </div>
              )}
              <InlineError message={shiftFormError} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {selectedShift && (
                <button
                  onClick={handleDeleteShift}
                  disabled={shiftFormLoading}
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #FECACA', background: '#FFFFFF', color: '#DC2626', fontWeight: 700, fontSize: '0.875rem', cursor: shiftFormLoading ? 'default' : 'pointer', opacity: shiftFormLoading ? 0.6 : 1 }}
                >
                  Delete
                </button>
              )}
              <button
                onClick={() => { setAssignTarget(null); setSelectedShift(null) }}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#374151', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={assignTarget ? handleCreateShift : handleUpdateShift}
                disabled={shiftFormLoading}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: 'none', background: '#F97316', color: '#FFFFFF', fontWeight: 800, fontSize: '0.875rem', cursor: shiftFormLoading ? 'default' : 'pointer', opacity: shiftFormLoading ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {shiftFormLoading && <Spinner size={14} />}
                {shiftFormCanOverride ? 'Override Warning' : assignTarget ? 'Assign Shift' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Removal overlay */}
      {removalOverlay && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '40px 48px', boxShadow: '0 8px 48px rgba(0,0,0,0.18)', maxWidth: '460px', textAlign: 'center' }}>
            <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: '0 0 12px' }}>You have been removed</h2>
            <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.6, margin: '0 0 20px' }}>
              You have been removed from <strong style={{ color: '#111827' }}>{removalOverlay.companyName}</strong>. Switching to your other company…
            </p>
            <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#F97316', borderRadius: 2, animation: 'removal-progress 3s linear forwards' }} />
            </div>
            <style>{`@keyframes removal-progress { from { width: 0% } to { width: 100% } }`}</style>
          </div>
        </div>
      )}
    </div>
  )
}
