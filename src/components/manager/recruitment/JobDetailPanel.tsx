'use client'

import React from 'react'
import {
  X, Pencil, Copy, XCircle, Archive, Trash2,
  MapPin, Clock, DollarSign, Building2, Calendar,
  Users, Tag, RefreshCw, Timer, AlertCircle, Repeat, Zap,
  ChevronRight,
} from 'lucide-react'
import { JobPosting } from '@/types/recruitment.types'
import { StatusBadge } from './ui'
import { isExpired, expiryLabel } from '@/app/manager/recruitment/utils/recruitment.utils'

interface Props {
  job: JobPosting
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onCloseJob: () => void
  onArchive: () => void
  onDelete: () => void
}

function DetailChip({ icon, label, color = '#374151', bg = '#F3F4F6' }: {
  icon: React.ReactNode; label: string; color?: string; bg?: string
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 11px', borderRadius: 999, background: bg, color, fontSize: '0.8125rem', fontWeight: 500 }}>
      {icon}{label}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <p style={{ fontWeight: 700, fontSize: '0.7rem', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>{title}</p>
      {children}
    </div>
  )
}

export function JobDetailPanel({ job, onClose, onEdit, onDuplicate, onCloseJob, onArchive, onDelete }: Props) {
  const isShift = job.is_recurring || job.form_type === 'shift'
  const expired = isExpired(job)
  const expLabel = expiryLabel(job)
  const expDiffDays = job.expires_at
    ? Math.ceil((new Date(job.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const daysAgo = Math.floor((Date.now() - new Date(job.created_at).getTime()) / (1000 * 60 * 60 * 24))
  const postedLabel = daysAgo === 0 ? 'Posted today' : daysAgo === 1 ? 'Posted yesterday' : `Posted ${daysAgo} days ago`

  const isClosed   = job.status === 'closed'
  const isArchived = job.status === 'archived'

  const actionItems = [
    { icon: <Pencil size={14} />, label: 'Edit listing', action: onEdit, color: '#374151', hoverBg: '#F9FAFB' },
    { icon: <Copy size={14} />, label: 'Duplicate', action: onDuplicate, color: '#374151', hoverBg: '#F9FAFB' },
    ...(!isClosed && !isArchived ? [{ icon: <XCircle size={14} />, label: 'Close listing', action: onCloseJob, color: '#374151', hoverBg: '#F9FAFB' }] : []),
    ...(!isArchived ? [{ icon: <Archive size={14} />, label: 'Archive', action: onArchive, color: '#374151', hoverBg: '#F9FAFB' }] : []),
    { icon: <Trash2 size={14} />, label: 'Delete', action: onDelete, color: '#DC2626', hoverBg: '#FEF2F2' },
  ]

  return (
    <div style={{
      width: '420px', flexShrink: 0, height: '100%',
      background: '#FFFFFF', borderLeft: '1px solid #E5E7EB',
      display: 'flex', flexDirection: 'column',
      animation: 'slideIn 0.2s ease-out',
    }}>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Panel header */}
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Type + status badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isShift ? '#2563EB' : '#D97706', background: isShift ? '#EFF6FF' : '#FFFBEB', padding: '2px 8px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: '3px' }}>
                {isShift ? <><Repeat size={10} /> Shift</> : <><Zap size={10} /> One-off</>}
              </span>
              <StatusBadge status={job.status} />
              {job.urgency && job.urgency !== 'normal' && (
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#DC2626', background: '#FEF2F2', padding: '2px 8px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <AlertCircle size={10} />{job.urgency === 'urgent' ? 'Urgent' : 'High Priority'}
                </span>
              )}
              {expLabel && (
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: expired ? '#6B7280' : expDiffDays !== null && expDiffDays <= 3 ? '#DC2626' : '#D97706', background: expired ? '#F3F4F6' : expDiffDays !== null && expDiffDays <= 3 ? '#FEF2F2' : '#FEF3C7', padding: '2px 8px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Timer size={10} />{expLabel}
                </span>
              )}
            </div>
            <h2 style={{ fontWeight: 800, fontSize: '1.0625rem', color: '#111827', margin: '0 0 4px', lineHeight: 1.3 }}>{job.title}</h2>
            {(job.company_name || job.industry) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Building2 size={12} color="#9CA3AF" />
                <span style={{ fontSize: '0.8125rem', color: '#6B7280', fontWeight: 500 }}>
                  {[job.company_name, job.industry].filter(Boolean).join(' · ')}
                </span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#6B7280', display: 'flex', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Quick action buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          <button onClick={onEdit}
            style={{ flex: 1, padding: '7px 12px', background: '#1E3A5F', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <Pencil size={13} /> Edit
          </button>
          <button onClick={onDuplicate}
            style={{ padding: '7px 12px', background: '#F3F4F6', color: '#374151', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Copy size={13} /> Duplicate
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px' }}>

        {/* At-a-glance chips */}
        <Section title="Details">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {job.location && (
              <DetailChip icon={<MapPin size={13} />} label={job.location} />
            )}
            {job.salary_amount && (
              <DetailChip icon={<DollarSign size={13} />} label={`$${job.salary_amount} ${job.salary_type ?? ''}`} color="#065F46" bg="#D1FAE5" />
            )}
            {job.employment_type && (
              <DetailChip icon={<Tag size={13} />} label={job.employment_type.charAt(0).toUpperCase() + job.employment_type.slice(1)} />
            )}
            {job.openings && job.openings > 0 && (
              <DetailChip icon={<Users size={13} />} label={`${job.openings} opening${job.openings > 1 ? 's' : ''}`} />
            )}
            {isShift && job.shift_days && job.shift_days.length > 0 && (
              <DetailChip icon={<Calendar size={13} />} label={job.shift_days.join(', ')} color="#1D4ED8" bg="#DBEAFE" />
            )}
            {isShift && job.shift_start_time && (
              <DetailChip icon={<Clock size={13} />} label={`${job.shift_start_time} – ${job.shift_end_time}`} />
            )}
            {isShift && job.is_recurring && (
              <DetailChip icon={<RefreshCw size={13} />} label={`Every ${job.recurrence_interval} ${job.recurrence_unit}(s)`} />
            )}
            {!isShift && job.job_date && (
              <DetailChip icon={<Calendar size={13} />} label={job.job_date} color="#D97706" bg="#FEF3C7" />
            )}
            {!isShift && job.job_end_date && (
              <DetailChip icon={<Calendar size={13} />} label={`Until ${job.job_end_date}`} />
            )}
            {!isShift && job.estimated_hours && (
              <DetailChip icon={<Clock size={13} />} label={`${job.estimated_hours} hrs`} />
            )}
          </div>
        </Section>

        {/* Description */}
        <Section title="Job Description">
          <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
            {job.description}
          </p>
        </Section>

        {/* Requirements */}
        {job.requirements && (
          <Section title="Requirements">
            <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
              {job.requirements}
            </p>
          </Section>
        )}

        {/* Benefits */}
        {job.benefits && (
          <Section title="Benefits & Perks">
            <p style={{ fontSize: '0.875rem', color: '#059669', lineHeight: 1.7, margin: 0 }}>
              {job.benefits}
            </p>
          </Section>
        )}

        {/* Expiry */}
        {job.expires_at && (
          <Section title="Listing Expiry">
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 14px', background: expired ? '#F3F4F6' : expDiffDays !== null && expDiffDays <= 3 ? '#FEF2F2' : '#FEF3C7', borderRadius: '8px' }}>
              <Timer size={14} color={expired ? '#6B7280' : expDiffDays !== null && expDiffDays <= 3 ? '#DC2626' : '#D97706'} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: expired ? '#6B7280' : expDiffDays !== null && expDiffDays <= 3 ? '#DC2626' : '#92400E' }}>
                {expLabel} — {new Date(job.expires_at).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </Section>
        )}

        {/* Meta */}
        <Section title="Listing Info">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
              <span style={{ color: '#9CA3AF' }}>Posted</span>
              <span style={{ color: '#374151', fontWeight: 500 }}>{postedLabel}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
              <span style={{ color: '#9CA3AF' }}>Status</span>
              <StatusBadge status={job.status} />
            </div>
            {job.industry && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span style={{ color: '#9CA3AF' }}>Industry</span>
                <span style={{ color: '#374151', fontWeight: 500 }}>{job.industry}</span>
              </div>
            )}
          </div>
        </Section>

        {/* Actions */}
        <Section title="Actions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
            {actionItems.map((item, i) => (
              <button key={i} onClick={item.action}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'none', border: 'none', borderBottom: i < actionItems.length - 1 ? '1px solid #F3F4F6' : 'none', cursor: 'pointer', fontSize: '0.8375rem', fontWeight: 500, color: item.color, textAlign: 'left', transition: 'background 0.1s', width: '100%' }}
                onMouseEnter={e => (e.currentTarget.style.background = item.hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>{item.icon}{item.label}</span>
                <ChevronRight size={13} color="#D1D5DB" />
              </button>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}