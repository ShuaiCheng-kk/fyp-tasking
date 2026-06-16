'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  AlertTriangle, ArrowLeftRight, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronUp, Clock,
  Crown, Edit3, Filter, HardHat, Settings2, ShieldCheck, Sparkles, UserCog, Users, UserX, X,
} from 'lucide-react'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { AIAutoApprovalDecision } from '@/types/AI'
import {
  AttendanceDashboard,
  AttendanceDashboardRecord,
  AttendanceOwnerStatus,
  ShiftSwapRequestView,
  TimeOffRequestView,
} from '@/types/Attendance'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #E5E7EB',
  borderRadius: 8,
  fontSize: '0.9rem',
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#FFFFFF',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 900,
  color: '#6B7280',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const sectionHeaderStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderBottom: '1px solid #F0F4F8',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  if (value.includes('T')) return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return value.slice(0, 5)
}

function statusColor(status: string): { bg: string; text: string } {
  if (status === 'approved') return { bg: '#ECFDF5', text: '#047857' }
  if (status === 'rejected' || status === 'absent') return { bg: '#FEF2F2', text: '#B91C1C' }
  if (status === 'modified' || status === 'late' || status === 'overtime') return { bg: '#FFF7ED', text: '#C2410C' }
  return { bg: '#FFFBEB', text: '#B45309' }
}

function Spinner({ dark = false }: { dark?: boolean }) {
  return (
    <svg className="animate-spin" width="15" height="15" viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function AiComingSoonBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: '#F3F4F6', color: '#6B7280',
      borderRadius: 999, padding: '3px 10px',
      fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em',
      border: '1px dashed #D1D5DB',
    }}>
      <Sparkles size={10} /> AI · Coming soon
    </span>
  )
}

