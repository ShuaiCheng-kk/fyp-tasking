'use client'

type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn'

type Application = {
  id: string
  job_title: string
  company_name: string
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
  openings?: number
  job_date?: string
  shift_start_time?: string
  shift_end_time?: string
}

type Props = {
  application: Application
  onClose: () => void
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value?: string | number | null
}) {
  if (value === null || value === undefined || value === '') return null

  return (
    <div style={detailRowStyle}>
      <div style={detailLabelStyle}>{label}</div>
      <div style={detailValueStyle}>{value}</div>
    </div>
  )
}

export default function ApplicationDetailsModal({ application, onClose }: Props) {
  const salary =
    application.salary_amount
      ? `$${application.salary_amount}${application.salary_type ? ` / ${application.salary_type}` : ''}`
      : null

  const shiftTime =
    application.shift_start_time && application.shift_end_time
      ? `${application.shift_start_time} - ${application.shift_end_time}`
      : null

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <h2 style={titleStyle}>Application Details</h2>
            <p style={subTextStyle}>{application.job_title}</p>
          </div>

          <button onClick={onClose} style={closeButtonStyle}>
            ✕
          </button>
        </div>

        <section style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Job Details</h3>

          <div style={detailsGridStyle}>
            <DetailRow label="Title" value={application.job_title} />
            <DetailRow label="Company" value={application.company_name} />
            <DetailRow label="Location" value={application.location} />
            <DetailRow label="Employment Type" value={application.employment_type} />
            <DetailRow label="Salary" value={salary} />
            <DetailRow label="Job Date" value={application.job_date} />
            <DetailRow label="Shift Time" value={shiftTime} />
            <DetailRow label="Description" value={application.description} />
            <DetailRow label="Requirements" value={application.requirements} />
            <DetailRow label="Benefits" value={application.benefits} />
            <DetailRow label="Openings" value={application.openings} />
          </div>
        </section>

        <section style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Application Status</h3>
          <span style={statusBadgeStyle}>{application.status}</span>
        </section>

        <section style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Submitted Documents</h3>

          <div style={documentActionsStyle}>
            {application.resume_url && (
              <a href={application.resume_url} target="_blank" style={docButtonStyle}>
                View Resume
              </a>
            )}

            {application.cover_letter && (
              <a href={application.cover_letter} target="_blank" style={docButtonStyle}>
                View Cover Letter
              </a>
            )}
          </div>
        </section>

        <div style={footerStyle}>
          {application.status === 'pending' && (
            <button style={withdrawButtonStyle}>
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

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17, 24, 39, 0.48)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 120,
  padding: 24,
}

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 760,
  maxHeight: '88vh',
  overflowY: 'auto',
  background: '#FFFFFF',
  borderRadius: 18,
  padding: 28,
  boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 20,
  marginBottom: 20,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: '1.25rem',
  fontWeight: 700,
  color: '#111827',
}

const subTextStyle: React.CSSProperties = {
  margin: '6px 0 0',
  fontSize: '0.875rem',
  color: '#6B7280',
}

const closeButtonStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: '1px solid #D1D5DB',
  background: '#FFFFFF',
  cursor: 'pointer',
}

const sectionStyle: React.CSSProperties = {
  borderTop: '1px solid #E5E7EB',
  paddingTop: 18,
  marginTop: 18,
}

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: '0.875rem',
  fontWeight: 700,
  color: '#374151',
}

const detailsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '14px 24px',
}

const detailRowStyle: React.CSSProperties = {
  minWidth: 0,
}

const detailLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#6B7280',
  marginBottom: 4,
}

const detailValueStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#111827',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
}

const statusBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '5px 11px',
  borderRadius: 999,
  background: '#FEF3C7',
  color: '#92400E',
  border: '1px solid #FDE68A',
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'capitalize',
}

const documentActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
}

const docButtonStyle: React.CSSProperties = {
  border: '1px solid #D1D5DB',
  background: '#FFFFFF',
  color: '#374151',
  padding: '8px 12px',
  borderRadius: 9,
  fontSize: '0.8125rem',
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  marginTop: 24,
}

const withdrawButtonStyle: React.CSSProperties = {
  border: '1px solid #FECACA',
  background: '#FEF2F2',
  color: '#B91C1C',
  padding: '9px 14px',
  borderRadius: 9,
  fontSize: '0.8125rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid #D1D5DB',
  background: '#FFFFFF',
  color: '#374151',
  padding: '9px 14px',
  borderRadius: 9,
  fontSize: '0.8125rem',
  fontWeight: 700,
  cursor: 'pointer',
}