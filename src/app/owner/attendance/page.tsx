'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Check, Clock, Crown, Edit3, ShieldCheck, Sparkles, UserX, X } from 'lucide-react'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
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

function formatTime(value: string | null | undefined): string {
  if (!value) return '-'
  if (value.includes('T')) {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return value.slice(0, 5)
}

function statusColor(status: string): { bg: string; text: string } {
  if (status === 'approved') return { bg: '#ECFDF5', text: '#047857' }
  if (status === 'rejected' || status === 'absent') return { bg: '#FEF2F2', text: '#B91C1C' }
  if (status === 'modified' || status === 'late' || status === 'overtime') return { bg: '#FFF7ED', text: '#C2410C' }
  return { bg: '#FFFBEB', text: '#B45309' }
}

function Spinner() {
  return (
    <svg className="animate-spin" width="15" height="15" viewBox="0 0 18 18" style={{ display: 'inline-block' }}>
      <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
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

  const selectedRecord = useMemo(
    () => dashboard?.records.find(row => row.record?.id === selectedRecordId) ?? null,
    [dashboard, selectedRecordId],
  )

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
      if (!timeOffData.success) throw new Error(timeOffData.message || 'Failed to fetch requests')
      if (!swapData.success) throw new Error(swapData.message || 'Failed to fetch shift swaps')
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

  const summary = dashboard?.summary
  const records = dashboard?.records ?? []

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F7F8FA', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <OwnerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, minHeight: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Page header — matches Dashboard style */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              {companyName ? `Attendance for ${companyName}` : 'Attendance'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {ownerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#0F172A', color: '#FFFFFF', flexShrink: 0 }}>
                  <Crown size={13} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ownerName}</span>
              </div>
            )}
            {companyId && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        <div style={{ padding: '0 28px 8px', flexShrink: 0 }}>
          <button
            onClick={() => fetchAttendanceData(companyId)}
            disabled={loading || !companyId}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1.5px solid #E5E7EB', borderRadius: 8, background: '#fff', color: '#374151', padding: '7px 14px', fontWeight: 600, fontSize: '0.8125rem', cursor: loading || !companyId ? 'default' : 'pointer', opacity: loading || !companyId ? 0.5 : 1 }}
          >
            Refresh
          </button>
        </div>

        <div style={{ padding: '0 28px 24px', display: 'grid', gap: 18 }}>
          {error && <div style={{ padding: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, fontSize: '0.84rem', fontWeight: 800 }}>{error}</div>}

          <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
            <div>
              <strong style={{ color: '#111827', fontSize: '0.94rem' }}>AI Timesheet Review</strong>
              <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.82rem' }}>
                Reviews pending attendance records and flags suspicious timesheets before final approval.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => runTimesheetAI(false)} disabled={aiLoading || !companyId} style={{ border: 'none', borderRadius: 8, background: '#111827', color: '#FFFFFF', padding: '9px 12px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 7, cursor: aiLoading ? 'default' : 'pointer' }}>
                {aiLoading ? <Spinner /> : <Sparkles size={15} />} Review
              </button>
              <button onClick={() => runTimesheetAI(true)} disabled={aiLoading || !companyId || !internalUserId} style={{ border: 'none', borderRadius: 8, background: '#F97316', color: '#FFFFFF', padding: '9px 12px', fontWeight: 900, cursor: aiLoading ? 'default' : 'pointer' }}>
                Apply clean approvals
              </button>
            </div>
          </section>

          {aiDecisions.length > 0 && (
            <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, display: 'grid', gap: 8 }}>
              {aiDecisions.map(decision => (
                <div key={decision.record_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 10px', background: '#F8FAFC', borderRadius: 8, fontSize: '0.82rem' }}>
                  <strong style={{ color: decision.decision === 'auto_approve' ? '#047857' : '#B45309' }}>{decision.decision} · {decision.confidence}%</strong>
                  <span style={{ color: '#4B5563', flex: 1 }}>{decision.reason}</span>
                </div>
              ))}
            </section>
          )}

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(120px, 1fr))', gap: 12 }}>
            {[
              ['Assignments', summary?.total_assignments ?? 0],
              ['Pending', summary?.pending_final_review ?? 0],
              ['Approved', summary?.approved ?? 0],
              ['Late', summary?.late ?? 0],
              ['Absent', summary?.absent ?? 0],
              ['Overtime', summary?.overtime ?? 0],
            ].map(([label, value]) => (
              <div key={label} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14 }}>
                <p style={{ margin: 0, color: '#6B7280', fontSize: '0.76rem', fontWeight: 900, textTransform: 'uppercase' }}>{label}</p>
                <strong style={{ display: 'block', marginTop: 8, fontSize: '1.35rem', color: '#111827' }}>{value}</strong>
              </div>
            ))}
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 18, alignItems: 'start' }}>
            <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: 14, borderBottom: '1px solid #F1F5F9', fontSize: '0.78rem', fontWeight: 900, color: '#6B7280', textTransform: 'uppercase' }}>Attendance Records</div>
              {loading ? (
                <div style={{ padding: 20, color: '#9CA3AF' }}>Loading...</div>
              ) : records.length === 0 ? (
                <div style={{ padding: 20, color: '#9CA3AF' }}>No shift assignments found.</div>
              ) : records.map(row => {
                const ownerStatus = row.record?.owner_status ?? 'pending'
                const color = statusColor(ownerStatus)
                return (
                  <div key={row.assignment.id} style={{ padding: 14, borderBottom: '1px solid #F1F5F9', display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 190px', gap: 12, alignItems: 'center' }}>
                    <div>
                      <strong style={{ color: '#111827', fontSize: '0.92rem' }}>{row.shift.title || 'Shift'}</strong>
                      <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.8rem' }}>{row.department_name ?? 'No department'} · {row.shift.shift_date} · {formatTime(row.shift.start_time)}-{formatTime(row.shift.end_time)}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, color: '#111827', fontWeight: 800, fontSize: '0.86rem' }}>{row.assignee_name}</p>
                      <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.78rem' }}>{row.assignee_role}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, color: '#111827', fontWeight: 800, fontSize: '0.84rem' }}>{formatTime(row.record?.clock_in_time)} - {formatTime(row.record?.clock_out_time)}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                        {row.exceptions.length === 0 ? <span style={{ color: '#059669', fontSize: '0.72rem', fontWeight: 900 }}>clean</span> : row.exceptions.map(item => {
                          const exceptionColor = statusColor(item)
                          return <span key={item} style={{ background: exceptionColor.bg, color: exceptionColor.text, borderRadius: 999, padding: '2px 7px', fontSize: '0.68rem', fontWeight: 900 }}>{item}</span>
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 7 }}>
                      <span style={{ background: color.bg, color: color.text, borderRadius: 999, padding: '4px 9px', fontSize: '0.7rem', fontWeight: 900 }}>{ownerStatus}</span>
                      {row.record && (
                        <>
                          <button onClick={() => openReview(row, 'approved')} title="Approve" style={{ border: 'none', borderRadius: 7, background: '#059669', color: '#FFFFFF', width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Check size={15} /></button>
                          <button onClick={() => openReview(row, 'modified')} title="Modify" style={{ border: 'none', borderRadius: 7, background: '#F97316', color: '#FFFFFF', width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Edit3 size={14} /></button>
                          <button onClick={() => openReview(row, 'rejected')} title="Reject" style={{ border: 'none', borderRadius: 7, background: '#DC2626', color: '#FFFFFF', width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><UserX size={14} /></button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </section>

            <aside style={{ display: 'grid', gap: 14 }}>
              <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: 14, borderBottom: '1px solid #F1F5F9', display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.78rem', fontWeight: 900, color: '#6B7280', textTransform: 'uppercase' }}><Clock size={15} /> Time-off / Break-waiver</div>
                {timeOffRequests.length === 0 ? <div style={{ padding: 16, color: '#9CA3AF', fontSize: '0.88rem' }}>No requests.</div> : timeOffRequests.map(request => <RequestCard key={request.id} title={request.request_type.replace('_', ' ')} name={request.requester_name} status={request.status} detail={`${request.shift_date ?? 'No shift'} ${formatTime(request.start_time)}-${formatTime(request.end_time)}`} reason={request.reason} onApprove={() => decideRequest('decide_time_off', request.id, 'approved')} onReject={() => decideRequest('decide_time_off', request.id, 'rejected')} disabled={actionLoading || request.status !== 'pending'} />)}
              </section>

              <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: 14, borderBottom: '1px solid #F1F5F9', display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.78rem', fontWeight: 900, color: '#6B7280', textTransform: 'uppercase' }}><ShieldCheck size={15} /> Shift Swaps</div>
                {swapRequests.length === 0 ? <div style={{ padding: 16, color: '#9CA3AF', fontSize: '0.88rem' }}>No swap requests.</div> : swapRequests.map(request => <RequestCard key={request.id} title="Shift swap" name={`${request.requester_name} -> ${request.replacement_name}`} status={request.status} detail={`${request.shift_date ?? 'No shift'} ${formatTime(request.start_time)}-${formatTime(request.end_time)}`} reason={request.reason} onApprove={() => decideRequest('decide_shift_swap', request.id, 'approved')} onReject={() => decideRequest('decide_shift_swap', request.id, 'rejected')} disabled={actionLoading || request.status !== 'pending'} />)}
              </section>
            </aside>
          </div>
        </div>
      </main>

      {reviewOpen && selectedRecord?.record && (
        <div onClick={() => setReviewOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={event => event.stopPropagation()} style={{ width: 520, background: '#FFFFFF', borderRadius: 14, padding: 24, boxShadow: '0 12px 48px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, color: '#111827', fontSize: '1.05rem' }}>Final Attendance Review</h2>
              <button onClick={() => setReviewOpen(false)} style={{ border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 13 }}>
              <div>
                <label style={labelStyle}>Decision</label>
                <select value={reviewDecision} onChange={event => setReviewDecision(event.target.value as AttendanceOwnerStatus)} style={inputStyle}>
                  <option value="approved">Approve</option>
                  <option value="modified">Modify</option>
                  <option value="rejected">Reject</option>
                </select>
              </div>
              {reviewDecision === 'modified' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Clock In</label><input value={clockIn} onChange={event => setClockIn(event.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Clock Out</label><input value={clockOut} onChange={event => setClockOut(event.target.value)} style={inputStyle} /></div>
                </div>
              )}
              <div><label style={labelStyle}>Owner Notes</label><textarea value={reviewNotes} onChange={event => setReviewNotes(event.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} /></div>
              {error && <div style={{ padding: 11, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, fontSize: '0.84rem', fontWeight: 700 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button onClick={() => setReviewOpen(false)} style={{ flex: 1, border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#374151', borderRadius: 8, padding: 11, fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
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

function RequestCard(props: {
  title: string
  name: string
  status: string
  detail: string
  reason: string | null
  disabled: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const color = statusColor(props.status)
  return (
    <div style={{ padding: 14, borderBottom: '1px solid #F1F5F9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ color: '#111827', fontSize: '0.88rem', textTransform: 'capitalize' }}>{props.title}</strong>
        <span style={{ background: color.bg, color: color.text, borderRadius: 999, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 900 }}>{props.status}</span>
      </div>
      <p style={{ margin: '6px 0 0', color: '#4B5563', fontSize: '0.8rem', fontWeight: 800 }}>{props.name}</p>
      <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.78rem' }}>{props.detail}</p>
      {props.reason && <p style={{ margin: '8px 0 0', color: '#374151', fontSize: '0.8rem', lineHeight: 1.45 }}>{props.reason}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={props.onApprove} disabled={props.disabled} style={{ flex: 1, border: 'none', borderRadius: 7, background: '#059669', color: '#FFFFFF', padding: '8px 0', fontSize: '0.76rem', fontWeight: 900, opacity: props.disabled ? 0.45 : 1, cursor: props.disabled ? 'default' : 'pointer' }}>Approve</button>
        <button onClick={props.onReject} disabled={props.disabled} style={{ flex: 1, border: 'none', borderRadius: 7, background: '#DC2626', color: '#FFFFFF', padding: '8px 0', fontSize: '0.76rem', fontWeight: 900, opacity: props.disabled ? 0.45 : 1, cursor: props.disabled ? 'default' : 'pointer' }}>Reject</button>
      </div>
    </div>
  )
}
