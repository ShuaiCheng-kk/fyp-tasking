'use client'

// Shared job presentation — the JobCard and JobDetailPanel used by BOTH the public Job Board and
// the Guest User's Applications page, so an applied job renders exactly like it did on the board.
// One component system per the shared-UI principle; the only per-host differences are passed in
// (a status badge / footer on the card, an action slot replacing "Apply Now" in the detail).

import { useState } from 'react'
import { Zap, X, MapPin, Briefcase, Clock, LayoutGrid, Users, FileText, Cake, UserCheck, Shirt, DollarSign } from 'lucide-react'
import { modalLabelStyle } from '@/components/modal'

const fH = 'var(--font-heading)'
const fB = 'var(--font-body)'

// Minimal shape both hosts can satisfy: the public Job Board passes a full JobPosting; the
// Applications page builds this from its (now company-joined) application rows.
export type JobView = {
  id?: string
  title: string
  company_name?: string | null
  company_location?: string | null
  company_address?: string | null
  company_size?: string | null
  company_industry?: string | null
  company_description?: string | null
  department_name?: string | null
  salary_amount?: number | null
  estimated_hours?: string | null
  expires_at?: string | null
  created_at?: string | null
  urgency?: string | null
  minimum_age?: number | null
  experience_required?: string | null
  uniform_type?: string | null
  uniform_required?: boolean | null
  uniform_details?: string | null
  form_type?: string | null
  is_recurring?: boolean | null
  shift_date?: string | null
  shift_start_time?: string | null
  shift_end_time?: string | null
  break_start_time?: string | null
  break_end_time?: string | null
  job_start_time?: string | null
  description?: string | null
  requirements?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

// How long until a posting's application deadline auto-closes it — shown as a header pill.
export function deadlineCountdown(expiresAt: string | null | undefined): { label: string; expired: boolean } | null {
  if (!expiresAt) return null
  const diffMs = new Date(expiresAt).getTime() - Date.now()
  if (diffMs <= 0) return { label: 'Application Closed', expired: true }
  const totalMins = Math.floor(diffMs / 60000)
  const days = Math.floor(totalMins / 1440)
  const hours = Math.floor((totalMins % 1440) / 60)
  const mins = totalMins % 60
  if (days >= 1) return { label: `Closes in ${days}d ${hours}h`, expired: false }
  if (hours >= 1) return { label: `Closes in ${hours}h ${mins}m`, expired: false }
  return { label: `Closes in ${Math.max(1, mins)}m`, expired: false }
}

function fmt12(t: string) {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  const ap = h < 12 ? 'AM' : 'PM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

function uniformLabelOf(job: JobView): string | null {
  return job.uniform_type === 'dress_code'
    ? 'Specific Dress Code'
    : (job.uniform_type === 'company' || job.uniform_required) ? 'Company Uniform Provided' : null
}

// Resolve effective job type — prefer explicit form_type, fall back to is_recurring.
export function resolveJobType(job: JobView): 'shift' | 'oneoff' {
  if (job.form_type === 'shift' || job.form_type === 'oneoff') return job.form_type
  return job.is_recurring ? 'shift' : 'oneoff'
}

// Format salary: shift → "$15/hr", one-off → "$80".
export function formatSalary(job: JobView): string | null {
  if (!job.salary_amount) return null
  if (resolveJobType(job) === 'shift') return `$${job.salary_amount}/hr`
  return `$${job.salary_amount}`
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

export function JobCard({
  job,
  selected = false,
  onClick,
  statusBadge,
  footer,
  hideDeadline = false,
}: {
  job: JobView
  selected?: boolean
  onClick?: () => void
  // Optional application status pill (e.g. "Pending" / "Withdrawn"), rendered top-right.
  statusBadge?: React.ReactNode
  // Optional footer area (e.g. a "View Details" button on the Applications page).
  footer?: React.ReactNode
  // Suppress the application-deadline / "Posted …" line — the deadline is meaningless once an
  // application has ended, so the Applications History cards hide it.
  hideDeadline?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const clickable = !!onClick

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#FFFFFF',
        border: `1.5px solid ${selected ? '#F97316' : hovered && clickable ? '#F97316' : '#EDE9E3'}`,
        borderRadius: '16px', padding: '24px', cursor: clickable ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', gap: '14px',
        transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
        boxShadow: selected
          ? '0 0 0 3px rgba(249,115,22,0.15), 0 8px 24px rgba(249,115,22,0.1)'
          : hovered && clickable
            ? '0 8px 28px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)'
            : '0 1px 4px rgba(0,0,0,0.04)',
        transform: hovered && clickable && !selected ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >
      {statusBadge && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -4 }}>{statusBadge}</div>
      )}

      {/* Requirement badges — urgency / minimum age / experience / uniform */}
      {(() => {
        const isShiftJob = resolveJobType(job) === 'shift'
        const uniformLabel = uniformLabelOf(job)
        const showUrgency = !isShiftJob && (job.urgency === 'high' || job.urgency === 'urgent')
        const showExp = job.experience_required && job.experience_required !== 'Not Required'
        if (!showUrgency && !job.minimum_age && !showExp && !uniformLabel) return null
        return (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {showUrgency && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFF1F2', color: '#E11D48', fontFamily: fB, fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                <Zap size={12} />{job.urgency === 'urgent' ? 'Urgent' : 'High'}
              </span>
            )}
            {job.minimum_age && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EEF2FF', color: '#4F46E5', fontFamily: fB, fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                <Cake size={12} />{job.minimum_age}+
              </span>
            )}
            {showExp && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ECFEFF', color: '#0891B2', fontFamily: fB, fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                <UserCheck size={12} />{job.experience_required}
              </span>
            )}
            {uniformLabel && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFFBEB', color: '#B45309', fontFamily: fB, fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                <Shirt size={12} />{job.uniform_type === 'dress_code' ? 'Dress Code' : 'Uniform Provided'}
              </span>
            )}
          </div>
        )
      })()}

      {/* Title + company */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <p style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.0625rem', color: '#111827', lineHeight: 1.35, margin: 0 }}>
          {job.title}
        </p>
        <p style={{ fontFamily: fB, fontSize: '0.875rem', fontWeight: 500, color: '#6B7280', margin: 0 }}>
          {job.company_name ?? '—'}
        </p>
      </div>

      {/* Location + pay + estimated hours */}
      {(job.company_location || job.salary_amount || job.estimated_hours) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {job.company_location && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: fB, fontSize: '0.75rem', fontWeight: 800, color: '#4B5563', background: '#F3F4F6', borderRadius: 999, padding: '4px 10px' }}>
              <MapPin size={12} strokeWidth={2.5} />{job.company_location}
            </span>
          )}
          {formatSalary(job) && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: fB, fontSize: '0.75rem', fontWeight: 800, color: '#065F46', background: '#ECFDF5', borderRadius: 999, padding: '4px 10px' }}>
              {formatSalary(job)}
            </span>
          )}
          {resolveJobType(job) === 'oneoff' && job.estimated_hours && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: fB, fontSize: '0.75rem', fontWeight: 800, color: '#1D4ED8', background: '#EFF6FF', borderRadius: 999, padding: '4px 10px' }}>
              <Clock size={12} />{job.estimated_hours}h
            </span>
          )}
        </div>
      )}

      {/* Application deadline countdown, or the posted time when no deadline is set. */}
      {!hideDeadline && (() => {
        const cd = deadlineCountdown(job.expires_at)
        if (cd) {
          return (
            <div style={{ paddingTop: '2px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontFamily: fB, fontSize: '0.72rem', fontWeight: 700, background: cd.expired ? '#FEF2F2' : '#FFFBEB', color: cd.expired ? '#B91C1C' : '#B45309', border: `1px solid ${cd.expired ? '#FECACA' : '#FDE68A'}`, whiteSpace: 'nowrap' }}>
                <Clock size={11} />{cd.label}
              </span>
            </div>
          )
        }
        if (job.created_at) {
          return (
            <p style={{ fontFamily: fB, fontSize: '0.75rem', color: '#9CA3AF', margin: 0, paddingTop: '2px' }}>
              Posted {timeAgo(job.created_at)}
            </p>
          )
        }
        return null
      })()}

      {footer}
    </div>
  )
}

