'use client'

// Casual Worker detail popup — same design (fonts, spacing, stacked label/value field rows with
// dividers, 2-column Clock In/Clock Out grid) as EditAttendanceRecordModal's read-only view, the
// one an Employee sees clicking their own record on the Shifts page (2026-08-02). This one stays
// its own lightweight component rather than reusing that shared modal directly — it has no
// editing rights and a different data shape (SupervisedWorker, not AttendanceDashboardRecord) —
// but must look identical.
//
// A one-off job has no Break In/Out (see CasualTaskBoard's own "no break concept" rule) and its
// Clock Out is supervisor-released rather than self-serve, so this shows an Approve Clock Out
// button instead of a clock-out time until that happens.

import { Users } from 'lucide-react'
import { ModalOverlay, ModalBox, ModalHeader, modalLabelStyle } from '@/components/modal'
import { fmtClockStamp } from '@/components/dashboard/ClockFlow'
import { ClockOutReleaseItem, SupervisedWorker } from './useSupervisedCasualWorkers'

const ACCENT = '#F97316'
const FIELD_FONT = "'Inter', system-ui, -apple-system, sans-serif"
const fieldRowStyle: React.CSSProperties = { padding: '14px 0', borderBottom: '1px solid #F3F4F6' }
const fieldValueStyle: React.CSSProperties = { fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: FIELD_FONT }

function formatShiftHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={fieldRowStyle}>
      <label style={{ ...modalLabelStyle, marginBottom: 4 }}>{label}</label>
      <p style={fieldValueStyle}>{value}</p>
    </div>
  )
}

export default function SupervisedWorkerDetailModal({ worker, release, releaseBusyId, onRelease, onClose }: {
  worker: SupervisedWorker
  release: ClockOutReleaseItem | undefined
  releaseBusyId: string
  onRelease: (item: ClockOutReleaseItem) => void
  onClose: () => void
}) {
  return (
    <ModalOverlay onClose={onClose} maxWidth="420px">
      <ModalBox>
        <ModalHeader title={worker.full_name} icon={<Users size={15} color="#fff" strokeWidth={2.5} />} onClose={onClose} />

        <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 999, background: worker.profile_photo_url ? 'transparent' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {worker.profile_photo_url
              ? <img src={worker.profile_photo_url} alt={worker.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Users size={20} color="#4B5563" />}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', margin: 0 }}>{worker.full_name}</p>
          </div>
        </div>

        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column' }}>
          {worker.phone_number && <Field label="Phone" value={worker.phone_number} />}
          {worker.is_open_ended
            ? <Field label="Start Time" value={formatShiftHour(worker.start_time)} />
            : <Field label="Shift Time" value={`${formatShiftHour(worker.start_time)} – ${formatShiftHour(worker.end_time)}`} />}

          {worker.is_open_ended ? (
            // One-off job — no breaks; this Employee reviews and releases the clock-out instead of
            // the worker self-serving it. Clock In/Clock Out still sit side by side like the shift
            // job case below — Clock Out just reads "—" until there's a time (or a release ready
            // to approve) to show there, instead of that whole column disappearing (2026-08-02).
            <>
              <div style={{ padding: '14px 0', borderBottom: release ? 'none' : '1px solid #F3F4F6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ ...modalLabelStyle, marginBottom: 4 }}>Clock In</label>
                  <p style={fieldValueStyle}>{worker.clock_in_time ? fmtClockStamp(worker.clock_in_time) : '—'}</p>
                </div>
                <div>
                  <label style={{ ...modalLabelStyle, marginBottom: 4 }}>Clock Out</label>
                  <p style={fieldValueStyle}>{worker.clock_out_time ? fmtClockStamp(worker.clock_out_time) : '—'}</p>
                </div>
              </div>
              {!worker.clock_out_time && release && (
                <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <button
                    type="button"
                    onClick={() => onRelease(release)}
                    disabled={!!releaseBusyId}
                    style={{ width: '100%', height: 38, borderRadius: 9, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 13, cursor: releaseBusyId ? 'default' : 'pointer' }}
                  >
                    {releaseBusyId === release.id ? '…' : 'Approve Clock Out'}
                  </button>
                </div>
              )}
            </>
          ) : (
            // Shift job — full Clock In/Break In/Break Out/Clock Out timeline, same 2-column grid
            // as the reference modal's editable/read-only time pairs.
            <>
              <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ ...modalLabelStyle, marginBottom: 4 }}>Clock In</label>
                  <p style={fieldValueStyle}>{worker.clock_in_time ? fmtClockStamp(worker.clock_in_time) : '—'}</p>
                </div>
                <div>
                  <label style={{ ...modalLabelStyle, marginBottom: 4 }}>Clock Out</label>
                  <p style={fieldValueStyle}>{worker.clock_out_time ? fmtClockStamp(worker.clock_out_time) : '—'}</p>
                </div>
              </div>
              <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ ...modalLabelStyle, marginBottom: 4 }}>Break In</label>
                  <p style={fieldValueStyle}>{worker.break_in_time ? fmtClockStamp(worker.break_in_time) : '—'}</p>
                </div>
                <div>
                  <label style={{ ...modalLabelStyle, marginBottom: 4 }}>Break Out</label>
                  <p style={fieldValueStyle}>{worker.break_out_time ? fmtClockStamp(worker.break_out_time) : '—'}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </ModalBox>
    </ModalOverlay>
  )
}
