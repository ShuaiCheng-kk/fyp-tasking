'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  ArrowLeftRight, Calendar, Check, CheckCircle2, Edit3, HardHat, RefreshCw,
  ShieldCheck, Sparkles, UserCog, UserX,
} from 'lucide-react'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { ModalOverlay, ModalBox, ModalHeader, modalErrorBoxStyle, modalPrimaryButtonStyle } from '@/components/modal'
import Spinner from '@/components/Spinner'
import { AIAutoApprovalDecision } from '@/types/AI'
import {
  AttendanceDashboard,
  AttendanceDashboardRecord,
  AttendanceOwnerStatus,
  FixedOffDayRequestView,
  ShiftSwapRequestView,
  TimeOffRequestView,
} from '@/types/Attendance'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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
  if (!value) return '-'
  if (value.includes('T')) return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return value.slice(0, 5)
}

function statusColor(status: string): { bg: string; text: string } {
  if (status === 'approved') return { bg: '#ECFDF5', text: '#047857' }
  if (status === 'rejected') return { bg: '#FEF2F2', text: '#B91C1C' }
  if (status === 'modified') return { bg: '#FFF7ED', text: '#C2410C' }
  return { bg: '#FFFBEB', text: '#B45309' }
}

function requestTypeLabel(requestType: string): string {
  if (requestType === 'leave') return 'Leave Request'
  if (requestType === 'break_waiver') return 'Break Waiver'
  return 'Time Off'
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
  const [currentPlan, setCurrentPlan] = useState('Free')
  const [dashboard, setDashboard] = useState<AttendanceDashboard | null>(null)
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequestView[]>([])
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequestView[]>([])
  const [fixedOffDayRequests, setFixedOffDayRequests] = useState<FixedOffDayRequestView[]>([])
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

  const [activeTab, setActiveTab] = useState<'records' | 'swaps' | 'fixedoff' | 'leave'>('records')
  const tabBarRef = useRef<HTMLDivElement>(null)
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0, opacity: 0 })

  const selectedRecord = useMemo(
    () => dashboard?.records.find(row => row.record?.id === selectedRecordId) ?? null,
    [dashboard, selectedRecordId],
  )

  const records = dashboard?.records ?? []
  const internalRecords = records.filter(row => row.assignee_role === 'Manager' || row.assignee_role === 'Employee')
  const casualRecords = records.filter(row => row.assignee_role === 'Casual Worker')
  const summary = dashboard?.summary

  const fetchAttendanceData = useCallback(async (cid: string) => {
    if (!cid) return
    setLoading(true)
    setError('')
    try {
      const [dashboardRes, timeOffRes, swapRes, fixedOffRes] = await Promise.all([
        fetch(`/api/attendance?company_id=${cid}`),
        fetch(`/api/attendance?company_id=${cid}&resource=time_off`),
        fetch(`/api/attendance?company_id=${cid}&resource=shift_swaps`),
        fetch(`/api/attendance?company_id=${cid}&resource=fixed_off_days`),
      ])
      const dashboardData = await dashboardRes.json()
      const timeOffData = await timeOffRes.json()
      const swapData = await swapRes.json()
      const fixedOffData = await fixedOffRes.json()
      if (!dashboardData.success) throw new Error(dashboardData.message || 'Failed to fetch attendance')
      setDashboard(dashboardData.dashboard)
      setTimeOffRequests(timeOffData.requests ?? [])
      setSwapRequests(swapData.requests ?? [])
      setFixedOffDayRequests(fixedOffData.requests ?? [])
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
      const storedCompanyId = localStorage.getItem(`tasking_company_id_${authId}`) || meData.user.company_id || ''
      if (!storedCompanyId) return
      setCompanyId(storedCompanyId)
      const currentRes = await fetch(`/api/company/current?user_id=${authId}&company_id=${storedCompanyId}`)
      const currentData = await currentRes.json()
      if (!cancelled && currentData.success) {
        setCurrentPlan(currentData.company?.plan ?? 'Free')
      }
      if (!cancelled) await fetchAttendanceData(storedCompanyId)
    }
    void run()
    return () => { cancelled = true }
  }, [router, fetchAttendanceData])

  // UC50: Review Attendance Record
  const openReview = (row: AttendanceDashboardRecord, decision: AttendanceOwnerStatus) => {
    if (!row.record) return
    setSelectedRecordId(row.record.id)
    setReviewDecision(decision)
    setReviewNotes(row.record.owner_notes ?? '')
    setClockIn(row.record.owner_adjusted_clock_in_time ?? row.record.clock_in_time ?? '')
    setClockOut(row.record.owner_adjusted_clock_out_time ?? row.record.clock_out_time ?? '')
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

  // UC53/UC56/UC58: Approve Shift Swap / Fixed Day Off / Leave Request
  const decideRequest = async (
    kind: 'decide_time_off' | 'decide_shift_swap' | 'decide_fixed_off_day',
    id: string,
    decision: 'approved' | 'rejected',
  ) => {
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

  // UC54: Generate AI Timesheet Approval Suggestion
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

  const pendingSwapCount = swapRequests.filter(request => request.status === 'pending').length
  const pendingTimeOffByType = (type: string) => timeOffRequests.filter(request => request.status === 'pending' && request.request_type === type).length
  const pendingLeaveCount = pendingTimeOffByType('time_off') + pendingTimeOffByType('break_waiver') + pendingTimeOffByType('leave')
  const pendingFixedOffCount = fixedOffDayRequests.filter(request => request.status === 'pending').length

  const tabItems = [
    { key: 'records', label: 'Records', count: records.length },
    { key: 'swaps', label: 'Shift Swaps', count: pendingSwapCount },
    { key: 'fixedoff', label: 'Fixed Day Off', count: pendingFixedOffCount },
    { key: 'leave', label: 'Leave Requests', count: pendingLeaveCount },
  ] as const

  useLayoutEffect(() => {
    const container = tabBarRef.current
    const activeButton = tabButtonRefs.current[activeTab]
    if (!container || !activeButton) return
    const containerRect = container.getBoundingClientRect()
    const activeRect = activeButton.getBoundingClientRect()
    setTabIndicator({ left: activeRect.left - containerRect.left, width: activeRect.width, opacity: 1 })
  }, [activeTab])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F1F5F9' }}>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .att-card {
          transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
        }
        .att-card:hover {
          box-shadow: 0 8px 24px rgba(15,23,42,0.09) !important;
          transform: translateY(-2px);
        }
        .att-row {
          transition: background 0.15s ease;
        }
        .att-row:hover {
          background: #F8FAFC !important;
        }
        .att-cw-block {
          transition: background 0.15s ease, box-shadow 0.15s ease;
        }
        .att-cw-block:hover {
          background: #FAFBFC !important;
          box-shadow: inset 3px 0 0 #F97316;
        }
        .att-request-card {
          transition: box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
          animation: fadeSlideUp 0.26s ease both;
        }
        .att-request-card:hover {
          box-shadow: 0 8px 22px rgba(15,23,42,0.08);
          transform: translateY(-2px);
        }
        .att-stat-card {
          transition: box-shadow 0.2s ease, transform 0.2s ease;
          animation: fadeSlideUp 0.3s ease both;
        }
        .att-stat-card:hover {
          box-shadow: 0 8px 22px rgba(15,23,42,0.09);
          transform: translateY(-2px);
        }
      `}</style>
      <OwnerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, minHeight: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '20px 28px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexShrink: 0 }}>
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

        <div style={{ padding: '0 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div
          ref={tabBarRef}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: 4, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 999, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden', position: 'relative' }}
        >
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 4,
              left: tabIndicator.left,
              width: tabIndicator.width,
              height: 'calc(100% - 8px)',
              borderRadius: 999,
              background: 'linear-gradient(180deg, #0F172A 0%, #111827 100%)',
              boxShadow: '0 6px 18px rgba(15,23,42,0.18)',
              opacity: tabIndicator.opacity,
              transform: tabIndicator.opacity ? 'translateY(0)' : 'translateY(4px)',
              transition: 'left 0.24s cubic-bezier(0.22, 1, 0.36, 1), width 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.16s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
              pointerEvents: 'none',
            }}
          />
          {tabItems.map(tab => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                ref={el => { tabButtonRefs.current[tab.key] = el }}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  height: 36,
                  padding: '0 18px',
                  border: 'none',
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  background: 'transparent',
                  color: active ? '#FFFFFF' : '#64748B',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'color 0.18s ease, transform 0.18s ease',
                  transform: active ? 'translateY(-0.5px)' : 'translateY(0)',
                }}
              >
                {tab.label}
                <span style={{ minWidth: 22, height: 22, padding: '0 7px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: active ? 'rgba(255,255,255,0.16)' : '#F1F5F9', color: active ? '#FFFFFF' : '#64748B', fontSize: 11, fontWeight: 900 }}>
                  {loading ? '-' : tab.count}
                </span>
              </button>
            )
          })}
        </div>
        <button
          onClick={() => fetchAttendanceData(companyId)}
          disabled={loading || !companyId}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, border: '1px solid #E5E7EB', borderRadius: 9, background: '#FFFFFF', color: '#0F172A', padding: '0 13px', fontWeight: 700, fontSize: 13, cursor: loading || !companyId ? 'default' : 'pointer', opacity: loading || !companyId ? 0.55 : 1, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', flexShrink: 0 }}
        >
          {loading ? <Spinner size={14} dark /> : <RefreshCw size={14} />} Refresh
        </button>
        </div>

        <div style={{ padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {error && (
            <div style={{ padding: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, fontSize: '0.84rem', fontWeight: 800 }}>
              {error}
            </div>
          )}

          {/* ── UC51: View Attendance Status (summary stats, Records tab) ──────── */}
          {activeTab === 'records' && (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(110px, 1fr))', gap: 12 }}>
            {[
              { label: 'Assignments', value: summary?.total_assignments ?? 0 },
              { label: 'Pending', value: summary?.pending_final_review ?? 0 },
              { label: 'Approved', value: summary?.approved ?? 0 },
              { label: 'Rejected', value: summary?.rejected ?? 0 },
              { label: 'Late', value: summary?.late ?? 0 },
            ].map(({ label, value }, i) => (
              <div key={label} className="att-stat-card" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', animationDelay: `${i * 0.04}s` }}>
                <p style={{ margin: 0, color: '#6B7280', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                <strong style={{ display: 'block', marginTop: 6, fontSize: '1.35rem', color: '#111827' }}>{loading ? '-' : value}</strong>
              </div>
            ))}
          </section>
          )}

          {/* ── UC51: Internal Staff attendance status (Records tab) ───────────── */}
          {activeTab === 'records' && <section className="att-card" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            <div style={sectionHeaderStyle}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <UserCog size={15} style={{ color: '#374151' }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>Internal Staff</span>
                <span style={{ marginLeft: 8, fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', background: '#F3F4F6', padding: '2px 8px', borderRadius: 99 }}>Manager &amp; Employee</span>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280' }}>
                {internalRecords.length} assignment{internalRecords.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div style={{ padding: '20px 18px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Spinner size={15} dark /> Loading...
              </div>
            ) : internalRecords.length === 0 ? (
              <div style={{ padding: '20px 18px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>
                No Manager or Employee attendance assignments found.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Name', 'Role', 'Department', 'Date', 'Shift', 'Scheduled', 'Clock In', 'Clock Out'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #F0F4F8', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {internalRecords.map(row => {
                      const isManager = row.assignee_role === 'Manager'
                      return (
                        <tr key={row.assignment.id} className="att-row" style={{ borderBottom: '1px solid #F8FAFC' }}>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: isManager ? '#FFF7ED' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <UserCog size={13} style={{ color: isManager ? '#EA580C' : '#6B7280' }} />
                              </div>
                              <span style={{ fontWeight: 600, color: '#111827' }}>{row.assignee_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px', color: '#374151', fontWeight: 500 }}>{row.assignee_role}</td>
                          <td style={{ padding: '11px 14px', color: '#6B7280' }}>{row.department_name ?? '-'}</td>
                          <td style={{ padding: '11px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{row.shift.shift_date}</td>
                          <td style={{ padding: '11px 14px', color: '#374151' }}>{row.shift.title || 'Shift'}</td>
                          <td style={{ padding: '11px 14px', color: '#374151', whiteSpace: 'nowrap' }}>
                            {formatTime(row.shift.start_time)} - {formatTime(row.shift.end_time)}
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

          {/* ── UC50: Review Attendance Record + UC54: AI Timesheet Suggestion ── */}
          {activeTab === 'records' && <section className="att-card" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ ...sectionHeaderStyle, borderBottom: '1px solid #F0F4F8' }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <HardHat size={15} style={{ color: '#2563EB' }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>Casual Worker Attendance Review</span>
                <span style={{ marginLeft: 8, fontSize: '0.72rem', fontWeight: 700, color: '#2563EB', background: '#EFF6FF', padding: '2px 8px', borderRadius: 99, border: '1px solid #BFDBFE' }}>
                  {casualRecords.length} record{casualRecords.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => runTimesheetAI(false)}
                  disabled={aiLoading || !companyId}
                  style={{ border: 'none', borderRadius: 8, background: '#111827', color: '#FFFFFF', padding: '7px 12px', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, cursor: aiLoading ? 'default' : 'pointer', opacity: aiLoading || !companyId ? 0.6 : 1 }}
                >
                  {aiLoading ? <Spinner size={15} /> : <Sparkles size={13} />} AI Review
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

            {aiDecisions.length > 0 && (
              <div style={{ padding: '10px 18px', background: '#F0FDF4', borderBottom: '1px solid #BBF7D0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Review Results</span>
                {aiDecisions.map(decision => (
                  <div key={decision.record_id} style={{ display: 'flex', gap: 10, padding: '7px 10px', background: '#FFFFFF', borderRadius: 7, fontSize: '0.8rem', border: '1px solid #BBF7D0' }}>
                    <strong style={{ color: decision.decision === 'auto_approve' ? '#047857' : '#B45309', flexShrink: 0 }}>
                      {decision.decision === 'auto_approve' ? 'Auto-approve' : 'Flag'} | {decision.confidence}%
                    </strong>
                    <span style={{ color: '#4B5563' }}>{decision.reason}</span>
                  </div>
                ))}
              </div>
            )}

            {loading ? (
              <div style={{ padding: '24px 18px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Spinner size={15} dark /> Loading...
              </div>
            ) : casualRecords.length === 0 ? (
              <div style={{ padding: '28px 18px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>
                No casual worker attendance assignments found.
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
                    <div key={row.assignment.id} className="att-cw-block" style={{ padding: '16px 18px', borderBottom: '1px solid #F8FAFC' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr auto', gap: 14, alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <HardHat size={12} style={{ color: '#2563EB' }} />
                            </div>
                            <strong style={{ fontSize: '0.875rem', color: '#111827' }}>{row.assignee_name}</strong>
                          </div>
                          <p style={{ margin: '0 0 0 36px', fontSize: '0.76rem', color: '#9CA3AF' }}>
                            {row.shift.shift_date} | {row.shift.title || 'Shift'} | {row.department_name ?? 'No dept'}
                          </p>
                        </div>

                        <div>
                          <p style={{ margin: 0, fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>Scheduled</p>
                          <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#374151', fontWeight: 600 }}>
                            {formatTime(row.shift.start_time)} - {formatTime(row.shift.end_time)}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>Clocked</p>
                          <p style={{ margin: '2px 0 0', fontSize: '0.84rem', fontWeight: 600, color: row.record?.clock_in_time ? '#111827' : '#D1D5DB' }}>
                            {formatTime(row.record?.clock_in_time)} - {formatTime(row.record?.clock_out_time)}
                          </p>
                        </div>

                        <div />

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

                      <div style={{ marginTop: 12, marginLeft: 36, display: 'flex', alignItems: 'center' }}>
                        <PipelineStage label="CW Clocked" done={clockedIn} active={!clockedIn} />
                        <PipelineDash done={clockedIn} />
                        <PipelineStage label="Employee Confirmed" done={employeeConfirmed} active={clockedIn && !employeeConfirmed} />
                        <PipelineDash done={employeeConfirmed} />
                        <PipelineStage label="Manager Submitted" done={managerSubmitted} active={employeeConfirmed && !managerSubmitted} />
                        <PipelineDash done={managerSubmitted} />
                        <PipelineStage label="Owner Approved" done={ownerReviewed} active={managerSubmitted && !ownerReviewed} />
                      </div>

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

          {/* ── UC53: Approve Shift Swap Request ────────────────────────────────── */}
          {activeTab === 'swaps' && (
            <section className="att-card" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
              <div style={sectionHeaderStyle}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ArrowLeftRight size={14} style={{ color: '#F97316' }} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', flex: 1 }}>Shift Swap Requests</span>
              </div>

              {loading ? (
                <div style={{ padding: '24px 16px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Spinner size={15} dark /> Loading...
                </div>
              ) : swapRequests.length === 0 ? (
                <div style={{ padding: '24px 16px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>
                  No shift swap requests.
                </div>
              ) : swapRequests.map(request => {
                const color = statusColor(request.status)
                return (
                  <div key={request.id} className="att-request-card" style={{ padding: '14px 16px', borderBottom: '1px solid #F8FAFC' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <strong style={{ fontSize: '0.875rem', color: '#111827' }}>{request.requester_name}</strong>
                          <ArrowLeftRight size={11} style={{ color: '#9CA3AF' }} />
                          <strong style={{ fontSize: '0.875rem', color: '#111827' }}>{request.replacement_name}</strong>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.775rem', color: '#6B7280' }}>
                          {request.shift_title ?? 'Shift'} | {request.shift_date ?? '-'} | {formatTime(request.start_time)} - {formatTime(request.end_time)}
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
          )}

          {/* ── UC56: Approve Fixed Day Off ─────────────────────────────────────── */}
          {activeTab === 'fixedoff' && (
            <section className="att-card" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
              <div style={sectionHeaderStyle}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Calendar size={14} style={{ color: '#2563EB' }} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', flex: 1 }}>Fixed Day Off Requests</span>
              </div>

              {loading ? (
                <div style={{ padding: '24px 16px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Spinner size={15} dark /> Loading...
                </div>
              ) : fixedOffDayRequests.length === 0 ? (
                <div style={{ padding: '24px 16px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>
                  No fixed day off requests.
                </div>
              ) : fixedOffDayRequests.map(request => {
                const color = statusColor(request.status)
                return (
                  <div key={request.id} className="att-request-card" style={{ padding: '14px 16px', borderBottom: '1px solid #F8FAFC' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <div>
                        <strong style={{ fontSize: '0.875rem', color: '#111827' }}>{request.requester_name}</strong>
                        <p style={{ margin: '3px 0 0', fontSize: '0.775rem', color: '#374151', fontWeight: 600 }}>{WEEKDAYS[request.weekday]}</p>
                      </div>
                      <span style={{ background: color.bg, color: color.text, borderRadius: 999, padding: '2px 9px', fontSize: '0.65rem', fontWeight: 900, flexShrink: 0, height: 'fit-content' }}>{request.status}</span>
                    </div>
                    {request.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => decideRequest('decide_fixed_off_day', request.id, 'approved')} disabled={actionLoading} style={{ flex: 1, border: 'none', borderRadius: 7, background: '#059669', color: '#FFFFFF', padding: '7px 0', fontSize: '0.76rem', fontWeight: 700, cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.5 : 1 }}>Approve</button>
                        <button onClick={() => decideRequest('decide_fixed_off_day', request.id, 'rejected')} disabled={actionLoading} style={{ flex: 1, border: 'none', borderRadius: 7, background: '#DC2626', color: '#FFFFFF', padding: '7px 0', fontSize: '0.76rem', fontWeight: 700, cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.5 : 1 }}>Reject</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          )}

          {/* ── UC58: Approve Leave Request ──────────────────────────────────────── */}
          {activeTab === 'leave' && (
            <section className="att-card" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
              <div style={sectionHeaderStyle}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldCheck size={14} style={{ color: '#059669' }} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', flex: 1 }}>Leave Requests</span>
              </div>

              {loading ? (
                <div style={{ padding: '24px 16px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Spinner size={15} dark /> Loading...
                </div>
              ) : timeOffRequests.length === 0 ? (
                <div style={{ padding: '24px 16px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>
                  No leave requests.
                </div>
              ) : timeOffRequests.map(request => {
                const color = statusColor(request.status)
                return (
                  <div key={request.id} className="att-request-card" style={{ padding: '14px 16px', borderBottom: '1px solid #F8FAFC' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <div>
                        <strong style={{ fontSize: '0.875rem', color: '#111827' }}>{requestTypeLabel(request.request_type)}</strong>
                        <p style={{ margin: '3px 0 0', fontSize: '0.775rem', color: '#374151', fontWeight: 600 }}>{request.requester_name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#6B7280' }}>
                          {request.shift_date ?? '-'} | {formatTime(request.start_time)} - {formatTime(request.end_time)}
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
          )}

        </div>
      </main>

      {/* ── UC50: Review Attendance Record modal ────────────────────────────────── */}
      {reviewOpen && selectedRecord?.record && (
        <ModalOverlay onClose={() => setReviewOpen(false)}>
          <ModalBox>
            <ModalHeader title="Review Attendance Record" icon={<ShieldCheck size={15} color="#fff" strokeWidth={2.5} />} onClose={() => setReviewOpen(false)} />

            <div style={{ padding: '20px 24px 0' }}>
              {(() => {
                const rec = selectedRecord.record
                const tierLabel = rec.submitted_by_employee_id
                  ? 'Manager Reviewed - Awaiting Owner Final'
                  : rec.confirmed_by_employee_id
                  ? 'Employee Confirmed - Awaiting Manager'
                  : rec.clock_in_time
                  ? 'CW Clocked In - Awaiting Employee Confirm'
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

              <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, marginBottom: 16, fontSize: '0.84rem', color: '#374151' }}>
                <strong>{selectedRecord.assignee_name}</strong> | {selectedRecord.shift.title || 'Shift'} |{' '}
                Clocked: {formatTime(selectedRecord.record.clock_in_time)} - {formatTime(selectedRecord.record.clock_out_time)}
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><label style={labelStyle}>Adjusted Clock In</label><input value={clockIn} onChange={event => setClockIn(event.target.value)} style={inputStyle} placeholder="HH:MM" /></div>
                    <div><label style={labelStyle}>Adjusted Clock Out</label><input value={clockOut} onChange={event => setClockOut(event.target.value)} style={inputStyle} placeholder="HH:MM" /></div>
                  </div>
                )}
                <div><label style={labelStyle}>Owner Notes</label><textarea value={reviewNotes} onChange={event => setReviewNotes(event.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} /></div>
              </div>
            </div>

            {error && <div style={modalErrorBoxStyle}>{error}</div>}

            <div style={{ padding: '0 24px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={submitReview} disabled={actionLoading} style={modalPrimaryButtonStyle(actionLoading)}>
                {actionLoading ? <Spinner size={13} /> : <Check size={13} />} Save Review
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}
    </div>
  )
}