function PipelineStage({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: done ? '#059669' : active ? '#F97316' : '#E5E7EB',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {done
          ? <Check size={12} strokeWidth={2.5} color="#FFFFFF" />
          : <div style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#FFFFFF' : '#9CA3AF' }} />
        }
      </div>
      <span style={{ fontSize: '0.62rem', fontWeight: 600, color: done ? '#047857' : active ? '#C2410C' : '#9CA3AF', textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
    </div>
  )
}

function PipelineDash({ done }: { done: boolean }) {
  return <div style={{ flex: 0.6, height: 2, background: done ? '#059669' : '#E5E7EB', marginBottom: 18, flexShrink: 0 }} />
}

export default function OwnerAttendancePage() {
  const router = useRouter()
  const [internalUserId, setInternalUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [currentPlan, setCurrentPlan] = useState('Free')
  const [dashboard, setDashboard] = useState<AttendanceDashboard | null>(null)
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequestView[]>([])
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequestView[]>([])
  const [selectedRecordId, setSelectedRecordId] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewDecision, setReviewDecision] = useState<AttendanceOwnerStatus>('approved')
  const [reviewNotes, setReviewNotes] = useState('')
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDecisions, setAiDecisions] = useState<AIAutoApprovalDecision[]>([])
  const [error, setError] = useState('')

  // UC3: Exceptions tab state
  const [activeTab, setActiveTab] = useState<'records' | 'exceptions' | 'swaps' | 'timeoff'>('records')
  const [exceptionFilter, setExceptionFilter] = useState<'all' | 'late' | 'absent' | 'overtime' | 'pending'>('all')
  const [exceptionDateFrom, setExceptionDateFrom] = useState('')
  const [exceptionDateTo, setExceptionDateTo] = useState('')

  // UC6: Auto-approval settings state (UI only)
  const [autoApprovalExpanded, setAutoApprovalExpanded] = useState(false)
  const [autoApprovalEnabled, setAutoApprovalEnabled] = useState(false)
  const [autoApprovalThreshold, setAutoApprovalThreshold] = useState(85)

  // UC2: Expand review modal with modification reason
  const [reviewModifyReason, setReviewModifyReason] = useState('')

  const today = new Date().toISOString().slice(0, 10)
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const selectedRecord = useMemo(
    () => dashboard?.records.find(row => row.record?.id === selectedRecordId) ?? null,
    [dashboard, selectedRecordId],
  )

  const records = dashboard?.records ?? []
  const todayRecords = records.filter(row => row.shift.shift_date === today)
  const internalRecords = todayRecords.filter(row => row.assignee_role === 'Manager' || row.assignee_role === 'Employee')
  const realCasualRecords = todayRecords.filter(row => row.assignee_role === 'Casual Worker')

  const DUMMY_CASUAL_RECORDS: typeof realCasualRecords = [
    {
      assignment: { id: 'demo-1', shift_id: 'ds-1', user_id: 'du-1', assigned_by: 'owner', assignment_status: 'assigned', supervisor_employee_id: null, created_at: today, updated_at: today },
      shift: { id: 'ds-1', company_id: '', department_id: 'dept-1', title: 'Morning Shift', instruction: null, shift_date: today, start_time: '09:00', end_time: '17:00', status: 'active', publication_status: 'published', acceptance_deadline_at: null, recurrence_group_id: null, recurrence_rule: null, source_shift_id: null, created_by: 'owner', created_at: today, updated_at: today },
      assignee_name: 'Jordan Lee',
      assignee_role: 'Casual Worker',
      supervisor_name: 'Alex Thompson',
      department_name: 'Customer Support',
      exceptions: ['late'],
      record: {
        id: 'demo-rec-1', shift_assignment_id: 'demo-1', casual_worker_id: 'du-1',
        clock_in_time: `${today}T09:22:00`, clock_out_time: `${today}T17:05:00`,
        confirmed_by_employee_id: 'emp-1', submitted_by_employee_id: 'emp-1',
        status: 'submitted', employee_notes: 'Arrived late due to transport delay.', manager_notes: 'Confirmed with worker. Minor delay only.',
        owner_status: 'pending', owner_notes: null, owner_reviewed_by: null, owner_reviewed_at: null,
        owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
        created_at: today, updated_at: today,
      },
    },
    {
      assignment: { id: 'demo-2', shift_id: 'ds-2', user_id: 'du-2', assigned_by: 'owner', assignment_status: 'assigned', supervisor_employee_id: null, created_at: today, updated_at: today },
      shift: { id: 'ds-2', company_id: '', department_id: 'dept-1', title: 'Afternoon Shift', instruction: null, shift_date: today, start_time: '13:00', end_time: '21:00', status: 'active', publication_status: 'published', acceptance_deadline_at: null, recurrence_group_id: null, recurrence_rule: null, source_shift_id: null, created_by: 'owner', created_at: today, updated_at: today },
      assignee_name: 'Sam Rivera',
      assignee_role: 'Casual Worker',
      supervisor_name: 'Maria Chen',
      department_name: 'Warehouse',
      exceptions: [],
      record: {
        id: 'demo-rec-2', shift_assignment_id: 'demo-2', casual_worker_id: 'du-2',
        clock_in_time: `${today}T13:00:00`, clock_out_time: `${today}T21:02:00`,
        confirmed_by_employee_id: 'emp-2', submitted_by_employee_id: 'emp-2',
        status: 'submitted', employee_notes: null, manager_notes: 'All good.',
        owner_status: 'pending', owner_notes: null, owner_reviewed_by: null, owner_reviewed_at: null,
        owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
        created_at: today, updated_at: today,
      },
    },
    {
      assignment: { id: 'demo-3', shift_id: 'ds-3', user_id: 'du-3', assigned_by: 'owner', assignment_status: 'assigned', supervisor_employee_id: null, created_at: today, updated_at: today },
      shift: { id: 'ds-3', company_id: '', department_id: 'dept-2', title: 'Night Shift', instruction: null, shift_date: today, start_time: '22:00', end_time: '06:00', status: 'active', publication_status: 'published', acceptance_deadline_at: null, recurrence_group_id: null, recurrence_rule: null, source_shift_id: null, created_by: 'owner', created_at: today, updated_at: today },
      assignee_name: 'Chris Patel',
      assignee_role: 'Casual Worker',
      supervisor_name: null,
      department_name: 'Security',
      exceptions: ['absent'],
      record: {
        id: 'demo-rec-3', shift_assignment_id: 'demo-3', casual_worker_id: 'du-3',
        clock_in_time: null, clock_out_time: null,
        confirmed_by_employee_id: '', submitted_by_employee_id: '',
        status: 'pending', employee_notes: null, manager_notes: null,
        owner_status: 'pending', owner_notes: null, owner_reviewed_by: null, owner_reviewed_at: null,
        owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
        created_at: today, updated_at: today,
      },
    },
  ]

  const casualRecords = realCasualRecords.length > 0 ? realCasualRecords : DUMMY_CASUAL_RECORDS
  const summary = dashboard?.summary

  const fetchAttendanceData = useCallback(async (cid: string) => {
    if (!cid) return
    setLoading(true)
    setError('')
    try {
      const [dashboardRes, timeOffRes, swapRes] = await Promise.all([
        fetch(`/api/attendance?company_id=${cid}`),
        fetch(`/api/attendance?company_id=${cid}&resource=time_off`),
        fetch(`/api/attendance?company_id=${cid}&resource=shift_swaps`),
      ])
      const dashboardData = await dashboardRes.json()
      const timeOffData = await timeOffRes.json()
      const swapData = await swapRes.json()
      if (!dashboardData.success) throw new Error(dashboardData.message || 'Failed to fetch attendance')
      setDashboard(dashboardData.dashboard)
      setTimeOffRequests(timeOffData.requests ?? [])
      setSwapRequests(swapData.requests ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch attendance')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let authId = localStorage.getItem('tasking_user_id')
      if (!authId) {
        const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          authId = session.user.id
          localStorage.setItem('tasking_user_id', authId)
        }
      }
      if (!authId) { router.replace('/signin'); return }
      const meRes = await fetch(`/api/user/me?user_id=${authId}`)
      const meData = await meRes.json()
      if (!meData.success || cancelled) return
      setInternalUserId(meData.user.id)
      if (meData.user?.full_name) setOwnerName(meData.user.full_name)
      const storedCompanyId = localStorage.getItem(`tasking_company_id_${authId}`) || meData.user.company_id || ''
      if (!storedCompanyId) return
      setCompanyId(storedCompanyId)
      const currentRes = await fetch(`/api/company/current?user_id=${authId}&company_id=${storedCompanyId}`)
      const currentData = await currentRes.json()
      if (!cancelled && currentData.success) {
        setCompanyName(currentData.company?.name ?? '')
        setCurrentPlan(currentData.company?.plan ?? 'Free')
      }
      if (!cancelled) await fetchAttendanceData(storedCompanyId)
    }
    void run()
    return () => { cancelled = true }
  }, [router, fetchAttendanceData])

  const openReview = (row: AttendanceDashboardRecord, decision: AttendanceOwnerStatus) => {
    if (!row.record) return
    setSelectedRecordId(row.record.id)
    setReviewDecision(decision)
    setReviewNotes(row.record.owner_notes ?? '')
    setClockIn(row.record.owner_adjusted_clock_in_time ?? row.record.clock_in_time ?? '')
    setClockOut(row.record.owner_adjusted_clock_out_time ?? row.record.clock_out_time ?? '')
    setReviewModifyReason('')
    setError('')
    setReviewOpen(true)
  }

  const submitReview = async () => {
    if (!selectedRecord?.record || !internalUserId || !companyId) return
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'final_review',
          id: selectedRecord.record.id,
          owner_id: internalUserId,
          decision: reviewDecision,
          owner_notes: reviewNotes || null,
          clock_in_time: clockIn || null,
          clock_out_time: clockOut || null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to review attendance')
      setReviewOpen(false)
      await fetchAttendanceData(companyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review attendance')
    } finally {
      setActionLoading(false)
    }
  }

  const decideRequest = async (kind: 'decide_time_off' | 'decide_shift_swap', id: string, decision: 'approved' | 'rejected') => {
    if (!internalUserId || !companyId) return
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: kind, id, reviewer_id: internalUserId, decision }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update request')
      await fetchAttendanceData(companyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update request')
    } finally {
      setActionLoading(false)
    }
  }

  const runTimesheetAI = async (apply: boolean) => {
    if (!companyId) return
    setAiLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, owner_id: internalUserId, apply }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to review timesheets')
      setAiDecisions(data.decisions ?? [])
      if (apply) await fetchAttendanceData(companyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review timesheets')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F7F8FA', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <OwnerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, minHeight: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Page header */}
        <div style={{ padding: '20px 28px 0', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Attendance
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {internalUserId && <OwnerUserBadge userId={internalUserId} companyId={companyId} />}
            {companyId && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        {/* Date + Refresh row */}
        <div style={{ padding: '14px 28px 0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#F0F4F8', borderRadius: 8, padding: '6px 12px' }}>
            <CalendarDays size={13} style={{ color: '#6B7280' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#374151' }}>{todayLabel}</span>
          </div>
          <button
            onClick={() => fetchAttendanceData(companyId)}
            disabled={loading || !companyId}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1.5px solid #E5E7EB', borderRadius: 8, background: '#fff', color: '#374151', padding: '6px 13px', fontWeight: 600, fontSize: '0.8125rem', cursor: loading || !companyId ? 'default' : 'pointer', opacity: loading || !companyId ? 0.5 : 1 }}
          >
            {loading ? <Spinner dark /> : null} Refresh
          </button>
        </div>

        {/* ── UC3: Tab bar ──────────────────────────────────────────────────────── */}
        <div style={{ padding: '14px 28px 0', display: 'flex', gap: 4, flexShrink: 0 }}>
          {([
            { key: 'records',    label: 'Records' },
            { key: 'exceptions', label: 'Exceptions' },
            { key: 'swaps',      label: 'Shift Swaps' },
            { key: 'timeoff',    label: 'Time Off' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 18px',
                border: 'none',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                background: activeTab === tab.key ? '#0F172A' : 'transparent',
                color: activeTab === tab.key ? '#FFFFFF' : '#6B7280',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '16px 28px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {error && (
            <div style={{ padding: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, fontSize: '0.84rem', fontWeight: 800 }}>
              {error}
            </div>
          )}

          {/* ── UC6: Auto-Approval Settings card ─────────────────────────────── */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            <button
              onClick={() => setAutoApprovalExpanded(prev => !prev)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Settings2 size={14} style={{ color: '#F97316' }} />
              </div>
              <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>Auto-Approval Settings</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', background: '#F3F4F6', padding: '2px 8px', borderRadius: 99, marginRight: 8 }}>
                {autoApprovalEnabled ? 'Enabled' : 'Disabled'}
              </span>
              {autoApprovalExpanded ? <ChevronUp size={15} style={{ color: '#9CA3AF' }} /> : <ChevronDown size={15} style={{ color: '#9CA3AF' }} />}
            </button>
            {autoApprovalExpanded && (
              <div style={{ padding: '0 18px 18px', borderTop: '1px solid #F0F4F8', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ paddingTop: 14, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={autoApprovalEnabled}
                      onChange={e => setAutoApprovalEnabled(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#F97316', cursor: 'pointer' }}
                    />
                    <div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', display: 'block' }}>Enable AI auto-approval for clean records</span>
                      <span style={{ fontSize: '0.775rem', color: '#6B7280' }}>Records that pass the confidence threshold will be approved automatically</span>
                    </div>
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Confidence Threshold (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={autoApprovalThreshold}
                      onChange={e => setAutoApprovalThreshold(Number(e.target.value))}
                      disabled={!autoApprovalEnabled}
                      style={{ ...inputStyle, opacity: autoApprovalEnabled ? 1 : 0.5 }}
                    />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.775rem', color: '#6B7280', lineHeight: 1.5 }}>
                      Records with AI confidence below <strong>{autoApprovalThreshold}%</strong> will be flagged for manual review.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A' }}>
                  <Sparkles size={12} style={{ color: '#D97706', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.775rem', color: '#92400E' }}>
                    Use the <strong>AI Review</strong> button in the Casual Worker section to run the AI analysis. Results will appear there.
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    disabled
                    title="Settings persistence coming soon"
                    style={{ padding: '8px 18px', border: 'none', borderRadius: 8, background: '#F3F4F6', color: '#9CA3AF', fontWeight: 700, fontSize: '0.8125rem', cursor: 'not-allowed' }}
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── UC3: Exceptions tab content ───────────────────────────────────── */}
          {activeTab === 'exceptions' && (
            <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={15} style={{ color: '#DC2626' }} />
                </div>
                <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>Attendance Exceptions</span>
              </div>

              {/* Filter row */}
              <div style={{ padding: '12px 18px', background: '#F8FAFC', borderBottom: '1px solid #F0F4F8', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Filter size={13} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                <input
                  type="date"
                  value={exceptionDateFrom}
                  onChange={e => setExceptionDateFrom(e.target.value)}
                  style={{ ...inputStyle, width: 'auto', height: 34, padding: '6px 10px', fontSize: '0.8125rem' }}
                  placeholder="From"
                />
                <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>–</span>
                <input
                  type="date"
                  value={exceptionDateTo}
                  onChange={e => setExceptionDateTo(e.target.value)}
                  style={{ ...inputStyle, width: 'auto', height: 34, padding: '6px 10px', fontSize: '0.8125rem' }}
                  placeholder="To"
                />
                <div style={{ position: 'relative' }}>
                  <select
                    value={exceptionFilter}
                    onChange={e => setExceptionFilter(e.target.value as typeof exceptionFilter)}
                    style={{ ...inputStyle, width: 'auto', height: 34, padding: '6px 28px 6px 10px', fontSize: '0.8125rem', appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="all">All Types</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                    <option value="overtime">Overtime</option>
                    <option value="pending">Pending Approval</option>
                  </select>
                  <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* Exception table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Worker', 'Shift Date', 'Expected In', 'Actual In', 'Actual Out', 'Type', 'Status'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #F0F4F8', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records
                      .filter(row => row.exceptions.length > 0 || (row.record?.owner_status ?? 'pending') === 'pending')
                      .filter(row => exceptionFilter === 'all' || row.exceptions.includes(exceptionFilter) || (exceptionFilter === 'pending' && (row.record?.owner_status ?? 'pending') === 'pending'))
                      .filter(row => !exceptionDateFrom || row.shift.shift_date >= exceptionDateFrom)
                      .filter(row => !exceptionDateTo || row.shift.shift_date <= exceptionDateTo)
                      .map(row => {
                        const primaryException = row.exceptions[0] ?? 'pending'
                        const exColor = primaryException === 'absent' ? { bg: '#FEF2F2', text: '#B91C1C' }
                          : primaryException === 'late' ? { bg: '#FFF7ED', text: '#C2410C' }
                          : primaryException === 'overtime' ? { bg: '#FFFBEB', text: '#B45309' }
                          : { bg: '#F3F4F6', text: '#6B7280' }
                        const ownerStatus = row.record?.owner_status ?? 'pending'
                        const stColor = statusColor(ownerStatus)
                        return (
                          <tr key={row.assignment.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                            <td style={{ padding: '11px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <UserCog size={12} style={{ color: '#6B7280' }} />
                                </div>
                                <div>
                                  <span style={{ fontWeight: 600, color: '#111827', display: 'block' }}>{row.assignee_name}</span>
                                  <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{row.assignee_role}</span>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '11px 14px', color: '#374151', fontWeight: 500 }}>{row.shift.shift_date}</td>
                            <td style={{ padding: '11px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{formatTime(row.shift.start_time)}</td>
                            <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: 700, color: row.record?.clock_in_time ? '#059669' : '#9CA3AF' }}>
                                {formatTime(row.record?.clock_in_time)}
                              </span>
                            </td>
                            <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: 600, color: row.record?.clock_out_time ? '#374151' : '#9CA3AF' }}>
                                {formatTime(row.record?.clock_out_time)}
                              </span>
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              <span style={{ background: exColor.bg, color: exColor.text, borderRadius: 999, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'capitalize' }}>
                                {primaryException}
                              </span>
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              <span style={{ background: stColor.bg, color: stColor.text, borderRadius: 999, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700 }}>
                                {ownerStatus}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    }
                    {records.filter(row => row.exceptions.length > 0 || (row.record?.owner_status ?? 'pending') === 'pending').length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: '32px 14px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.875rem' }}>
                          No exception records found. Try adjusting the date range or filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Stats row (Records tab only) ──────────────────────────────────── */}
          {activeTab === 'records' && (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(110px, 1fr))', gap: 12 }}>
            {[
              { label: 'Assignments', value: summary?.total_assignments ?? 0 },
              { label: 'Pending', value: summary?.pending_final_review ?? 0 },
              { label: 'Approved', value: summary?.approved ?? 0 },
              { label: 'Late', value: summary?.late ?? 0 },
              { label: 'Absent', value: summary?.absent ?? 0 },
              { label: 'Overtime', value: summary?.overtime ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ margin: 0, color: '#6B7280', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                <strong style={{ display: 'block', marginTop: 6, fontSize: '1.35rem', color: '#111827' }}>{loading ? '—' : value}</strong>
              </div>
            ))}
          </section>
          )}

          {/* ── Block 1: Internal Staff Today (Records tab only) ──────────────── */}
          {activeTab === 'records' && <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            <div style={sectionHeaderStyle}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={15} style={{ color: '#374151' }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>Internal Staff</span>
                <span style={{ marginLeft: 8, fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', background: '#F3F4F6', padding: '2px 8px', borderRadius: 99 }}>Manager &amp; Employee</span>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280' }}>
                {internalRecords.length} assigned today
              </span>
            </div>

            {loading ? (
              <div style={{ padding: '20px 18px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Spinner dark /> Loading...
              </div>
            ) : internalRecords.length === 0 ? (
              <div style={{ padding: '20px 18px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>
                No Manager or Employee shifts scheduled for today.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Name', 'Role', 'Department', 'Shift', 'Scheduled', 'Clock In', 'Clock Out'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #F0F4F8', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {internalRecords.map(row => {
                      const isManager = row.assignee_role === 'Manager'
                      return (
                        <tr key={row.assignment.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: isManager ? '#FFF7ED' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <UserCog size={13} style={{ color: isManager ? '#EA580C' : '#6B7280' }} />
                              </div>
                              <span style={{ fontWeight: 600, color: '#111827' }}>{row.assignee_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px', color: '#374151', fontWeight: 500 }}>{row.assignee_role}</td>
                          <td style={{ padding: '11px 14px', color: '#6B7280' }}>{row.department_name ?? '—'}</td>
                          <td style={{ padding: '11px 14px', color: '#374151' }}>{row.shift.title || 'Shift'}</td>
                          <td style={{ padding: '11px 14px', color: '#374151', whiteSpace: 'nowrap' }}>
                            {formatTime(row.shift.start_time)} – {formatTime(row.shift.end_time)}
                          </td>
                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 700, color: row.record?.clock_in_time ? '#059669' : '#9CA3AF' }}>
                              {formatTime(row.record?.clock_in_time)}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 700, color: row.record?.clock_out_time ? '#374151' : '#9CA3AF' }}>
                              {formatTime(row.record?.clock_out_time)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>}

          {/* ── Block 2: Casual Worker Attendance Review (Records tab only) ───── */}
          {activeTab === 'records' && <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ ...sectionHeaderStyle, borderBottom: '1px solid #F0F4F8' }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <HardHat size={15} style={{ color: '#2563EB' }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>Casual Worker Attendance Review</span>
                <span style={{ marginLeft: 8, fontSize: '0.72rem', fontWeight: 700, color: '#2563EB', background: '#EFF6FF', padding: '2px 8px', borderRadius: 99, border: '1px solid #BFDBFE' }}>
                  {casualRecords.length} record{casualRecords.length !== 1 ? 's' : ''} today
                </span>
              </div>
              {/* AI Timesheet Review buttons */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => runTimesheetAI(false)}
                  disabled={aiLoading || !companyId}
                  style={{ border: 'none', borderRadius: 8, background: '#111827', color: '#FFFFFF', padding: '7px 12px', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, cursor: aiLoading ? 'default' : 'pointer', opacity: aiLoading || !companyId ? 0.6 : 1 }}
                >
                  {aiLoading ? <Spinner /> : <Sparkles size={13} />} AI Review
                </button>
                <button
                  onClick={() => runTimesheetAI(true)}
                  disabled={aiLoading || !companyId || !internalUserId}
                  style={{ border: 'none', borderRadius: 8, background: '#F97316', color: '#FFFFFF', padding: '7px 12px', fontWeight: 700, fontSize: '0.8rem', cursor: aiLoading ? 'default' : 'pointer', opacity: aiLoading ? 0.6 : 1 }}
                >
                  Apply clean approvals
                </button>
              </div>
            </div>

            {/* Pipeline explanation strip */}
            <div style={{ padding: '10px 18px', background: '#F8FAFC', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={12} style={{ color: '#6B7280', flexShrink: 0 }} />
              <span style={{ fontSize: '0.76rem', color: '#6B7280' }}>
                4-tier chain: Casual Worker clocks in/out → <strong style={{ color: '#374151' }}>Employee confirms</strong> → <strong style={{ color: '#374151' }}>Manager submits</strong> → <strong style={{ color: '#374151' }}>Owner approves</strong>
              </span>
            </div>

            {/* AI decisions display */}
            {aiDecisions.length > 0 && (
              <div style={{ padding: '10px 18px', background: '#F0FDF4', borderBottom: '1px solid #BBF7D0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Review Results</span>
                {aiDecisions.map(decision => (
                  <div key={decision.record_id} style={{ display: 'flex', gap: 10, padding: '7px 10px', background: '#FFFFFF', borderRadius: 7, fontSize: '0.8rem', border: '1px solid #BBF7D0' }}>
                    <strong style={{ color: decision.decision === 'auto_approve' ? '#047857' : '#B45309', flexShrink: 0 }}>
                      {decision.decision === 'auto_approve' ? '✓ Auto-approve' : '⚠ Flag'} · {decision.confidence}%
                    </strong>
                    <span style={{ color: '#4B5563' }}>{decision.reason}</span>
                  </div>
                ))}
              </div>
            )}

            {loading ? (
              <div style={{ padding: '24px 18px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Spinner dark /> Loading...
              </div>
            ) : casualRecords.length === 0 ? (
              <div style={{ padding: '28px 18px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>
                No casual worker attendance records submitted for today.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {casualRecords.map(row => {
                  const ownerStatus = row.record?.owner_status ?? 'pending'
                  const color = statusColor(ownerStatus)
                  const clockedIn = !!row.record?.clock_in_time
                  const employeeConfirmed = !!row.record?.confirmed_by_employee_id
                  const managerSubmitted = !!row.record?.submitted_by_employee_id
                  const ownerReviewed = ownerStatus === 'approved' || ownerStatus === 'rejected' || ownerStatus === 'modified'

                  return (
                    <div key={row.assignment.id} style={{ padding: '16px 18px', borderBottom: '1px solid #F8FAFC' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr auto', gap: 14, alignItems: 'center' }}>
                        {/* Worker + shift */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <HardHat size={12} style={{ color: '#2563EB' }} />
                            </div>
                            <strong style={{ fontSize: '0.875rem', color: '#111827' }}>{row.assignee_name}</strong>
                          </div>
                          <p style={{ margin: '0 0 0 36px', fontSize: '0.76rem', color: '#9CA3AF' }}>
                            {row.shift.title || 'Shift'} · {row.department_name ?? 'No dept'}
                          </p>
                        </div>

                        {/* Scheduled + actual times */}
                        <div>
                          <p style={{ margin: 0, fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>Scheduled</p>
                          <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#374151', fontWeight: 600 }}>
                            {formatTime(row.shift.start_time)} – {formatTime(row.shift.end_time)}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>Clocked</p>
                          <p style={{ margin: '2px 0 0', fontSize: '0.84rem', fontWeight: 600, color: row.record?.clock_in_time ? '#111827' : '#D1D5DB' }}>
                            {formatTime(row.record?.clock_in_time)} – {formatTime(row.record?.clock_out_time)}
                          </p>
                        </div>

                        {/* Exceptions */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {row.exceptions.length === 0
                            ? <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669' }}>Clean</span>
                            : row.exceptions.map(ex => {
                              const ec = statusColor(ex)
                              return <span key={ex} style={{ background: ec.bg, color: ec.text, borderRadius: 999, padding: '2px 7px', fontSize: '0.68rem', fontWeight: 700 }}>{ex}</span>
                            })
                          }
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                          <span style={{ background: color.bg, color: color.text, borderRadius: 999, padding: '3px 9px', fontSize: '0.68rem', fontWeight: 900 }}>{ownerStatus}</span>
                          {row.record && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => openReview(row, 'approved')} title="Approve" style={{ border: 'none', borderRadius: 7, background: '#059669', color: '#FFFFFF', width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><CheckCircle2 size={14} /></button>
                              <button onClick={() => openReview(row, 'modified')} title="Modify" style={{ border: 'none', borderRadius: 7, background: '#F97316', color: '#FFFFFF', width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Edit3 size={13} /></button>
                              <button onClick={() => openReview(row, 'rejected')} title="Reject" style={{ border: 'none', borderRadius: 7, background: '#DC2626', color: '#FFFFFF', width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><UserX size={13} /></button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 4-tier pipeline visual */}
                      <div style={{ marginTop: 12, marginLeft: 36, display: 'flex', alignItems: 'center' }}>
                        <PipelineStage label="CW Clocked" done={clockedIn} active={!clockedIn} />
                        <PipelineDash done={clockedIn} />
                        <PipelineStage label="Employee Confirmed" done={employeeConfirmed} active={clockedIn && !employeeConfirmed} />
                        <PipelineDash done={employeeConfirmed} />
                        <PipelineStage label="Manager Submitted" done={managerSubmitted} active={employeeConfirmed && !managerSubmitted} />
                        <PipelineDash done={managerSubmitted} />
                        <PipelineStage label="Owner Approved" done={ownerReviewed} active={managerSubmitted && !ownerReviewed} />
                      </div>

                      {/* Supervisor */}
                      {row.supervisor_name && (
                        <p style={{ margin: '8px 0 0 36px', fontSize: '0.75rem', color: '#9CA3AF' }}>
                          Supervising Employee: <strong style={{ color: '#374151' }}>{row.supervisor_name}</strong>
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>}

          {/* ── Block 3: Shift Swaps tab ──────────────────────────────────────── */}
          {activeTab === 'swaps' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18, alignItems: 'start' }}>

            {/* Shift Swaps */}
            <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
              <div style={sectionHeaderStyle}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ArrowLeftRight size={14} style={{ color: '#F97316' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>Shift Swaps</span>
                </div>
                <AiComingSoonBadge />
              </div>

              <div style={{ padding: '10px 14px', background: '#FFFBEB', borderBottom: '1px solid #FDE68A' }}>
                <p style={{ margin: 0, fontSize: '0.775rem', color: '#92400E' }}>
                  Manager and Employee swap requests require your approval before taking effect.
                </p>
              </div>

              {swapRequests.length === 0 ? (
                <div style={{ padding: '24px 16px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>
                  No pending shift swap requests.
                </div>
              ) : swapRequests.map(request => {
                const color = statusColor(request.status)
                return (
                  <div key={request.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F8FAFC' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <strong style={{ fontSize: '0.875rem', color: '#111827' }}>{request.requester_name}</strong>
                          <ArrowLeftRight size={11} style={{ color: '#9CA3AF' }} />
                          <strong style={{ fontSize: '0.875rem', color: '#111827' }}>{request.replacement_name}</strong>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.775rem', color: '#6B7280' }}>
                          {request.shift_title ?? 'Shift'} · {request.shift_date ?? '—'} · {formatTime(request.start_time)}–{formatTime(request.end_time)}
                        </p>
                      </div>
                      <span style={{ background: color.bg, color: color.text, borderRadius: 999, padding: '2px 9px', fontSize: '0.65rem', fontWeight: 900, flexShrink: 0, height: 'fit-content' }}>{request.status}</span>
                    </div>
                    {request.reason && (
                      <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#4B5563', lineHeight: 1.4 }}>{request.reason}</p>
                    )}
                    {request.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => decideRequest('decide_shift_swap', request.id, 'approved')} disabled={actionLoading} style={{ flex: 1, border: 'none', borderRadius: 7, background: '#059669', color: '#FFFFFF', padding: '7px 0', fontSize: '0.76rem', fontWeight: 700, cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.5 : 1 }}>Approve</button>
                        <button onClick={() => decideRequest('decide_shift_swap', request.id, 'rejected')} disabled={actionLoading} style={{ flex: 1, border: 'none', borderRadius: 7, background: '#DC2626', color: '#FFFFFF', padding: '7px 0', fontSize: '0.76rem', fontWeight: 700, cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.5 : 1 }}>Reject</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          </div>
          )}

          {/* ── Time Off tab ──────────────────────────────────────────────────── */}
          {activeTab === 'timeoff' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18, alignItems: 'start' }}>
            {/* Time-off / Break-waiver requests */}
            <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
              <div style={sectionHeaderStyle}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock size={14} style={{ color: '#059669' }} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', flex: 1 }}>Time-off &amp; Break-waiver</span>
              </div>

              {timeOffRequests.length === 0 ? (
                <div style={{ padding: '24px 16px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>
                  No pending time-off requests.
                </div>
              ) : timeOffRequests.map(request => {
                const color = statusColor(request.status)
                return (
                  <div key={request.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F8FAFC' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <div>
                        <strong style={{ fontSize: '0.875rem', color: '#111827', textTransform: 'capitalize' }}>{request.request_type.replace('_', ' ')}</strong>
                        <p style={{ margin: '3px 0 0', fontSize: '0.775rem', color: '#374151', fontWeight: 600 }}>{request.requester_name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#6B7280' }}>
                          {request.shift_date ?? '—'} · {formatTime(request.start_time)}–{formatTime(request.end_time)}
                        </p>
                      </div>
                      <span style={{ background: color.bg, color: color.text, borderRadius: 999, padding: '2px 9px', fontSize: '0.65rem', fontWeight: 900, flexShrink: 0, height: 'fit-content' }}>{request.status}</span>
                    </div>
                    {request.reason && <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#4B5563', lineHeight: 1.4 }}>{request.reason}</p>}
                    {request.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => decideRequest('decide_time_off', request.id, 'approved')} disabled={actionLoading} style={{ flex: 1, border: 'none', borderRadius: 7, background: '#059669', color: '#FFFFFF', padding: '7px 0', fontSize: '0.76rem', fontWeight: 700, cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.5 : 1 }}>Approve</button>
                        <button onClick={() => decideRequest('decide_time_off', request.id, 'rejected')} disabled={actionLoading} style={{ flex: 1, border: 'none', borderRadius: 7, background: '#DC2626', color: '#FFFFFF', padding: '7px 0', fontSize: '0.76rem', fontWeight: 700, cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.5 : 1 }}>Reject</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          </div>
          )}

        </div>
      </main>

      {/* ── Review Modal ────────────────────────────────────────────────────────── */}
      {reviewOpen && selectedRecord?.record && (
        <div onClick={() => setReviewOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={event => event.stopPropagation()} style={{ width: 520, background: '#FFFFFF', borderRadius: 14, padding: 24, boxShadow: '0 12px 48px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, color: '#111827', fontSize: '1.05rem', fontWeight: 700 }}>Final Attendance Review</h2>
              <button onClick={() => setReviewOpen(false)} style={{ border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {/* UC2: Tier status badge */}
            {(() => {
              const rec = selectedRecord.record
              const tierLabel = rec.submitted_by_employee_id
                ? 'Manager Reviewed — Awaiting Owner Final'
                : rec.confirmed_by_employee_id
                ? 'Employee Confirmed — Awaiting Manager'
                : rec.clock_in_time
                ? 'CW Clocked In — Awaiting Employee Confirm'
                : 'Not Yet Clocked In'
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <ShieldCheck size={13} style={{ color: '#F97316', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.775rem', fontWeight: 700, color: '#C2410C', background: '#FFF7ED', padding: '4px 10px', borderRadius: 999, border: '1px solid #FDBA74' }}>
                    {tierLabel}
                  </span>
                </div>
              )
            })()}

            {/* Record summary */}
            <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, marginBottom: 16, fontSize: '0.84rem', color: '#374151' }}>
              <strong>{selectedRecord.assignee_name}</strong> · {selectedRecord.shift.title || 'Shift'} ·{' '}
              Clocked: {formatTime(selectedRecord.record.clock_in_time)} – {formatTime(selectedRecord.record.clock_out_time)}
            </div>

            <div style={{ display: 'grid', gap: 13 }}>
              <div>
                <label style={labelStyle}>Decision</label>
                <select value={reviewDecision} onChange={event => setReviewDecision(event.target.value as AttendanceOwnerStatus)} style={inputStyle}>
                  <option value="approved">Approve</option>
                  <option value="modified">Modify times</option>
                  <option value="rejected">Reject</option>
                </select>
              </div>
              {reviewDecision === 'modified' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Original Clock In</label>
                      <div style={{ ...inputStyle, background: '#F8FAFC', color: '#6B7280', display: 'flex', alignItems: 'center' }}>
                        {formatTime(selectedRecord.record.clock_in_time)}
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Original Clock Out</label>
                      <div style={{ ...inputStyle, background: '#F8FAFC', color: '#6B7280', display: 'flex', alignItems: 'center' }}>
                        {formatTime(selectedRecord.record.clock_out_time)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><label style={labelStyle}>Adjusted Clock In</label><input value={clockIn} onChange={event => setClockIn(event.target.value)} style={inputStyle} placeholder="HH:MM" /></div>
                    <div><label style={labelStyle}>Adjusted Clock Out</label><input value={clockOut} onChange={event => setClockOut(event.target.value)} style={inputStyle} placeholder="HH:MM" /></div>
                  </div>
                  <div>
                    <label style={labelStyle}>Reason for Modification</label>
                    <textarea value={reviewModifyReason} onChange={event => setReviewModifyReason(event.target.value)} rows={2} placeholder="Explain why times are being adjusted…" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
                  </div>
                </>
              )}
              <div><label style={labelStyle}>Owner Notes</label><textarea value={reviewNotes} onChange={event => setReviewNotes(event.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} /></div>
              {error && <div style={{ padding: 11, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, fontSize: '0.84rem', fontWeight: 700 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setReviewOpen(false)} style={{ flex: 1, border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#374151', borderRadius: 8, padding: 11, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button onClick={submitReview} disabled={actionLoading} style={{ flex: 1, border: 'none', background: '#F97316', color: '#FFFFFF', borderRadius: 8, padding: 11, fontWeight: 900, cursor: actionLoading ? 'default' : 'pointer', display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', opacity: actionLoading ? 0.7 : 1 }}>
                  {actionLoading ? <Spinner /> : null} Save Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
