'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Clock, UserRound, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import EmployeeSidebar from '@/components/EmployeeSidebar'

const GREEN      = '#16A34A'
const DARK_GREEN = '#14532D'

type AttendanceRecord = {
  id: string
  shift_id: string
  shift_title: string
  shift_date: string
  start_time: string
  end_time: string
  clock_in_time: string | null
  clock_out_time: string | null
  status: string
  employee_notes: string | null
  manager_notes: string | null
  department_name: string | null
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  if (value.includes('T')) return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return value.slice(0, 5)
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function statusBadge(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case 'approved': return { bg: '#ECFDF5', text: '#047857', label: 'Approved' }
    case 'rejected': return { bg: '#FEF2F2', text: '#B91C1C', label: 'Rejected' }
    case 'pending':  return { bg: '#FFFBEB', text: '#B45309', label: 'Pending' }
    case 'absent':   return { bg: '#FEF2F2', text: '#B91C1C', label: 'Absent' }
    default:         return { bg: '#F3F4F6', text: '#4B5563', label: status }
  }
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'approved') return <CheckCircle2 size={14} color="#047857" />
  if (status === 'rejected' || status === 'absent') return <XCircle size={14} color="#B91C1C" />
  return <AlertCircle size={14} color="#B45309" />
}

function Spinner({ dark = false }: { dark?: boolean }) {
  return (
    <svg className="animate-spin" width="15" height="15" viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export default function EmployeeAttendancePage() {
  const router = useRouter()
  const [userName,       setUserName]       = useState('')
  const [companyName,    setCompanyName]    = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [userId,         setUserId]         = useState('')
  const [records,        setRecords]        = useState<AttendanceRecord[]>([])
  const [loading,        setLoading]        = useState(true)
  const [refreshing,     setRefreshing]     = useState(false)

  // ── summary stats ──────────────────────────────────────────────────────────
  const totalShifts  = records.length
  const approved     = records.filter(r => r.status === 'approved').length
  const pending      = records.filter(r => r.status === 'pending').length
  const rejected     = records.filter(r => r.status === 'rejected' || r.status === 'absent').length

  const fetchRecords = useCallback(async (uid: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res  = await fetch(`/api/employee/attendance?user_id=${uid}`)
      const data = await res.json()
      if (data.success) setRecords(data.records ?? [])
    } catch {}
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const uid = localStorage.getItem('tasking_user_id')
      if (!uid) { router.replace('/signin'); return }

      const meRes  = await fetch(`/api/user/me?user_id=${uid}`)
      const meData = await meRes.json()
      if (cancelled) return

      if (!meData.success) { router.replace('/signin'); return }
      setUserName(meData.user.full_name ?? '')
      setUserId(meData.user.id ?? uid)

      const dashRes  = await fetch(`/api/employee/dashboard?user_id=${uid}`)
      const dashData = await dashRes.json()
      if (!cancelled && dashData.success) {
        setCompanyName(dashData.company_name ?? '')
        setDepartmentName(dashData.department_name ?? '')
      }

      if (!cancelled) fetchRecords(uid)
    }

    void run()
    return () => { cancelled = true }
  }, [router, fetchRecords])

  const subtitle = companyName && departmentName
    ? `${companyName} [${departmentName}]`
    : companyName

  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F7F8FA', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <style>{`.ep-att-row:hover td { background: #F0FDF4 !important; }`}</style>
      <EmployeeSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ── Page header — matches Owner pattern ───────────────────────────── */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Attendance
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {userName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#14532D', color: '#FFFFFF', flexShrink: 0 }}>
                  <UserRound size={13} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{userName}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Date + Refresh row ─────────────────────────────────────────────── */}
        <div style={{ padding: '14px 28px 0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#F0F4F8', borderRadius: 8, padding: '6px 12px' }}>
            <CalendarDays size={13} style={{ color: '#6B7280' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#374151' }}>{todayLabel}</span>
          </div>
          <button
            onClick={() => { const uid = localStorage.getItem('tasking_user_id'); if (uid) fetchRecords(uid, true) }}
            disabled={refreshing || loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1.5px solid #E5E7EB', borderRadius: 8, background: '#fff', color: '#374151', padding: '6px 13px', fontWeight: 600, fontSize: '0.8125rem', cursor: refreshing || loading ? 'default' : 'pointer', opacity: refreshing || loading ? 0.6 : 1 }}
          >
            {refreshing ? <Spinner dark /> : <RefreshCw size={13} />} Refresh
          </button>
        </div>

        <div style={{ padding: '16px 28px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* ── Stats strip ──────────────────────────────────────────────────── */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Total Shifts',  value: totalShifts, color: '#111827' },
              { label: 'Approved',      value: approved,    color: '#047857' },
              { label: 'Pending',       value: pending,     color: '#B45309' },
              { label: 'Rejected',      value: rejected,    color: '#B91C1C' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
                <p style={{ margin: 0, color: '#6B7280', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                <strong style={{ display: 'block', marginTop: 6, fontSize: '1.5rem', color: loading ? '#D1D5DB' : color }}>{loading ? '—' : value}</strong>
              </div>
            ))}
          </section>

          {/* ── Attendance records table ─────────────────────────────────────── */}
          <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={15} style={{ color: GREEN }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>My Shift Attendance</span>
                <span style={{ marginLeft: 8, fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', background: '#F3F4F6', padding: '2px 8px', borderRadius: 99 }}>
                  Clock-in / Clock-out history
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280' }}>
                {records.length} record{records.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div style={{ padding: '28px 18px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                <Spinner dark /> Loading attendance records…
              </div>
            ) : records.length === 0 ? (
              <div style={{ padding: '32px 18px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>
                <Clock size={28} style={{ color: '#D1FAE5', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                No attendance records found.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Date', 'Shift', 'Department', 'Scheduled', 'Clock In', 'Clock Out', 'Status', 'Notes'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #F0F4F8', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((row, i) => {
                      const badge = statusBadge(row.status)
                      return (
                        <tr key={row.id} className="ep-att-row" style={{ borderBottom: i < records.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                          <td style={{ padding: '12px 14px', color: '#374151', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {formatDate(row.shift_date)}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#111827', fontWeight: 500 }}>
                            {row.shift_title || 'Shift'}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#6B7280' }}>
                            {row.department_name ?? '—'}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#374151', whiteSpace: 'nowrap' }}>
                            {formatTime(row.start_time)} – {formatTime(row.end_time)}
                          </td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            {row.clock_in_time
                              ? <span style={{ color: '#047857', fontWeight: 600 }}>{formatTime(row.clock_in_time)}</span>
                              : <span style={{ color: '#9CA3AF' }}>—</span>
                            }
                          </td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            {row.clock_out_time
                              ? <span style={{ color: '#047857', fontWeight: 600 }}>{formatTime(row.clock_out_time)}</span>
                              : <span style={{ color: '#9CA3AF' }}>—</span>
                            }
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: badge.bg, color: badge.text, padding: '3px 9px', borderRadius: 99, fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                              <StatusIcon status={row.status} />
                              {badge.label}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#6B7280', fontSize: '0.8rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.employee_notes || row.manager_notes || '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  )
}
