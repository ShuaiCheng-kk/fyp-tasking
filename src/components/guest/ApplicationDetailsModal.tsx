'use client'

import {
  Briefcase,
  Building2,
  CalendarDays,
  Clock,
  DollarSign,
  FileText,
  ListChecks,
  Users,
  ChevronRight,
  MapPin,
  AlertCircle,
  Gift,
} from 'lucide-react'

type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn'

type Application = {
  id: string
  job_title: string
  title?: string
  company_name: string
  industry?: string
  status: ApplicationStatus
  applied_at: string
  resume_url?: string
  cover_letter?: string
  location?: string
  employment_type?: string
  salary_amount?: number
  salary_type?: string
  description?: string
  requirements?: string
  benefits?: string
  urgency?: string
  openings?: number
  job_date?: string
  job_end_date?: string
  shift_date?: string
  shift_days?: string[]
  shift_start_time?: string
  shift_end_time?: string
  break_start_time?: string
  break_end_time?: string
  estimated_hours?: string
  is_recurring?: boolean
  recurrence_interval?: number
  recurrence_unit?: string
}

type Props = {
  application: Application
  onClose: () => void
  onWithdraw: () => void
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value?: string | number | null
}) {
  if (value === null || value === undefined || value === '') return null

  return (
    <div style={detailItemStyle}>
      <div style={iconBoxStyle}>{icon}</div>

      <div>
        <p style={detailLabelStyle}>{label}</p>
        <p style={detailValueStyle}>{value}</p>
      </div>
    </div>
  )
}

function DocumentCard({
  label,
  helper,
  href,
  tone,
}: {
  label: string
  helper: string
  href?: string
  tone: 'blue' | 'green'
}) {
  if (!href) return null

  const iconStyle =
    tone === 'blue'
      ? { background: '#EFF6FF', color: '#2563EB' }
      : { background: '#ECFDF5', color: '#16A34A' }

  return (
    <a href={href} target="_blank" rel="noreferrer" style={documentCardStyle}>
      <div style={{ ...documentIconStyle, ...iconStyle }}>
        <FileText size={22} strokeWidth={2.2} />
      </div>

      <div style={{ flex: 1 }}>
        <p style={documentTitleStyle}>{label}</p>
        <p style={documentHelperStyle}>{helper}</p>
      </div>

      <ChevronRight size={18} color="#6B7280" />
    </a>
  )
}