// ─── Job Detail Panel ─────────────────────────────────────────────────────────

export function JobDetailPanel({
  job,
  onClose,
  onApply,
  canApply = false,
  actionSlot,
  variant = 'panel',
}: {
  job: JobView
  onClose: () => void
  onApply?: (job: JobView) => void
  // False for signed-in company staff / platform admins — Apply is hidden rather than rejected.
  canApply?: boolean
  // Replaces the "Apply Now" area (e.g. application status + Withdraw/Accept/Decline actions).
  actionSlot?: React.ReactNode
  // 'panel' = sticky sidebar (Job Board); 'modal' = static full-width block inside a modal overlay.
  variant?: 'panel' | 'modal'
}) {
  const isShiftJob = resolveJobType(job) === 'shift'
  const cd = deadlineCountdown(job.expires_at)
  const uniformLabel = uniformLabelOf(job)
  const payLabel = job.salary_amount != null
    ? (isShiftJob ? `$${job.salary_amount}/hr` : `$${job.salary_amount} flat rate`)
    : null
  const metaRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 }
  const metaText: React.CSSProperties = { fontFamily: fB, fontSize: '0.875rem', color: '#374151' }
  const metaIcon: React.CSSProperties = { flexShrink: 0 }
  const scheduleLine: React.CSSProperties = { fontFamily: fB, fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }

  const rootStyle: React.CSSProperties = variant === 'modal'
    ? { background: '#FFFFFF', border: '1px solid #EDE9E3', borderRadius: '20px', padding: '32px', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }
    : { background: '#FFFFFF', border: '1px solid #EDE9E3', borderRadius: '20px', padding: '32px', position: 'sticky', top: '24px', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }

  return (
    <div style={rootStyle}>
      {/* Header — title + company + deadline pill */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <h2 style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.0625rem', color: '#111827', lineHeight: 1.35, margin: 0 }}>
              {job.title}
            </h2>
            {cd && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontFamily: fB, fontSize: '0.72rem', fontWeight: 700, background: cd.expired ? '#FEF2F2' : '#FFFBEB', color: cd.expired ? '#B91C1C' : '#B45309', border: `1px solid ${cd.expired ? '#FECACA' : '#FDE68A'}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                <Clock size={11} />{cd.label}
              </span>
            )}
          </div>
          <p style={{ fontFamily: fB, fontSize: '0.875rem', fontWeight: 500, color: '#6B7280', margin: '0 0 14px' }}>
            {job.company_name ?? '—'}
          </p>

          {/* Meta rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {job.department_name && (
              <div style={metaRow}><LayoutGrid size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>{job.department_name}</span></div>
            )}
            {job.minimum_age && (
              <div style={metaRow}><Cake size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>{job.minimum_age}+</span></div>
            )}
            {job.experience_required && job.experience_required !== 'Not Required' && (
              <div style={metaRow}><UserCheck size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>Experience {job.experience_required}</span></div>
            )}
            {uniformLabel && (
              <div style={metaRow}><Shirt size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>{uniformLabel}</span></div>
            )}
            {!isShiftJob && job.estimated_hours && (
              <div style={metaRow}><Clock size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={metaText}>Est. {job.estimated_hours} hours</span></div>
            )}
            {payLabel && (
              <div style={metaRow}><DollarSign size={14} color="#F97316" strokeWidth={2} style={metaIcon} /><span style={{ fontFamily: fB, fontSize: '0.875rem', fontWeight: 600, color: '#059669' }}>{payLabel}</span></div>
            )}
          </div>

          {canApply && onApply && (
            <button onClick={() => onApply(job)} className="btn-press cta-shimmer" style={{
              marginTop: 14, display: 'inline-block', textAlign: 'center',
              background: '#F97316', color: '#FFFFFF', padding: '9px 28px',
              borderRadius: '10px', fontFamily: fB, fontWeight: 700,
              fontSize: '0.875rem', border: 'none', cursor: 'pointer',
            }}>
              Apply Now
            </button>
          )}
          {actionSlot && <div style={{ marginTop: 14 }}>{actionSlot}</div>}
        </div>
        <button onClick={onClose} aria-label="Close panel"
          style={{ background: '#F3F4F6', border: 'none', borderRadius: '8px', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <X size={16} color="#374151" />
        </button>
      </div>

      {/* Schedule */}
      {(job.shift_date || job.shift_start_time || job.job_start_time) && (
        <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: '20px' }}>
          <p style={{ ...modalLabelStyle, fontFamily: fB, margin: '0 0 8px' }}>Schedule</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {job.shift_date && (
              <p style={scheduleLine}><span style={{ fontWeight: 600, color: '#EA580C' }}>Date:</span> {new Date(job.shift_date).toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            )}
            {isShiftJob && (job.shift_start_time || job.shift_end_time) && (
              <p style={scheduleLine}><span style={{ fontWeight: 600, color: '#EA580C' }}>Working Hours:</span> {job.shift_start_time ? fmt12(job.shift_start_time) : '—'} – {job.shift_end_time ? fmt12(job.shift_end_time) : '—'}</p>
            )}
            {isShiftJob && (job.break_start_time || job.break_end_time) && (
              <p style={scheduleLine}><span style={{ fontWeight: 600, color: '#EA580C' }}>Break Time:</span> {job.break_start_time ? fmt12(job.break_start_time) : '—'} – {job.break_end_time ? fmt12(job.break_end_time) : '—'}</p>
            )}
            {!isShiftJob && job.job_start_time && (
              <p style={scheduleLine}><span style={{ fontWeight: 600, color: '#EA580C' }}>Start Time:</span> {fmt12(job.job_start_time)}</p>
            )}
          </div>
        </div>
      )}

      {/* Responsibilities */}
      <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: '20px' }}>
        <p style={{ ...modalLabelStyle, fontFamily: fB, margin: '0 0 8px' }}>Responsibilities</p>
        <p style={{ fontFamily: fB, fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }}>
          {job.description || '—'}
        </p>
      </div>

      {/* Skills & Qualifications */}
      <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: '20px' }}>
        <p style={{ ...modalLabelStyle, fontFamily: fB, margin: '0 0 8px' }}>Skills &amp; Qualifications</p>
        <p style={{ fontFamily: fB, fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }}>
          {job.requirements || '—'}
        </p>
      </div>

      {/* Dress code / uniform details */}
      {uniformLabel && job.uniform_details && (
        <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: '20px' }}>
          <p style={{ ...modalLabelStyle, fontFamily: fB, margin: '0 0 8px' }}>{job.uniform_type === 'dress_code' ? 'Dress Code' : 'Uniform Details'}</p>
          <p style={{ fontFamily: fB, fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }}>
            {job.uniform_details}
          </p>
        </div>
      )}

      {/* Company profile */}
      <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: '20px' }}>
        <p style={{ ...modalLabelStyle, fontFamily: fB, margin: '0 0 8px' }}>Company Profile</p>
        <div style={{
          background: '#FFFFFF', border: '1px solid #EDE9E3',
          borderRadius: '14px', padding: '20px 22px',
          display: 'flex', flexDirection: 'column', gap: '14px',
        }}>
          <p style={{ fontFamily: fH, fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>
            {job.company_name ?? '—'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {job.company_location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MapPin size={14} color="#9CA3AF" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: fB, fontSize: '0.875rem', color: '#4B5563' }}>{job.company_location}</span>
              </div>
            )}
            {job.company_address && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MapPin size={14} color="#9CA3AF" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: fB, fontSize: '0.875rem', color: '#4B5563' }}>{job.company_address}</span>
              </div>
            )}
            {job.company_size && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={14} color="#9CA3AF" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: fB, fontSize: '0.875rem', color: '#4B5563' }}>{job.company_size} employees</span>
              </div>
            )}
            {job.company_industry && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Briefcase size={14} color="#9CA3AF" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: fB, fontSize: '0.875rem', color: '#4B5563' }}>{job.company_industry}</span>
              </div>
            )}
            {job.company_description && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingTop: '4px', borderTop: '1px solid #EDE9E3', marginTop: '2px' }}>
                <FileText size={14} color="#9CA3AF" strokeWidth={1.75} style={{ flexShrink: 0, marginTop: '3px' }} />
                <span style={{ fontFamily: fB, fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.7 }}>{job.company_description}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
