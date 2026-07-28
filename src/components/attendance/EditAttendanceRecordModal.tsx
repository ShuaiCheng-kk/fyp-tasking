'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, UserRound, X } from 'lucide-react'
import Spinner from '@/components/Spinner'
import { ModalOverlay, ModalBox, ModalHeader, modalErrorBoxStyle, modalPrimaryButtonStyle, modalLabelStyle } from '@/components/modal'
import { AttendanceDashboardRecord, AttendanceModifiedTimeField, AttendanceRecord } from '@/types/Attendance'
import { getARStatus } from '@/components/attendance/ARStatus'

// UC56 — click-to-edit-clock-time modal for a single attendance record. Shared by AttendanceView's
// Attendance Records block (Owner/Partner/Employee) and ShiftsView's Manager-only merged Shift
// Calendar (past/today cells), so this stays the single source of truth for the edit/lock rules.

const DATE_DISPLAY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function formatDateDisplay(value: string | null | undefined, empty = '—'): string {
  if (!value) return empty
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return empty
  return `${String(date.getDate()).padStart(2, '0')} ${DATE_DISPLAY_MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

function formatModifiedDateOnly(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' })
  const dayMonth = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${weekday}, ${dayMonth}`
}

function formatShiftHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

function fmtClockStamp(iso: string | null): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Singapore' })
}

const TIME_OPTIONS: string[] = (() => {
  const opts: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      const ampm = h < 12 ? 'AM' : 'PM'
      const displayH = h % 12 === 0 ? 12 : h % 12
      opts.push(`${displayH}:${String(m).padStart(2, '0')} ${ampm}`)
    }
  }
  return opts
})()

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8,
  fontSize: '0.9375rem', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
  appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
}

