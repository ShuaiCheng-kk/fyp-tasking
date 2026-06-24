'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { CalendarOff, Clock, Plus, Check, AlertTriangle, RefreshCw } from 'lucide-react'
import EmployeeSidebar from '@/components/EmployeeSidebar'

const GREEN  = '#16A34A'
const APP_BG = '#F1F5F9'
const PANEL  = '#FFFFFF'
const BORDER = '#E2E8F0'
const TEXT   = '#0F172A'
const MUTED  = '#64748B'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const LEAVE_TYPES = [
  { value: 'time_off',    label: 'Time Off' },
  { value: 'break_waiver', label: 'Break Waiver' },
]

type LeaveRequest = {
  id: string
  request_type: string
  reason: string | null
  status: string
  created_at: string
}

function statusChip(status: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending:  { bg: '#FFFBEB', color: '#B45309', label: 'Pending' },
    approved: { bg: '#ECFDF5', color: '#047857', label: 'Approved' },
    rejected: { bg: '#FEF2F2', color: '#B91C1C', label: 'Rejected' },
  }
  const s = map[status] ?? { bg: '#F1F5F9', color: MUTED, label: status }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

export default function EmployeeSettingsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [companyId, setCompanyId] = useState('')

  // Fixed off days
  const [fixedOffDays, setFixedOffDays] = useState<number[]>([])
  const [savingDays, setSavingDays] = useState(false)
  const [daysMsg, setDaysMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Leave requests
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [leaveType, setLeaveType] = useState('time_off')
  const [leaveReason, setLeaveReason] = useState('')
  const [submittingLeave, setSubmittingLeave] = useState(false)
  const [leaveMsg, setLeaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [loadingLeave, setLoadingLeave] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let uid = localStorage.getItem('tasking_user_id')
      if (!uid) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          uid = session.user.id
          localStorage.setItem('tasking_user_id', uid)
        }
      }
      if (!uid) { router.replace('/signin'); return }
      if (cancelled) return

      const meRes = await fetch(`/api/user/me?user_id=${uid}`)
      const me = await meRes.json()
      if (!me.success || me.user?.role !== 'Employee') { router.replace('/employee/dashboard'); return }
      const internalId: string = me.user.id
      setUserId(internalId)

      const cid = localStorage.getItem('tasking_company_id') ?? localStorage.getItem(`tasking_company_id_${uid}`) ?? ''
      setCompanyId(cid)

      const daysRes = await fetch(`/api/user/fixed-off-days?user_id=${internalId}`)
      const daysData = await daysRes.json()
      if (daysData.success) setFixedOffDays((daysData.days ?? []).map((d: { weekday: number }) => d.weekday))

      setLoadingLeave(true)
      const leavRes = await fetch(`/api/user/leave-requests?user_id=${internalId}`)
      const leavData = await leavRes.json()
      if (leavData.success) setLeaveRequests(leavData.requests ?? [])
      setLoadingLeave(false)
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  const toggleDay = (d: number) => {
    setFixedOffDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
    setDaysMsg(null)
  }

  const saveDays = async () => {
    if (!userId || !companyId) return
    setSavingDays(true)
    setDaysMsg(null)
    try {
      const res = await fetch('/api/user/fixed-off-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, company_id: companyId, weekdays: fixedOffDays }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setDaysMsg({ type: 'ok', text: 'Fixed off days saved successfully.' })
    } catch (err) {
      setDaysMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to save' })
    } finally {
      setSavingDays(false)
    }
  }

  const submitLeave = async () => {
    if (!userId || !companyId) return
    setSubmittingLeave(true)
    setLeaveMsg(null)
    try {
      const res = await fetch('/api/user/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, company_id: companyId, request_type: leaveType, reason: leaveReason.trim() || null }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setLeaveRequests(prev => [data.request, ...prev])
      setLeaveReason('')
      setLeaveMsg({ type: 'ok', text: 'Leave request submitted. Your manager will review it.' })
    } catch (err) {
      setLeaveMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to submit' })
    } finally {
      setSubmittingLeave(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: APP_BG, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <EmployeeSidebar />
      <main style={{ marginLeft: 64, minHeight: '100vh' }}>
        <header style={{ height: 64, background: '#14532D', borderBottom: '1px solid #0F3F24', display: 'flex', alignItems: 'center', padding: '0 32px', position: 'sticky', top: 0, zIndex: 10 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#FFFFFF' }}>Settings</h1>
        </header>

        <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>

          {/* ── Fixed Off Days ── */}
          <section style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 8, background: '#DCFCE7', color: GREEN, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <CalendarOff size={16} />
              </span>
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: TEXT }}>Fixed Off Days</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: MUTED }}>Select the weekdays you are regularly unavailable. AI scheduling will respect these.</p>
              </div>
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {WEEKDAYS.map((day, i) => {
                  const selected = fixedOffDays.includes(i)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(i)}
                      style={{
                        height: 36,
                        padding: '0 16px',
                        borderRadius: 999,
                        border: selected ? `1.5px solid ${GREEN}` : `1.5px solid ${BORDER}`,
                        background: selected ? '#DCFCE7' : '#FFFFFF',
                        color: selected ? GREEN : MUTED,
                        fontWeight: selected ? 700 : 500,
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
              {daysMsg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', borderRadius: 7, fontSize: 13, fontWeight: 600, background: daysMsg.type === 'ok' ? '#F0FDF4' : '#FEF2F2', color: daysMsg.type === 'ok' ? '#166534' : '#B91C1C', border: `1px solid ${daysMsg.type === 'ok' ? '#BBF7D0' : '#FECACA'}` }}>
                  {daysMsg.type === 'ok' ? <Check size={14} /> : <AlertTriangle size={14} />}
                  {daysMsg.text}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={saveDays}
                  disabled={savingDays}
                  style={{ height: 36, padding: '0 20px', borderRadius: 8, border: 'none', background: GREEN, color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: savingDays ? 'not-allowed' : 'pointer', opacity: savingDays ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {savingDays ? <RefreshCw size={13} /> : <Check size={13} />}
                  {savingDays ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </section>

          {/* ── Leave Requests ── */}
          <section style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 8, background: '#FFF7ED', color: '#F97316', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Clock size={16} />
              </span>
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: TEXT }}>Leave Requests</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: MUTED }}>Submit a leave request. Approved requests will be blocked in AI scheduling.</p>
              </div>
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '0 0 180px' }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>Leave type</label>
                  <select
                    value={leaveType}
                    onChange={e => setLeaveType(e.target.value)}
                    style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '0 10px', fontSize: 13, color: TEXT, background: '#FFFFFF', outline: 'none' }}
                  >
                    {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 200 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>Reason (optional)</label>
                  <input
                    type="text"
                    value={leaveReason}
                    onChange={e => setLeaveReason(e.target.value)}
                    placeholder="Brief description…"
                    style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '0 10px', fontSize: 13, color: TEXT, background: '#FFFFFF', outline: 'none' }}
                  />
                </div>
              </div>
              {leaveMsg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', borderRadius: 7, fontSize: 13, fontWeight: 600, background: leaveMsg.type === 'ok' ? '#F0FDF4' : '#FEF2F2', color: leaveMsg.type === 'ok' ? '#166534' : '#B91C1C', border: `1px solid ${leaveMsg.type === 'ok' ? '#BBF7D0' : '#FECACA'}` }}>
                  {leaveMsg.type === 'ok' ? <Check size={14} /> : <AlertTriangle size={14} />}
                  {leaveMsg.text}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={submitLeave}
                  disabled={submittingLeave}
                  style={{ height: 36, padding: '0 20px', borderRadius: 8, border: 'none', background: '#F97316', color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: submittingLeave ? 'not-allowed' : 'pointer', opacity: submittingLeave ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {submittingLeave ? <RefreshCw size={13} /> : <Plus size={13} />}
                  {submittingLeave ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>

              {loadingLeave ? (
                <p style={{ color: MUTED, fontSize: 13 }}>Loading…</p>
              ) : leaveRequests.length > 0 ? (
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>History</p>
                  {leaveRequests.map(req => (
                    <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: APP_BG, borderRadius: 7, gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT }}>{LEAVE_TYPES.find(t => t.value === req.request_type)?.label ?? req.request_type}</p>
                        {req.reason && <p style={{ margin: '2px 0 0', fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.reason}</p>}
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: MUTED }}>{new Date(req.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                      {statusChip(req.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>No leave requests yet.</p>
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}
