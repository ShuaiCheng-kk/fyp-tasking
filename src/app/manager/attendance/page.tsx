'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  Briefcase, Check, CheckSquare, Clock, Edit3, RefreshCw, X,
  AlertTriangle, CalendarDays, Users, ChevronDown, UserCog,
} from 'lucide-react'
import ManagerSidebar from '@/components/ManagerSidebar'
import {
  AttendanceDashboard,
  AttendanceDashboardRecord,
  ShiftSwapRequestView,
  TimeOffRequestView,
} from '@/types/Attendance'

// ─── Theme ────────────────────────────────────────────────────────────────────
const BLUE   = '#2563EB'
const APP_BG = '#F1F5F9'
const PANEL  = '#FFFFFF'
const BORDER = '#E2E8F0'
const TEXT   = '#0F172A'
const MUTED  = '#64748B'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(val: string | null | undefined): string {
  if (!val) return '—'
  if (val.includes('T')) return new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return val.slice(0, 5)
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusChip(status: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    approved:         { bg: '#ECFDF5', color: '#047857', label: 'Approved' },
    owner_approved:   { bg: '#ECFDF5', color: '#047857', label: 'Approved' },
    rejected:         { bg: '#FEF2F2', color: '#B91C1C', label: 'Rejected' },
    owner_rejected:   { bg: '#FEF2F2', color: '#B91C1C', label: 'Rejected' },
    manager_reviewed: { bg: '#EFF6FF', color: '#1D4ED8', label: 'Under review' },
    submitted:        { bg: '#FFF7ED', color: '#C2410C', label: 'Needs review' },
    pending:          { bg: '#FFFBEB', color: '#B45309', label: 'Pending' },
    late:             { bg: '#FFF7ED', color: '#C2410C', label: 'Late' },
    absent:           { bg: '#FEF2F2', color: '#B91C1C', label: 'Absent' },
  }
  const s = map[status] ?? { bg: '#F1F5F9', color: MUTED, label: status }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function StatCard({ label, value, icon, accentBg, accentColor }: { label: string; value: number; icon: React.ReactNode; accentBg: string; accentColor: string }) {
  return (
    <div style={{ background: PANEL, borderRadius: 14, padding: '14px 16px', flex: 1, minWidth: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor }}>{icon}</div>
      </div>
      <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: TEXT, letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</p>
    </div>
  )
}

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <svg className="animate-spin" width={14} height={14} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={light ? 'rgba(255,255,255,0.35)' : 'rgba(37,99,235,0.2)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={light ? 'white' : BLUE} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

type Department = { id: string; name: string }
type TabKey = 'records' | 'time_off' | 'swaps'

export default function ManagerAttendancePage() {
  const router = useRouter()
  const [managerId, setManagerId] = useState('')
  const [managerName, setManagerName] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState('')

  const [dashboard, setDashboard] = useState<AttendanceDashboard | null>(null)
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequestView[]>([])
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequestView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [activeTab, setActiveTab] = useState<TabKey>('records')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRecord, setReviewRecord] = useState<AttendanceDashboardRecord | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // ── Auth init ──
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let uid = localStorage.getItem('tasking_user_id')
      if (!uid) {
        const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { session } } = await sb.auth.getSession()
        if (session?.user?.id) { uid = session.user.id; localStorage.setItem('tasking_user_id', uid) }
      }
      if (!uid) { router.replace('/signin'); return }
      const meRes = await fetch(`/api/user/me?user_id=${uid}`)
      const meData = await meRes.json()
      if (cancelled || !meData.success) return
      const { id, full_name, company_id } = meData.user
      if (id) setManagerId(id)
      if (full_name) setManagerName(full_name)
      const cid = localStorage.getItem(`tasking_company_id_${uid}`) || company_id || ''
      if (!cid) return
      setCompanyId(cid)
      const [compRes, deptRes] = await Promise.all([
        fetch(`/api/company/current?user_id=${uid}&company_id=${cid}`),
        fetch(`/api/manager/departments?manager_id=${id}`),
      ])
      const compData = await compRes.json()
      const deptData = await deptRes.json()
      if (cancelled) return
      if (compData.success) setCompanyName(compData.company?.name ?? '')
      const depts: Department[] = deptData.success ? (deptData.departments ?? []) : []
      setDepartments(depts)
      if (depts.length > 0) setSelectedDeptId(depts[0].id)
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  const fetchData = useCallback(async (cid: string) => {
    if (!cid) return
    setLoading(true)
    setError('')
    try {
      const [dashRes, toRes, swapRes] = await Promise.all([
        fetch(`/api/attendance?company_id=${cid}`),
        fetch(`/api/attendance?company_id=${cid}&resource=time_off`),
        fetch(`/api/attendance?company_id=${cid}&resource=shift_swaps`),
      ])
      const dashData = await dashRes.json()
      const toData   = await toRes.json()
      const swapData = await swapRes.json()
      if (!dashData.success) throw new Error(dashData.message ?? 'Failed to fetch')
      setDashboard(dashData.dashboard)
      if (toData.success)   setTimeOffRequests(toData.requests ?? [])
      if (swapData.success) setSwapRequests(swapData.requests ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch attendance')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (companyId) void fetchData(companyId) }, [companyId, fetchData])

  // Filter records by selected department
  const deptRecords = useMemo<AttendanceDashboardRecord[]>(() => {
    if (!dashboard) return []
    if (!selectedDeptId) return dashboard.records
    return dashboard.records.filter(row => row.shift.department_id === selectedDeptId)
  }, [dashboard, selectedDeptId])

  const summary = useMemo(() => {
    const records = deptRecords
    return {
      total:     records.length,
      needs_review: records.filter(r => r.record?.status === 'submitted' && r.record?.owner_status === 'pending').length,
      reviewed:  records.filter(r => r.record?.status === 'manager_reviewed').length,
      approved:  records.filter(r => r.record?.owner_status === 'approved').length,
      late:      records.filter(r => r.exceptions.includes('late')).length,
      absent:    records.filter(r => r.exceptions.includes('absent')).length,
    }
  }, [deptRecords])

  function openReview(row: AttendanceDashboardRecord) {
    setReviewRecord(row)
    setReviewNotes(row.record?.manager_notes ?? '')
    setReviewOpen(true)
  }

  async function handleManagerReview() {
    if (!reviewRecord?.record || !managerId) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manager_review', id: reviewRecord.record.id, manager_id: managerId, manager_notes: reviewNotes || null }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message ?? 'Failed to submit review')
      setReviewOpen(false)
      void fetchData(companyId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit review')
    } finally { setActionLoading(false) }
  }

  async function handleDecideTimeOff(id: string, decision: 'approved' | 'rejected') {
    if (!managerId) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decide_time_off', id, reviewer_id: managerId, decision }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      void fetchData(companyId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed')
    } finally { setActionLoading(false) }
  }

  async function handleDecideSwap(id: string, decision: 'approved' | 'rejected') {
    if (!managerId) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decide_shift_swap', id, reviewer_id: managerId, decision }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      void fetchData(companyId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed')
    } finally { setActionLoading(false) }
  }

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'records', label: 'Attendance Records', count: summary.needs_review > 0 ? summary.needs_review : undefined },
    { key: 'time_off', label: 'Time Off', count: timeOffRequests.filter(r => r.status === 'pending').length || undefined },
    { key: 'swaps', label: 'Shift Swaps', count: swapRequests.filter(r => r.status === 'pending').length || undefined },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: APP_BG, fontFamily: 'inherit' }}>
      <style>{`
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .mgr-att-row:hover td { background: #EFF6FF !important; }
      `}</style>
      <ManagerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, minHeight: '100vh', overflowY: 'auto' }}>

        {/* Page header */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              {(() => { const n = departments.find(d => d.id === selectedDeptId)?.name; return n ? `Attendance for ${n}` : 'Attendance' })()}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {managerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#1E3A5F', color: '#FFFFFF', flexShrink: 0 }}>
                  <UserCog size={13} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{managerName}</span>
              </div>
            )}
            <button onClick={() => void fetchData(companyId)} disabled={loading || !companyId}
              style={{ height: 34, width: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 9, cursor: 'pointer', color: MUTED }}>
              {loading ? <Spinner /> : <RefreshCw size={14} />}
            </button>
          </div>
        </div>

        <div style={{ padding: '0 28px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Stats + dept filter */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap', animation: 'fadeSlideUp 0.3s ease both' }}>
            <StatCard label="Total Records"   value={summary.total}        icon={<CalendarDays size={14} />} accentBg="#EFF6FF" accentColor={BLUE} />
            <StatCard label="Needs Review"    value={summary.needs_review} icon={<AlertTriangle size={14} />} accentBg="#FFF7ED" accentColor="#C2410C" />
            <StatCard label="Under Review"    value={summary.reviewed}     icon={<Edit3 size={14} />}        accentBg="#EFF6FF" accentColor="#1D4ED8" />
            <StatCard label="Approved"        value={summary.approved}     icon={<Check size={14} />}        accentBg="#ECFDF5" accentColor="#047857" />
            <StatCard label="Late"            value={summary.late}         icon={<Clock size={14} />}        accentBg="#FFF7ED" accentColor="#C2410C" />
            <StatCard label="Absent"          value={summary.absent}       icon={<Users size={14} />}        accentBg="#FEF2F2" accentColor="#B91C1C" />
          </div>

          {/* Tabs + dept filter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  style={{ height: 36, padding: '0 13px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, background: activeTab === tab.key ? '#EFF6FF' : PANEL, border: activeTab === tab.key ? `1.5px solid ${BLUE}44` : `1.5px solid ${BORDER}`, color: activeTab === tab.key ? BLUE : MUTED, transition: 'all 0.15s' }}
                >
                  {tab.label}
                  {tab.count && tab.count > 0 && (
                    <span style={{ minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
            {departments.length > 1 && (
              <div style={{ position: 'relative' }}>
                <select value={selectedDeptId} onChange={e => setSelectedDeptId(e.target.value)}
                  style={{ height: 34, padding: '0 26px 0 10px', border: `1px solid ${BORDER}`, borderRadius: 8, background: PANEL, color: TEXT, fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer', appearance: 'none' }}>
                  <option value="">All departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown size={11} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', color: MUTED, pointerEvents: 'none' }} />
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{error}</div>
          )}

          {/* ── Attendance Records tab ── */}
          {activeTab === 'records' && (
            <div style={{ background: PANEL, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', animation: 'fadeSlideUp 0.28s ease both 0.05s' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Worker', 'Dept', 'Shift Date', 'Clock In', 'Clock Out', 'Status', 'Exceptions', 'Actions'].map(col => (
                        <th key={col} style={{ padding: '10px 14px', textAlign: col === 'Worker' || col === 'Dept' ? 'left' : 'center', fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} style={{ padding: '36px 20px', textAlign: 'center', color: MUTED }}><Spinner /> Loading…</td></tr>
                    ) : deptRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '48px 20px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#9CA3AF' }}>
                            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: BLUE }}><CheckSquare size={20} strokeWidth={1.5} /></div>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>No attendance records</p>
                          </div>
                        </td>
                      </tr>
                    ) : deptRecords.map((row, i) => {
                      const rec = row.record
                      const status = rec?.status ?? 'no record'
                      const needsReview = rec && rec.status === 'submitted' && rec.owner_status === 'pending'
                      return (
                        <tr key={row.assignment.id} className="mgr-att-row" style={{ background: i % 2 === 0 ? PANEL : '#FAFBFC' }}>
                          <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}` }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT }}>{row.assignee_name}</p>
                            <p style={{ margin: 0, fontSize: 11, color: MUTED, fontWeight: 500 }}>{row.assignee_role}</p>
                          </td>
                          <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12.5, color: MUTED, fontWeight: 500 }}>{row.department_name ?? '—'}</td>
                          <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12.5, color: TEXT, fontWeight: 500, textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtDate(row.shift.shift_date)}</td>
                          <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12.5, color: TEXT, textAlign: 'center', fontWeight: 500 }}>{fmtTime(rec?.clock_in_time)}</td>
                          <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12.5, color: TEXT, textAlign: 'center', fontWeight: 500 }}>{fmtTime(rec?.clock_out_time)}</td>
                          <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>{statusChip(status)}</td>
                          <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                              {row.exceptions.map(ex => (
                                <span key={ex} style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: ex === 'absent' ? '#FEF2F2' : '#FFF7ED', color: ex === 'absent' ? '#B91C1C' : '#C2410C' }}>{ex}</span>
                              ))}
                              {row.exceptions.length === 0 && <span style={{ fontSize: 11, color: '#CBD5E1' }}>—</span>}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>
                            {rec && (
                              <button onClick={() => openReview(row)}
                                style={{ height: 30, padding: '0 10px', background: needsReview ? BLUE : '#F1F5F9', color: needsReview ? '#fff' : MUTED, border: 'none', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Edit3 size={11} /> {needsReview ? 'Review' : 'Notes'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Time Off tab ── */}
          {activeTab === 'time_off' && (
            <div style={{ background: PANEL, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', animation: 'fadeSlideUp 0.28s ease both' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Requester', 'Type', 'Shift', 'Shift Date', 'Reason', 'Status', 'Actions'].map(col => (
                        <th key={col} style={{ padding: '10px 14px', textAlign: col === 'Requester' ? 'left' : 'center', fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeOffRequests.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: '32px 20px', textAlign: 'center', color: MUTED, fontSize: 13 }}>No time off requests</td></tr>
                    ) : timeOffRequests.map((req, i) => (
                      <tr key={req.id} className="mgr-att-row" style={{ background: i % 2 === 0 ? PANEL : '#FAFBFC' }}>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 700, color: TEXT }}>{req.requester_name}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#F1F5F9', color: MUTED }}>{req.request_type}</span></td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: MUTED, textAlign: 'center' }}>{req.shift_title ?? '—'}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: MUTED, textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtDate(req.shift_date)}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: MUTED, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.reason ?? '—'}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>{statusChip(req.status)}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>
                          {req.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button onClick={() => handleDecideTimeOff(req.id, 'approved')} disabled={actionLoading}
                                style={{ height: 28, padding: '0 10px', background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Check size={11} /> Approve
                              </button>
                              <button onClick={() => handleDecideTimeOff(req.id, 'rejected')} disabled={actionLoading}
                                style={{ height: 28, padding: '0 10px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <X size={11} /> Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Shift Swaps tab ── */}
          {activeTab === 'swaps' && (
            <div style={{ background: PANEL, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', animation: 'fadeSlideUp 0.28s ease both' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Requester', 'Replacement', 'Shift', 'Shift Date', 'Reason', 'Status', 'Actions'].map(col => (
                        <th key={col} style={{ padding: '10px 14px', textAlign: col === 'Requester' ? 'left' : 'center', fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {swapRequests.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: '32px 20px', textAlign: 'center', color: MUTED, fontSize: 13 }}>No shift swap requests</td></tr>
                    ) : swapRequests.map((req, i) => (
                      <tr key={req.id} className="mgr-att-row" style={{ background: i % 2 === 0 ? PANEL : '#FAFBFC' }}>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 700, color: TEXT }}>{req.requester_name}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12.5, color: MUTED, fontWeight: 500, textAlign: 'center' }}>{req.replacement_name}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: MUTED, textAlign: 'center' }}>{req.shift_title ?? '—'}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: MUTED, textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtDate(req.shift_date)}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: MUTED, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.reason ?? '—'}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>{statusChip(req.status)}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>
                          {req.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button onClick={() => handleDecideSwap(req.id, 'approved')} disabled={actionLoading}
                                style={{ height: 28, padding: '0 10px', background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Check size={11} /> Approve
                              </button>
                              <button onClick={() => handleDecideSwap(req.id, 'rejected')} disabled={actionLoading}
                                style={{ height: 28, padding: '0 10px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <X size={11} /> Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── Review Modal ── */}
      {reviewOpen && reviewRecord && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 480, maxWidth: '92vw', background: PANEL, borderRadius: 18, boxShadow: '0 24px 70px rgba(0,0,0,0.18)', overflow: 'hidden', animation: 'fadeSlideUp 0.22s ease both' }}>
            <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid #F0F4F8`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: '#EFF6FF', color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit3 size={15} />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: '0.9375rem', color: TEXT, margin: 0 }}>Manager Review</h3>
              </div>
              <button onClick={() => setReviewOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4 }}><X size={18} /></button>
            </div>

            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Record info */}
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Worker</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{reviewRecord.assignee_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Shift Date</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{fmtDate(reviewRecord.shift.shift_date)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Clock In</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{fmtTime(reviewRecord.record?.clock_in_time)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Clock Out</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{fmtTime(reviewRecord.record?.clock_out_time)}</span>
                </div>
                {reviewRecord.record?.employee_notes && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>Employee Notes</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{reviewRecord.record.employee_notes}</span>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Manager Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder="Add notes for this attendance record…"
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55, background: '#FAFBFC', color: TEXT, fontWeight: 500 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '0 22px 18px' }}>
              <button onClick={() => setReviewOpen(false)} style={{ flex: 1, height: 40, background: 'none', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontWeight: 700, fontSize: 13, color: MUTED, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleManagerReview} disabled={actionLoading}
                style={{ flex: 1, height: 40, background: BLUE, border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, color: '#fff', cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {actionLoading ? <><Spinner light /> Submitting…</> : <><Check size={13} /> Submit Review</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
