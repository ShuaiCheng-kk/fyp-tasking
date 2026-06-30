'use client'

// UC50/UC51 — Records: today's stat blocks + live timeline, Past Attendance Record (Internal
// Staff / Casual Worker) calendar modal, and the Review Attendance Record modal. Shared verbatim
// between the Owner Attendance page and the Dashboard "Attendance" tab — one UI, no duplication.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Calendar, Check, ChevronLeft, ChevronRight, Clock, HardHat,
  LogOut, RefreshCw, ShieldCheck, UserCog, UserX, X,
} from 'lucide-react'
import { ModalOverlay, ModalBox, ModalHeader, modalErrorBoxStyle, modalPrimaryButtonStyle } from '@/components/modal'
import Spinner from '@/components/Spinner'
import ScheduleTimeline from '@/components/ScheduleTimeline'
import {
  AttendanceDashboardRecord,
  AttendanceOwnerStatus,
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
  if (value.includes('T')) return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return value.slice(0, 5)
}

export interface AttendanceRecordsPanelProps {
  companyId: string
  internalUserId: string
}

export default function AttendanceRecordsPanel({ companyId, internalUserId }: AttendanceRecordsPanelProps) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedRecordId, setSelectedRecordId] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewDecision, setReviewDecision] = useState<AttendanceOwnerStatus>('approved')
  const [reviewNotes, setReviewNotes] = useState('')
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [todayRecords, setTodayRecords] = useState<AttendanceDashboardRecord[]>([])
  const [todayLoading, setTodayLoading] = useState(false)
  const [attendanceTimelineRefreshKey, setAttendanceTimelineRefreshKey] = useState(0)
  const [activeStatFilter, setActiveStatFilter] = useState<string | null>(null)
  const [pastModalRole, setPastModalRole] = useState<'Internal' | 'Casual Worker' | null>(null)
  const [pastMonthCursor, setPastMonthCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [monthRecords, setMonthRecords] = useState<AttendanceDashboardRecord[]>([])
  const [monthLoading, setMonthLoading] = useState(false)
  const [pastCellDetail, setPastCellDetail] = useState<{ userId: string; date: string } | null>(null)

  const selectedRecord = useMemo(
    () => todayRecords.find(row => row.record?.id === selectedRecordId)
      ?? monthRecords.find(row => row.record?.id === selectedRecordId)
      ?? null,
    [todayRecords, monthRecords, selectedRecordId],
  )

  const fetchTodayRecords = useCallback(async (cid: string) => {
    if (!cid) return
    setTodayLoading(true)
    try {
      const res = await fetch(`/api/attendance?company_id=${cid}&resource=range&from_date=${todayKey}&to_date=${todayKey}`)
      const data = await res.json()
      if (data.success) setTodayRecords(data.records ?? [])
    } catch {
      // today's timeline is a live secondary view — a failed refresh just leaves the last good data
    } finally {
      setTodayLoading(false)
    }
  }, [todayKey])

  const monthRangeKeys = useCallback((monthStart: Date) => {
    const from = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1)
    const to = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
  }, [])

  const fetchMonthRecords = useCallback(async (cid: string, monthStart: Date) => {
    if (!cid) return
    setMonthLoading(true)
    try {
      const { from, to } = monthRangeKeys(monthStart)
      const res = await fetch(`/api/attendance?company_id=${cid}&resource=range&from_date=${from}&to_date=${to}`)
      const data = await res.json()
      if (data.success) setMonthRecords(data.records ?? [])
    } catch {
      setError('Failed to load past attendance records')
    } finally {
      setMonthLoading(false)
    }
  }, [monthRangeKeys])

  useEffect(() => {
    if (companyId) void fetchTodayRecords(companyId)
  }, [companyId, fetchTodayRecords])

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
      await fetchTodayRecords(companyId)
      await fetchMonthRecords(companyId, pastMonthCursor)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review attendance')
    } finally {
      setActionLoading(false)
    }
  }

  // UC50/UC51 — open the Past Attendance Record modal for Internal Staff or Casual Worker,
  // defaulting to the current month.
  const openPastModal = (role: 'Internal' | 'Casual Worker') => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    setPastMonthCursor(monthStart)
    setPastModalRole(role)
    setPastCellDetail(null)
    if (companyId) void fetchMonthRecords(companyId, monthStart)
  }
  const changePastMonth = (delta: number) => {
    const next = new Date(pastMonthCursor.getFullYear(), pastMonthCursor.getMonth() + delta, 1)
    setPastMonthCursor(next)
    setPastCellDetail(null)
    if (companyId) void fetchMonthRecords(companyId, next)
  }

  return (
    <>
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
        .att-stat-card {
          transition: box-shadow 0.2s ease, transform 0.2s ease;
          animation: fadeSlideUp 0.3s ease both;
        }
        .att-stat-card:hover {
          box-shadow: 0 8px 22px rgba(15,23,42,0.09);
          transform: translateY(-2px);
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {error && (
          <div style={{ padding: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, fontSize: '0.84rem', fontWeight: 800 }}>
            {error}
          </div>
        )}

        {/* ── UC50/UC51: Today's stat blocks + live timeline ───────────────────── */}
        {(() => {
          const todaySorted = [...todayRecords].sort((a, b) => a.shift.start_time.localeCompare(b.shift.start_time))
          const expectedCount = todaySorted.length
          const clockedInCount = todaySorted.filter(row => !!row.record?.clock_in_time).length
          const presentCount = todaySorted.filter(row => !!row.record?.clock_in_time && !row.exceptions.includes('late')).length
          const lateCount = todaySorted.filter(row => row.exceptions.includes('late')).length
          const absentCount = todaySorted.filter(row => row.exceptions.includes('absent')).length
          const casualWorkerRows = todaySorted.filter(row => row.assignee_role === 'Casual Worker')
          const clockedOutCount = todaySorted.filter(row => !!row.record?.clock_out_time).length

          const presentRows = todaySorted.filter(row => !!row.record?.clock_in_time && !row.exceptions.includes('late'))
          const lateRows = todaySorted.filter(row => row.exceptions.includes('late'))
          const absentRows = todaySorted.filter(row => row.exceptions.includes('absent'))

          const filterUserIds: Record<string, Set<string>> = {
            'casual-workers': new Set(casualWorkerRows.map(row => row.assignment.user_id)),
            present: new Set(presentRows.map(row => row.assignment.user_id)),
            late: new Set(lateRows.map(row => row.assignment.user_id)),
            absent: new Set(absentRows.map(row => row.assignment.user_id)),
          }

          const statBlocks = [
            {
              key: 'clocked-in',
              label: 'Clocked In',
              value: todayLoading ? '-' : `${clockedInCount}/${expectedCount}`,
              icon: <Clock size={15} style={{ color: '#374151' }} />,
              iconBg: '#F0F4F8',
              clickable: false,
            },
            {
              key: 'casual-workers',
              label: 'Casual Workers',
              value: todayLoading ? '-' : `${casualWorkerRows.length}`,
              icon: <HardHat size={15} style={{ color: '#2563EB' }} />,
              iconBg: '#EFF6FF',
              clickable: true,
            },
            {
              key: 'present',
              label: 'Present',
              value: todayLoading ? '-' : `${presentCount}`,
              icon: <Check size={15} style={{ color: '#047857' }} />,
              iconBg: '#ECFDF5',
              clickable: true,
            },
            {
              key: 'late',
              label: 'Late',
              value: todayLoading ? '-' : `${lateCount}`,
              icon: <AlertTriangle size={15} style={{ color: '#C2410C' }} />,
              iconBg: '#FFF7ED',
              clickable: true,
            },
            {
              key: 'absent',
              label: 'Absent',
              value: todayLoading ? '-' : `${absentCount}`,
              icon: <UserX size={15} style={{ color: '#B91C1C' }} />,
              iconBg: '#FEF2F2',
              clickable: true,
            },
            {
              key: 'clocked-out',
              label: 'Clocked Out',
              value: todayLoading ? '-' : `${clockedOutCount}`,
              icon: <LogOut size={15} style={{ color: '#6D28D9' }} />,
              iconBg: '#F5F3FF',
              clickable: false,
            },
          ]

          const highlightUserIds = activeStatFilter ? (filterUserIds[activeStatFilter] ?? null) : null

          return (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Top: six stat blocks side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 16 }}>
                {statBlocks.map(stat => {
                  const active = stat.clickable && activeStatFilter === stat.key
                  return (
                    <div
                      key={stat.key}
                      className="att-stat-card"
                      onClick={stat.clickable ? () => setActiveStatFilter(curr => curr === stat.key ? null : stat.key) : undefined}
                      style={{
                        background: active ? '#FFF7ED' : '#FFFFFF',
                        border: active ? '1.5px solid #FDBA74' : '1px solid #E5E7EB',
                        borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8,
                        cursor: stat.clickable ? 'pointer' : 'default',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 8, background: stat.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {stat.icon}
                        </div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>{stat.label}</span>
                      </div>
                      <strong style={{ fontSize: '1.6rem', color: '#111827', lineHeight: 1 }}>{stat.value}</strong>
                    </div>
                  )
                })}
              </div>

              {/* Bottom: today's live timeline — the exact shared Dashboard Schedule component */}
              <ScheduleTimeline
                companyId={companyId}
                dateFrom={todayKey}
                dateTo={todayKey}
                title="Today's Attendance"
                refreshKey={attendanceTimelineRefreshKey}
                highlightUserIds={highlightUserIds}
                headerExtra={
                  <button
                    onClick={() => { fetchTodayRecords(companyId); setAttendanceTimelineRefreshKey(k => k + 1) }}
                    disabled={loading || !companyId}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', color: '#0F172A', padding: '0 12px', fontWeight: 700, fontSize: 12.5, cursor: loading || !companyId ? 'default' : 'pointer', opacity: loading || !companyId ? 0.55 : 1, flexShrink: 0, marginLeft: 8 }}
                  >
                    {loading ? <Spinner size={13} dark /> : <RefreshCw size={13} />} Refresh
                  </button>
                }
              />
            </section>
          )
        })()}

        {/* ── UC50: Past Attendance Record — Internal Staff / Casual Worker option cards ── */}
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <button
            onClick={() => openPastModal('Internal')}
            className="att-card"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserCog size={19} style={{ color: '#374151' }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>Internal Staff</p>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#9CA3AF' }}>Manager &amp; Employee past attendance record</p>
            </div>
          </button>
          <button
            onClick={() => openPastModal('Casual Worker')}
            className="att-card"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <HardHat size={19} style={{ color: '#2563EB' }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>Casual Worker</p>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#9CA3AF' }}>Casual Worker past attendance record</p>
            </div>
          </button>
        </section>

      </div>

      {/* ── UC50: Past Attendance Record modal — full-month calendar, people as rows ── */}
      {pastModalRole && (() => {
        const roleRecords = monthRecords.filter(row =>
          pastModalRole === 'Internal' ? (row.assignee_role === 'Manager' || row.assignee_role === 'Employee') : row.assignee_role === 'Casual Worker'
        )
        const peopleMap = new Map<string, string>()
        roleRecords.forEach(row => { peopleMap.set(row.assignment.user_id, row.assignee_name) })
        const people = [...peopleMap.entries()].sort((a, b) => a[1].localeCompare(b[1]))

        const daysInMonth = new Date(pastMonthCursor.getFullYear(), pastMonthCursor.getMonth() + 1, 0).getDate()
        const dayDates = Array.from({ length: daysInMonth }, (_, i) => {
          const d = new Date(pastMonthCursor.getFullYear(), pastMonthCursor.getMonth(), i + 1)
          return d.toISOString().slice(0, 10)
        })

        // cellStatus[userId][date] -> 'present' | 'late' | 'absent' | null (no shift that day)
        const cellStatus = new Map<string, Map<string, { status: 'present' | 'late' | 'absent'; row: AttendanceDashboardRecord }>>()
        roleRecords.forEach(row => {
          const userId = row.assignment.user_id
          if (!cellStatus.has(userId)) cellStatus.set(userId, new Map())
          const status: 'present' | 'late' | 'absent' = row.exceptions.includes('absent')
            ? 'absent'
            : row.exceptions.includes('late')
              ? 'late'
              : row.record?.clock_in_time
                ? 'present'
                : 'absent'
          cellStatus.get(userId)!.set(row.shift.shift_date, { status, row })
        })

        const monthLabel = pastMonthCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        const detailEntry = pastCellDetail ? cellStatus.get(pastCellDetail.userId)?.get(pastCellDetail.date) : null

        return (
          <ModalOverlay onClose={() => setPastModalRole(null)} maxWidth="1100px">
            <ModalBox>
              <ModalHeader
                title={`${pastModalRole === 'Internal' ? 'Internal Staff' : 'Casual Worker'} — Past Attendance Record`}
                icon={<Calendar size={15} color="#fff" strokeWidth={2.5} />}
                onClose={() => setPastModalRole(null)}
              />

              <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => changePastMonth(-1)} style={{ width: 30, height: 30, border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}>
                    <ChevronLeft size={15} />
                  </button>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#111827', minWidth: 140, textAlign: 'center' }}>{monthLabel}</span>
                  <button onClick={() => changePastMonth(1)} style={{ width: 30, height: 30, border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}>
                    <ChevronRight size={15} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.72rem', color: '#6B7280', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Check size={12} color="#059669" strokeWidth={3} /> Present</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#9CA3AF', color: '#fff', fontSize: 8, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>L</span> Late</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><X size={12} color="#DC2626" strokeWidth={3} /> Absent</span>
                </div>
              </div>

              <div style={{ padding: '14px 20px 20px', overflowX: 'auto' }}>
                {monthLoading ? (
                  <div style={{ padding: '32px 0', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                    <Spinner size={15} dark /> Loading...
                  </div>
                ) : people.length === 0 ? (
                  <div style={{ padding: '32px 0', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>
                    No {pastModalRole === 'Internal' ? 'Manager or Employee' : 'Casual Worker'} attendance records this month.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${daysInMonth}, 30px)`, minWidth: 140 + daysInMonth * 30 }}>
                    {/* Header row */}
                    <div style={{ position: 'sticky', left: 0, background: '#FFFFFF', borderBottom: '2px solid #F0F4F8', zIndex: 2 }} />
                    {dayDates.map(date => {
                      const dayNum = Number(date.slice(8, 10))
                      const isToday = date === todayKey
                      return (
                        <div key={date} style={{ textAlign: 'center', padding: '4px 0', fontSize: '0.68rem', fontWeight: 700, color: isToday ? '#F97316' : '#9CA3AF', borderBottom: '2px solid #F0F4F8' }}>
                          {dayNum}
                        </div>
                      )
                    })}
                    {/* One row per person */}
                    {people.map(([userId, name]) => (
                      <>
                        <div key={`${userId}-name`} style={{ position: 'sticky', left: 0, background: '#FFFFFF', padding: '6px 10px 6px 0', fontSize: '0.8125rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center' }}>
                          {name}
                        </div>
                        {dayDates.map(date => {
                          const entry = cellStatus.get(userId)?.get(date)
                          return (
                            <div key={`${userId}-${date}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #F8FAFC', padding: '4px 0' }}>
                              {entry ? (
                                <button
                                  onClick={() => setPastCellDetail({ userId, date })}
                                  title={`${name} — ${date}`}
                                  style={{
                                    width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: entry.status === 'present' ? '#ECFDF5' : entry.status === 'late' ? '#F1F5F9' : '#FEF2F2',
                                  }}
                                >
                                  {entry.status === 'present' && <Check size={12} color="#059669" strokeWidth={3} />}
                                  {entry.status === 'late' && <span style={{ fontSize: 10, fontWeight: 900, color: '#6B7280' }}>L</span>}
                                  {entry.status === 'absent' && <X size={12} color="#DC2626" strokeWidth={3} />}
                                </button>
                              ) : (
                                <span style={{ width: 22, height: 22 }} />
                              )}
                            </div>
                          )
                        })}
                      </>
                    ))}
                  </div>
                )}
              </div>

              {/* Detail panel for the clicked cell — Approve/Reject entry point */}
              {detailEntry && (
                <div style={{ padding: '0 20px 20px' }}>
                  <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>
                        {detailEntry.row.assignee_name} — {detailEntry.row.shift.shift_date}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#6B7280' }}>
                        {detailEntry.row.department_name ?? 'No department'} | {detailEntry.row.assignee_role} | Scheduled {formatTime(detailEntry.row.shift.start_time)} - {formatTime(detailEntry.row.shift.end_time)}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#374151', fontWeight: 600 }}>
                        Clocked: {formatTime(detailEntry.row.record?.clock_in_time)} - {formatTime(detailEntry.row.record?.clock_out_time)}
                      </p>
                    </div>
                    {detailEntry.row.record && (
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => openReview(detailEntry.row, 'approved')} style={{ border: 'none', borderRadius: 8, background: '#059669', color: '#FFFFFF', padding: '8px 14px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Approve</button>
                        <button onClick={() => openReview(detailEntry.row, 'rejected')} style={{ border: 'none', borderRadius: 8, background: '#DC2626', color: '#FFFFFF', padding: '8px 14px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Reject</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </ModalBox>
          </ModalOverlay>
        )
      })()}

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
    </>
  )
}
