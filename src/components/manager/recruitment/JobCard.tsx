import React from 'react'
import {
  MapPin, Clock, DollarSign, Building2, Calendar, Users, Tag,
  AlertCircle, Repeat, Zap, RefreshCw, Timer,
} from 'lucide-react'
import { JobPosting } from '@/types/recruitment.types'
import { StatusBadge } from './ui'
import { ActionMenu } from './ActionMenu'
import { isExpired, expiryLabel, postedAgoLabel } from '@/app/manager/recruitment/utils/recruitment.utils'

interface JobCardProps {
  job: JobPosting
  selected?: boolean
  compact?: boolean
  onEdit: () => void
  onDuplicate: () => void
  onClose: () => void
  onArchive: () => void
  onDelete: () => void
}

export function JobCard({
  job,
  selected = false,
  compact = false,
  onEdit,
  onDuplicate,
  onClose,
  onArchive,
  onDelete,
}: JobCardProps) {

  const isShift     = job.is_recurring || job.form_type === 'shift'
  const expired     = isExpired(job)
  const expLabel    = expiryLabel(job)
  const postedLabel = postedAgoLabel(job.created_at)
  const expDiffDays = job.expires_at
    ? Math.ceil((new Date(job.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div
      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', opacity: job.status === 'archived' ? 0.65 : 1, transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.09)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)')}>
      <div style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#111827' }}>{job.title}</span>
              <StatusBadge status={job.status} />
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isShift ? '#2563EB' : '#D97706', background: isShift ? '#EFF6FF' : '#FFFBEB', padding: '2px 7px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: '3px' }}>
                {isShift ? <><Repeat size={10} /> Shift</> : <><Zap size={10} /> One-off</>}
              </span>
              {job.urgency && job.urgency !== 'normal' && (
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#DC2626', background: '#FEF2F2', padding: '2px 7px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <AlertCircle size={10} />{job.urgency === 'urgent' ? 'Urgent' : 'High Priority'}
                </span>
              )}
              {expLabel && (
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px', borderRadius: 999,
                  display: 'flex', alignItems: 'center', gap: '3px',
                  color:      expired ? '#6B7280' : expDiffDays !== null && expDiffDays <= 3 ? '#DC2626' : '#D97706',
                  background: expired ? '#F3F4F6' : expDiffDays !== null && expDiffDays <= 3 ? '#FEF2F2' : '#FEF3C7',
                }}>
                  <Timer size={10} />{expLabel}
                </span>
              )}
            </div>

            {/* Company & Industry */}
            {(job.company_name || job.industry) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Building2 size={12} color="#9CA3AF" />
                <span style={{ fontSize: '0.8125rem', color: '#4B5563', fontWeight: 500 }}>
                  {[job.company_name, job.industry].filter(Boolean).join(' · ')}
                </span>
              </div>
            )}

            {/* Description */}
            <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: '0 0 10px', lineHeight: 1.6 }}>
              {job.description.length > 140 ? job.description.slice(0, 140) + '…' : job.description}
            </p>

            {/* Meta chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              {job.location && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#374151', background: '#F3F4F6', padding: '3px 9px', borderRadius: 999, fontWeight: 500 }}>
                  <MapPin size={11} />{job.location}
                </span>
              )}
              {job.salary_amount && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#065F46', background: '#D1FAE5', padding: '3px 9px', borderRadius: 999, fontWeight: 600 }}>
                  <DollarSign size={11} />${job.salary_amount} {job.salary_type}
                </span>
              )}
              {job.employment_type && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#374151', background: '#F3F4F6', padding: '3px 9px', borderRadius: 999, fontWeight: 500 }}>
                  <Tag size={11} />{job.employment_type.charAt(0).toUpperCase() + job.employment_type.slice(1)}
                </span>
              )}
              {job.openings && job.openings > 1 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#374151', background: '#F3F4F6', padding: '3px 9px', borderRadius: 999, fontWeight: 500 }}>
                  <Users size={11} />{job.openings} openings
                </span>
              )}
              {isShift && job.shift_days && job.shift_days.length > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#1D4ED8', background: '#DBEAFE', padding: '3px 9px', borderRadius: 999, fontWeight: 500 }}>
                  <Calendar size={11} />{job.shift_days.join(', ')}
                </span>
              )}
              {isShift && job.shift_start_time && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#374151', background: '#F3F4F6', padding: '3px 9px', borderRadius: 999, fontWeight: 500 }}>
                  <Clock size={11} />{job.shift_start_time} – {job.shift_end_time}
                </span>
              )}
              {!isShift && job.job_date && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#D97706', background: '#FEF3C7', padding: '3px 9px', borderRadius: 999, fontWeight: 500 }}>
                  <Calendar size={11} />{job.job_date}
                </span>
              )}
              {!isShift && job.estimated_hours && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#374151', background: '#F3F4F6', padding: '3px 9px', borderRadius: 999, fontWeight: 500 }}>
                  <Clock size={11} />{job.estimated_hours}
                </span>
              )}
              {isShift && job.is_recurring && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#374151', background: '#F3F4F6', padding: '3px 9px', borderRadius: 999, fontWeight: 500 }}>
                  <RefreshCw size={11} />Every {job.recurrence_interval} {job.recurrence_unit}(s)
                </span>
              )}
            </div>

            {/* Requirements preview */}
            {job.requirements && (
              <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: '0 0 8px', lineHeight: 1.5 }}>
                <span style={{ fontWeight: 600, color: '#6B7280' }}>Requirements: </span>
                {job.requirements.length > 80 ? job.requirements.slice(0, 80) + '…' : job.requirements}
              </p>
            )}

            {/* Benefits */}
            {job.benefits && (
              <p style={{ fontSize: '0.75rem', color: '#059669', margin: 0 }}>{job.benefits}</p>
            )}

            {/* Footer */}
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>{postedLabel}</span>
            </div>
          </div>

          <ActionMenu
            job={job}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onClose={onClose}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  )
}