export default function ApplicationDetailsModal({ application, onClose, onWithdraw }: Props) {
  const salary =
    application.salary_amount
      ? `$${application.salary_amount}${application.salary_type ? ` / ${application.salary_type}` : ''}`
      : null

  const shiftTime =
    application.shift_start_time && application.shift_end_time
      ? `${application.shift_start_time} – ${application.shift_end_time}`
      : application.shift_start_time || application.shift_end_time || null

  const breakTime =
    application.break_start_time && application.break_end_time
      ? `${application.break_start_time} – ${application.break_end_time}`
      : application.break_start_time || application.break_end_time || null

  const schedule =
    application.is_recurring && application.recurrence_interval && application.recurrence_unit
      ? `Every ${application.recurrence_interval} ${application.recurrence_unit}`
      : application.is_recurring
      ? 'Recurring'
      : null

  const dateRange =
    application.job_date && application.job_end_date
      ? `${application.job_date} – ${application.job_end_date}`
      : application.job_date || application.job_end_date || null

  return (
    <div style={overlayStyle}>
      <style>{`
        @keyframes overlayFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modalSlideIn  { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <h2 style={titleStyle}>Application Details</h2>
            <p style={subTextStyle}>{application.job_title || application.title}</p>
          </div>

          <span style={{ ...statusBadgeBaseStyle, ...statusStyle(application.status) }}>
            {formatStatus(application.status)}
          </span>
        </div>

        <section style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Job Details</h3>

          <div style={detailsGridStyle}>
            <DetailItem icon={<Building2 size={18} />} label="Company" value={application.company_name} />
            <DetailItem icon={<Building2 size={18} />} label="Industry" value={application.industry} />
            <DetailItem icon={<MapPin size={18} />} label="Location" value={application.location} />
            <DetailItem icon={<Briefcase size={18} />} label="Employment Type" value={application.employment_type} />
            <DetailItem icon={<CalendarDays size={18} />} label="Date" value={dateRange} />
            <DetailItem icon={<CalendarDays size={18} />} label="Shift Date" value={application.shift_date} />
            <DetailItem icon={<CalendarDays size={18} />} label="Shift Days" value={application.shift_days?.join(', ')} />
            <DetailItem icon={<Clock size={18} />} label="Shift Time" value={shiftTime} />
            <DetailItem icon={<Clock size={18} />} label="Break Time" value={breakTime} />
            <DetailItem icon={<Clock size={18} />} label="Estimated Hours" value={application.estimated_hours} />
            <DetailItem icon={<CalendarDays size={18} />} label="Schedule" value={schedule} />
            <DetailItem icon={<Users size={18} />} label="Openings" value={application.openings} />
            <DetailItem icon={<AlertCircle size={18} />} label="Urgency" value={application.urgency} />
            <DetailItem icon={<DollarSign size={18} />} label="Salary" value={salary} />
            <DetailItem icon={<Gift size={18} />} label="Benefits" value={application.benefits} />
            <DetailItem icon={<ListChecks size={18} />} label="Requirements" value={application.requirements} />
            <DetailItem icon={<FileText size={18} />} label="Description" value={application.description} />
          </div>
        </section>

        <section style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Application Submitted On</h3>

          <div style={submittedDateStyle}>
            <div style={submittedDateIconStyle}>
              <CalendarDays size={18} />
            </div>

            <span style={submittedDateTextStyle}>{application.applied_at}</span>
          </div>
        </section>

        <section style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Submitted Documents</h3>

          <div style={documentsGridStyle}>
            <DocumentCard
              label="Resume"
              helper="Click to view your resume"
              href={application.resume_url}
              tone="blue"
            />

            <DocumentCard
              label="Cover Letter"
              helper="Click to view your cover letter"
              href={application.cover_letter}
              tone="green"
            />
          </div>
        </section>

        <div style={footerStyle}>
          {application.status === 'pending' && (
            <button onClick={onWithdraw} style={withdrawButtonStyle}>
              Withdraw Application
            </button>
          )}

          <button onClick={onClose} style={secondaryButtonStyle}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function formatStatus(status: ApplicationStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function statusStyle(status: ApplicationStatus): React.CSSProperties {
  if (status === 'pending') {
    return {
      background: '#FEF3C7',
      color: '#92400E',
      border: '1px solid #FDE68A',
    }
  }

  if (status === 'accepted') {
    return {
      background: '#DCFCE7',
      color: '#15803D',
      border: '1px solid #BBF7D0',
    }
  }

  if (status === 'rejected') {
    return {
      background: '#FEE2E2',
      color: '#B91C1C',
      border: '1px solid #FECACA',
    }
  }

  return {
    background: '#F3F4F6',
    color: '#4B5563',
    border: '1px solid #D1D5DB',
  }
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.45)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 120,
  padding: 24,
  animation: 'overlayFadeIn 0.18s ease-out',
}

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 900,
  maxHeight: '88vh',
  overflowY: 'auto',
  background: '#FFFFFF',
  borderRadius: 20,
  padding: 32,
  boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)',
  animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 20,
  paddingBottom: 22,
  borderBottom: '1px solid #E5E7EB',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: '1.6rem',
  fontWeight: 700,
  color: '#111827',
}

const subTextStyle: React.CSSProperties = {
  margin: '8px 0 0',
  fontSize: '0.95rem',
  color: '#6B7280',
}

const statusBadgeBaseStyle: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 999,
  fontSize: '0.85rem',
  fontWeight: 700,
  whiteSpace: 'nowrap',
}

const sectionStyle: React.CSSProperties = {
  paddingTop: 24,
}

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 16px',
  fontFamily: 'var(--font-heading)',
  fontSize: '1rem',
  fontWeight: 700,
  color: '#111827',
}

const detailsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  borderTop: '1px solid #E5E7EB',
  borderLeft: '1px solid #E5E7EB',
}

const detailItemStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  padding: '18px 18px',
  borderRight: '1px solid #E5E7EB',
  borderBottom: '1px solid #E5E7EB',
  minWidth: 0,
}

const iconBoxStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  background: '#FFF7ED',
  color: '#F97316',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const detailLabelStyle: React.CSSProperties = {
  margin: '0 0 6px',
  fontSize: '0.8rem',
  fontWeight: 700,
  color: '#6B7280',
}

const detailValueStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.95rem',
  color: '#111827',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const submittedDateStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
}

const submittedDateIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: '#F3F4F6',
  color: '#374151',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const submittedDateTextStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 700,
  color: '#111827',
}

const documentsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 14,
}

const documentCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  border: '1px solid #D1D5DB',
  borderRadius: 12,
  background: '#FFFFFF',
  padding: 14,
  textDecoration: 'none',
  color: '#111827',
  cursor: 'pointer',
}

const documentIconStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const documentTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.95rem',
  fontWeight: 700,
  color: '#111827',
}

const documentHelperStyle: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: '0.8rem',
  color: '#6B7280',
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 14,
  marginTop: 30,
  paddingTop: 24,
  borderTop: '1px solid #E5E7EB',
}

const withdrawButtonStyle: React.CSSProperties = {
  border: '1.5px solid #FECACA',
  background: '#FEF2F2',
  color: '#DC2626',
  padding: '7px 18px',
  borderRadius: 8,
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  border: '1.5px solid #E5E7EB',
  background: '#FFFFFF',
  color: '#6B7280',
  padding: '7px 18px',
  borderRadius: 8,
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
}