function isoToAmPm(iso: string | null | undefined): string {
  if (!iso) return ''
  // Times are stored as UTC. Round to nearest 5-min slot so the value matches a dropdown option.
  const d = new Date(iso)
  const utcH = d.getUTCHours()
  const utcM = Math.round(d.getUTCMinutes() / 5) * 5
  const h = utcH + (utcM >= 60 ? 1 : 0)
  const m = utcM >= 60 ? 0 : utcM
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12raw = h % 24
  const h12 = h12raw % 12 === 0 ? 12 : h12raw % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function amPmToHHMM(ampm: string): string {
  const m = ampm.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return ampm
  let h = parseInt(m[1], 10)
  const min = m[2]
  const meridiem = m[3].toUpperCase()
  if (meridiem === 'AM' && h === 12) h = 0
  if (meridiem === 'PM' && h !== 12) h += 12
  return `${String(h).padStart(2, '0')}:${min}`
}

const OWNER_MODIFIED_FIELD_LABELS: Record<string, string> = {
  clock_in_time: 'Clock In',
  clock_out_time: 'Clock Out',
  break_in_time: 'Break In',
  break_out_time: 'Break Out',
}
function formatModifiedFieldsLabel(fields: string[] | null | undefined): string {
  if (!fields || fields.length === 0) return 'time'
  return fields.map(f => OWNER_MODIFIED_FIELD_LABELS[f] ?? f).join(', ')
}

// Which fields differ from their true original (the raw clock_in_time/clock_out_time/
// break_in_time/break_out_time columns, which are never overwritten) at minute precision —
// derived live instead of read from a stored flag, since the modified_* columns get rewritten
// on every save regardless of which field was actually touched.
function getStoredModifiedFields(record: AttendanceRecord | null | undefined): AttendanceModifiedTimeField[] {
  if (!record) return []
  const truncate = (iso: string | null) => iso?.slice(0, 16) ?? null
  const pairs: [AttendanceModifiedTimeField, string | null, string | null][] = [
    ['clock_in_time', record.clock_in_time, record.modified_clock_in_time],
    ['clock_out_time', record.clock_out_time, record.modified_clock_out_time],
    ['break_in_time', record.break_in_time, record.modified_break_in_time],
    ['break_out_time', record.break_out_time, record.modified_break_out_time],
  ]
  return pairs
    .filter(([, raw, adjusted]) => adjusted !== null && truncate(raw) !== truncate(adjusted))
    .map(([field]) => field)
}

export default function EditAttendanceRecordModal({
  record, onClose, onSaved, companyId, internalUserId, basePath, canModifyClockTimes, scopeToManagerDepartments, showSuccessToast, showErrorToast,
}: {
  record: AttendanceDashboardRecord | null
  onClose: () => void
  onSaved: () => void
  companyId: string
  internalUserId: string
  basePath: string
  canModifyClockTimes: boolean
  scopeToManagerDepartments: boolean
  showSuccessToast: (message: string) => void
  showErrorToast: (message: string) => void
}) {
  const router = useRouter()
  const [reviewClockIn, setReviewClockIn] = useState('')
  const [reviewClockOut, setReviewClockOut] = useState('')
  const [reviewBreakIn, setReviewBreakIn] = useState('')
  const [reviewBreakOut, setReviewBreakOut] = useState('')
  const [reviewInitialTimes, setReviewInitialTimes] = useState({ clockIn: '', clockOut: '', breakIn: '', breakOut: '' })
  const [reviewReason, setReviewReason] = useState('')
  const [reviewActionLoading, setReviewActionLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [cwWorkerStatus, setCwWorkerStatus] = useState<string | null>(null)
  const [cwStatusLoading, setCwStatusLoading] = useState(false)

  // Equivalent of the old openReview(row) — re-seeds the editable fields every time a new record
  // is opened for review.
  useEffect(() => {
    if (!record) return
    const initialClockIn = isoToAmPm(record.record?.modified_clock_in_time ?? record.record?.clock_in_time)
    const initialClockOut = isoToAmPm(record.record?.modified_clock_out_time ?? record.record?.clock_out_time)
    const initialBreakIn = isoToAmPm(record.record?.modified_break_in_time ?? record.record?.break_in_time)
    const initialBreakOut = isoToAmPm(record.record?.modified_break_out_time ?? record.record?.break_out_time)
    setReviewClockIn(initialClockIn)
    setReviewClockOut(initialClockOut)
    setReviewBreakIn(initialBreakIn)
    setReviewBreakOut(initialBreakOut)
    setReviewInitialTimes({ clockIn: initialClockIn, clockOut: initialClockOut, breakIn: initialBreakIn, breakOut: initialBreakOut })
    setReviewReason('')
    setCwWorkerStatus(record.assignee_worker_status ?? 'active')
    setReviewError('')
  }, [record])

  if (!record) return null

  const toggleCwStatus = async () => {
    if (!record || record.assignee_role !== 'Casual Worker') return
    const newStatus = cwWorkerStatus === 'active' ? 'inactive' : 'active'
    setCwStatusLoading(true)
    try {
      const res = await fetch('/api/team/casual-worker-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: record.assignment.user_id, company_id: companyId, worker_status: newStatus }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update status')
      setCwWorkerStatus(newStatus)
      showSuccessToast(newStatus === 'active' ? 'Casual worker reactivated.' : 'Casual worker deactivated.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update status'
      setReviewError(message)
      showErrorToast(message)
    } finally { setCwStatusLoading(false) }
  }

  const submitReview = async () => {
    if (!record?.record || !internalUserId || !companyId) return
    setReviewError('')
    const shiftDate = record.shift.shift_date
    const toISO = (ampm: string) => ampm ? new Date(`${shiftDate}T${amPmToHHMM(ampm)}:00Z`).toISOString() : null
    const clockInIso = toISO(reviewClockIn)
    const clockOutIso = toISO(reviewClockOut)
    const breakInIso = toISO(reviewBreakIn)
    const breakOutIso = toISO(reviewBreakOut)

    if (clockInIso && clockOutIso && new Date(clockInIso).getTime() > new Date(clockOutIso).getTime()) {
      setReviewError('Clock In cannot be later than Clock Out'); return
    }
    if (breakInIso && breakOutIso && new Date(breakInIso).getTime() > new Date(breakOutIso).getTime()) {
      setReviewError('Break In cannot be later than Break Out'); return
    }
    if (breakInIso && clockInIso && clockOutIso && (new Date(breakInIso).getTime() < new Date(clockInIso).getTime() || new Date(breakInIso).getTime() > new Date(clockOutIso).getTime())) {
      setReviewError('Break In must be between Clock In and Clock Out'); return
    }
    if (breakOutIso && clockInIso && clockOutIso && (new Date(breakOutIso).getTime() < new Date(clockInIso).getTime() || new Date(breakOutIso).getTime() > new Date(clockOutIso).getTime())) {
      setReviewError('Break Out must be between Clock In and Clock Out'); return
    }

    setReviewActionLoading(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'modify_times',
          id: record.record.id,
          actor_id: internalUserId,
          reason: reviewReason.trim(),
          clock_in_time: clockInIso,
          clock_out_time: clockOutIso,
          break_in_time: breakInIso,
          break_out_time: breakOutIso,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update attendance')
      onSaved()
      onClose()
      showSuccessToast('Attendance record updated.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update attendance'
      setReviewError(message)
      showErrorToast(message)
    } finally { setReviewActionLoading(false) }
  }

  // Which fields the record currently on file already differs on, before any new edits below.
  const storedModifiedFields = getStoredModifiedFields(record.record)
  const showModifiedInfo = storedModifiedFields.length > 0
  const modifiedFieldsSet = new Set(storedModifiedFields)

  // UC56 (rank confirmed 2026-07-23): Owner/Partner outrank Manager — once either of them
  // modifies a record, a Manager loses edit rights on it entirely.
  const lockedByOwnerOrPartner = scopeToManagerDepartments
    && showModifiedInfo
    && (record.modifier_role === 'Owner' || record.modifier_role === 'Partner')
  // UC56 (expanded 2026-07-23): a Manager's edit right stops at their own department's
  // Employee/Casual Worker records — a peer Manager's record is view-only.
  const canEditReviewRecord = canModifyClockTimes && !lockedByOwnerOrPartner && (!scopeToManagerDepartments || record.assignee_role !== 'Manager')
  const hasTimeChanges = reviewClockIn !== reviewInitialTimes.clockIn
    || reviewClockOut !== reviewInitialTimes.clockOut
    || reviewBreakIn !== reviewInitialTimes.breakIn
    || reviewBreakOut !== reviewInitialTimes.breakOut
  const shiftDateForCompare = record.shift.shift_date
  const toISOForCompare = (ampm: string): string | null => ampm ? new Date(`${shiftDateForCompare}T${amPmToHHMM(ampm)}:00Z`).toISOString() : null
  const truncateToMinute = (iso: string | null) => iso?.slice(0, 16) ?? null
  // The true original for every field is always its own raw column — clock_in_time/
  // clock_out_time/break_in_time/break_out_time are never overwritten; only the modified_*
  // counterpart changes when a reviewer corrects a time.
  const resolveTrueOriginalClient = (field: AttendanceModifiedTimeField): string | null => record.record?.[field] ?? null
  const currentPickerValues: Record<AttendanceModifiedTimeField, string | null> = {
    clock_in_time: toISOForCompare(reviewClockIn),
    clock_out_time: toISOForCompare(reviewClockOut),
    break_in_time: toISOForCompare(reviewBreakIn),
    break_out_time: toISOForCompare(reviewBreakOut),
  }
  const willBeModified = (['clock_in_time', 'clock_out_time', 'break_in_time', 'break_out_time'] as const)
    .some(field => truncateToMinute(resolveTrueOriginalClient(field)) !== truncateToMinute(currentPickerValues[field]))
  const fieldLabelWithBadge = (text: string, fieldKey: AttendanceModifiedTimeField) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {text}
      {showModifiedInfo && modifiedFieldsSet.has(fieldKey) && (
        <span title="Modified" style={{ width: 14, height: 14, borderRadius: '50%', background: '#F97316', color: '#fff', fontSize: 8, fontWeight: 800, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>M</span>
      )}
    </span>
  )
  const originalValueNote = (fieldKey: AttendanceModifiedTimeField) => {
    if (!showModifiedInfo || !modifiedFieldsSet.has(fieldKey)) return null
    const original = record.record?.[fieldKey] ?? null
    return (
      <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 700, color: '#EA580C' }}>
        Original: {original ? fmtClockStamp(original) : '—'}
      </p>
    )
  }
  const showReadOnlyReason = showModifiedInfo && !hasTimeChanges
  const showEditableReason = hasTimeChanges && willBeModified

  return (
    <ModalOverlay onClose={onClose} maxWidth="420px">
      <ModalBox>
        <ModalHeader title="Attendance Record" icon={<Check size={15} color="#fff" strokeWidth={2.5} />} onClose={onClose} />

        <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 999, background: record.assignee_role === 'Manager' ? '#FFF7ED' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {record.assignee_profile_photo_url
              ? <img src={record.assignee_profile_photo_url} alt={record.assignee_name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 999 }} />
              : <UserRound size={20} color={record.assignee_role === 'Manager' ? '#EA580C' : '#4B5563'} />}
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', margin: '0 0 5px' }}>{record.assignee_name}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 700, background: record.assignee_role === 'Manager' ? '#FFF7ED' : '#F3F4F6', color: record.assignee_role === 'Manager' ? '#EA580C' : '#4B5563' }}>
                {record.assignee_role}
              </span>
              {(() => {
                const status = getARStatus(record)
                if (status === 'late') return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 700, background: '#FEF9C3', color: '#A16207' }}>Late</span>
                if (status === 'present') return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 700, background: '#DCFCE7', color: '#15803D' }}>Present</span>
                if (status === 'absent') return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 700, background: '#FEF2F2', color: '#B91C1C' }}>Absent</span>
                return null
              })()}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column' }}>
          {([
            ...(record.assignee_role === 'Casual Worker'
              ? [
                  { label: 'Job Type', value: record.shift.is_open_ended ? 'One-off Job' : 'Shift Job' },
                  {
                    label: 'Job Title',
                    value: record.job_title ?? '—',
                    onClick: record.shift.source_job_posting_id
                      ? () => router.push(`${basePath}/recruitment?job=${record.shift.source_job_posting_id}`)
                      : undefined,
                  },
                ]
              : [
                  { label: 'Department', value: record.department_name ?? '—' },
                ]
            ),
            { label: 'Date', value: formatDateDisplay(record.shift.shift_date) },
            ...(record.shift.is_open_ended
              ? [{ label: 'Start Time', value: formatShiftHour(record.shift.start_time) }]
              : [{ label: 'Shift Time', value: `${formatShiftHour(record.shift.start_time)} – ${formatShiftHour(record.shift.end_time)}` }]
            ),
            ...(showModifiedInfo
              ? [{ label: 'Modified By', value: `${record.modifier_name ?? 'Unknown'} on ${formatModifiedDateOnly(record.record?.modified_at)}` }]
              : []
            ),
          ] as { label: string; value: string; onClick?: () => void }[]).map(field => (
            <div key={field.label} style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
              <label style={{ ...modalLabelStyle, marginBottom: 4 }}>{field.label}</label>
              {field.onClick ? (
                <button
                  type="button"
                  onClick={field.onClick}
                  title="View this job on the Recruitment page"
                  style={{ fontSize: '0.9375rem', color: '#F97316', margin: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
                >
                  {field.value}
                </button>
              ) : (
                <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>{field.value}</p>
              )}
            </div>
          ))}

          {canEditReviewRecord && record.record && (
            <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ ...modalLabelStyle, marginBottom: 6 }}>{fieldLabelWithBadge('Clock In', 'clock_in_time')}</label>
                <div style={{ position: 'relative' }}>
                  <select value={reviewClockIn} onChange={e => setReviewClockIn(e.target.value)} style={selectStyle}>
                    <option value="">-- select --</option>
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7280', fontSize: 12 }}>▾</span>
                </div>
                {originalValueNote('clock_in_time')}
              </div>
              <div>
                <label style={{ ...modalLabelStyle, marginBottom: 6 }}>{fieldLabelWithBadge('Clock Out', 'clock_out_time')}</label>
                <div style={{ position: 'relative' }}>
                  <select value={reviewClockOut} onChange={e => setReviewClockOut(e.target.value)} style={selectStyle}>
                    <option value="">-- select --</option>
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7280', fontSize: 12 }}>▾</span>
                </div>
                {originalValueNote('clock_out_time')}
              </div>
            </div>
          )}

          {!canEditReviewRecord && record.record && (
            <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ ...modalLabelStyle, marginBottom: 4 }}>{fieldLabelWithBadge('Clock In', 'clock_in_time')}</label>
                <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>{fmtClockStamp(record.record.modified_clock_in_time ?? record.record.clock_in_time)}</p>
                {originalValueNote('clock_in_time')}
              </div>
              <div>
                <label style={{ ...modalLabelStyle, marginBottom: 4 }}>{fieldLabelWithBadge('Clock Out', 'clock_out_time')}</label>
                <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>{fmtClockStamp(record.record.modified_clock_out_time ?? record.record.clock_out_time)}</p>
                {originalValueNote('clock_out_time')}
              </div>
            </div>
          )}

          {canEditReviewRecord && record.record && (
            <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ ...modalLabelStyle, marginBottom: 6 }}>{fieldLabelWithBadge('Break In', 'break_in_time')}</label>
                <div style={{ position: 'relative' }}>
                  <select value={reviewBreakIn} onChange={e => setReviewBreakIn(e.target.value)} style={selectStyle}>
                    <option value="">-- select --</option>
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7280', fontSize: 12 }}>▾</span>
                </div>
                {originalValueNote('break_in_time')}
              </div>
              <div>
                <label style={{ ...modalLabelStyle, marginBottom: 6 }}>{fieldLabelWithBadge('Break Out', 'break_out_time')}</label>
                <div style={{ position: 'relative' }}>
                  <select value={reviewBreakOut} onChange={e => setReviewBreakOut(e.target.value)} style={selectStyle}>
                    <option value="">-- select --</option>
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7280', fontSize: 12 }}>▾</span>
                </div>
                {originalValueNote('break_out_time')}
              </div>
            </div>
          )}

          {!canEditReviewRecord && record.record && record.record.break_in_time && (
            <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ ...modalLabelStyle, marginBottom: 4 }}>{fieldLabelWithBadge('Break In', 'break_in_time')}</label>
                <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>{fmtClockStamp(record.record.modified_break_in_time ?? record.record.break_in_time)}</p>
                {originalValueNote('break_in_time')}
              </div>
              <div>
                <label style={{ ...modalLabelStyle, marginBottom: 4 }}>{fieldLabelWithBadge('Break Out', 'break_out_time')}</label>
                <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>{fmtClockStamp(record.record.modified_break_out_time ?? record.record.break_out_time)}</p>
                {originalValueNote('break_out_time')}
              </div>
            </div>
          )}

          {record.record && showReadOnlyReason && (
            <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
              <label style={{ ...modalLabelStyle, marginBottom: 4 }}>Reason</label>
              <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", whiteSpace: 'pre-wrap' }}>
                {record.record.modified_reason || '—'}
              </p>
            </div>
          )}

          {canEditReviewRecord && record.record && showEditableReason && (
            <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
              <label style={{ ...modalLabelStyle, marginBottom: 6 }}>Reason</label>
              <textarea
                value={reviewReason}
                onChange={e => setReviewReason(e.target.value)}
                placeholder="Why is this time being changed?"
                rows={2}
                style={{ ...selectStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          )}
        </div>

        {reviewError && <div style={modalErrorBoxStyle}>{reviewError}</div>}

        <div style={{ padding: '16px 24px 20px', display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          {record.assignee_role === 'Casual Worker' && (
            <button
              onClick={toggleCwStatus}
              disabled={cwStatusLoading}
              style={{
                padding: '7px 18px', border: 'none', borderRadius: 8,
                background: cwWorkerStatus === 'active' ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #10B981, #059669)',
                color: '#FFFFFF', fontSize: '0.8125rem', fontWeight: 600,
                cursor: cwStatusLoading ? 'default' : 'pointer', opacity: cwStatusLoading ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', flexShrink: 0,
              }}
            >
              {cwWorkerStatus === 'active'
                ? <><X size={13} strokeWidth={2.5} /> Inactive</>
                : <><Check size={13} strokeWidth={2.5} /> Active</>}
            </button>
          )}
          {canEditReviewRecord && record.record && (
            <div style={{ marginLeft: 'auto' }}>
              <button onClick={submitReview} disabled={reviewActionLoading || !hasTimeChanges} style={modalPrimaryButtonStyle(reviewActionLoading || !hasTimeChanges)}>
                {reviewActionLoading ? <Spinner size={13} /> : <Check size={13} />} Save
              </button>
            </div>
          )}
        </div>
      </ModalBox>
    </ModalOverlay>
  )
}
