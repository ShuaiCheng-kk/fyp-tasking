'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ApplicationDetailsModal from '@/components/guest/ApplicationDetailsModal'
import ApplyJobModal from '@/components/guest/ApplyJobModal'

type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn'

type Profile = {
  id: string
  full_name: string
  email_address: string
  phone_number: string
  role: string
}

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

type RawApplication = {
  id: string
  status: ApplicationStatus
  applied_at: string
  resume_url?: string
  cover_letter?: string
  job_postings?: {
    title?: string
    company_name?: string
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
  } | null
}

function ApplicationsContent() {
  const searchParams = useSearchParams()

  const [showApplyModal, setShowApplyModal] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedApplication, setSelectedApplication] =
  useState<Application | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadApplications = async (userId: string) => {
    const res = await fetch(`/api/guest/applications?user_id=${userId}`)
    const data = await res.json()

    if (!data.success) {
      throw new Error(data.message || 'Failed to load applications')
    }

    const mappedApplications: Application[] = data.applications.map(
      (app: RawApplication) => ({
        id: app.id,
        job_title: app.job_postings?.title || 'Job Opening',
        company_name: app.job_postings?.company_name || 'Company',
        status: app.status,
        applied_at: formatDate(app.applied_at),

        resume_url: app.resume_url,
        cover_letter: app.cover_letter,

        location: app.job_postings?.location,
        employment_type: app.job_postings?.employment_type,
        salary_amount: app.job_postings?.salary_amount,
        salary_type: app.job_postings?.salary_type,
        description: app.job_postings?.description,
        requirements: app.job_postings?.requirements,
        benefits: app.job_postings?.benefits,
        openings: app.job_postings?.openings,

        job_date: app.job_postings?.job_date
          ? formatDate(app.job_postings.job_date)
          : undefined,

        shift_start_time: app.job_postings?.shift_start_time,
        shift_end_time: app.job_postings?.shift_end_time,
      })
    )

    setApplications(mappedApplications)
  }

  useEffect(() => {
    const loadPageData = async () => {
      try {
        setLoading(true)

        const authId = localStorage.getItem('tasking_user_id')
        if (!authId) {
          window.location.href = '/signin'
          return
        }

        const profileRes = await fetch(`/api/guest/profile?user_id=${authId}`)
        const profileData = await profileRes.json()

        if (!profileData.success) {
          throw new Error(profileData.message || 'Failed to load profile')
        }

        setProfile(profileData.profile)

        await loadApplications(profileData.profile.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load applications')
      } finally {
        setLoading(false)
      }
    }

    loadPageData()
  }, [])

  useEffect(() => {
    const apply = searchParams.get('apply')
    const selectedJobId = searchParams.get('job_id')

    if (apply === 'true' && selectedJobId) {
      setJobId(selectedJobId)
      setShowApplyModal(true)
    }
  }, [searchParams])

  const handleLogout = () => {
    localStorage.removeItem('tasking_user_id')
    localStorage.removeItem('tasking_user_role')
    localStorage.removeItem('tasking_company_id')
    localStorage.removeItem('tasking_active_session')
    sessionStorage.removeItem('tasking_session_active')
    window.location.href = '/signin'
  }

  const handleModalClose = async () => {
    setShowApplyModal(false)

    if (profile?.id) {
      await loadApplications(profile.id)
    }
  }

  return (
    <>
      <header style={topBarStyle}>
        <div style={topBarInnerStyle}>
          <div style={brandWrapStyle}>
            <div style={logoBoxStyle}>
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="white" />
                <rect x="8" y="9" width="9" height="2.5" rx="1.25" fill="#6B7280" />
                <rect x="8" y="14.75" width="16" height="2.5" rx="1.25" fill="#6B7280" />
                <rect x="8" y="20.5" width="12" height="2.5" rx="1.25" fill="#6B7280" />
                <circle cx="22" cy="10.25" r="3.5" fill="#D1D5DB" />
                <path
                  d="M20.3 10.25L21.5 11.5L23.8 9"
                  stroke="#6B7280"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h1 style={headerTitleStyle}>Tasking</h1>
          </div>

          <div style={rightHeaderStyle}>
            <div style={userInfoStyle}>
              <span style={userNameStyle}>{profile?.full_name || 'Guest'}</span>
              <span style={roleBadgeStyle}>Guest User</span>
            </div>

            <button onClick={handleLogout} style={logoutButtonStyle}>
              Log Out
            </button>
          </div>
        </div>
      </header>

      <main style={pageStyle}>
        <section style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <p style={sectionLabelStyle}>MY APPLICATIONS</p>

            <button style={editContactButtonStyle}>
              Edit Contact Information
            </button>
          </div>

          {loading ? (
            <div style={emptyCardStyle}>Loading applications...</div>
          ) : error ? (
            <div style={errorCardStyle}>{error}</div>
          ) : applications.length === 0 ? (
            <div style={emptyCardStyle}>
              <div style={emptyIconStyle}>📄</div>
              <h3 style={emptyTitleStyle}>No applications yet</h3>
              <p style={emptyTextStyle}>
                Your submitted applications will appear here after you apply for a job.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {applications.map((app) => (
                <article key={app.id} style={applicationCardStyle}>
                  <div style={cardHeaderStyle}>
                    <div>
                      <h3 style={cardTitleStyle}>{app.job_title}</h3>
                      <p style={cardMetaStyle}>
                        {app.company_name} · Applied on {app.applied_at}
                      </p>
                    </div>

                    <span style={{ ...statusBadgeBaseStyle, ...statusStyle(app.status) }}>
                      {formatStatus(app.status)}
                    </span>
                  </div>

                  <div style={cardActionsStyle}>
                    <button
                      style={secondaryActionButtonStyle}
                      onClick={() => setSelectedApplication(app)}
                    >
                      View Details
                    </button>

                    {app.status === 'pending' && (
                      <button style={dangerActionButtonStyle}>
                        Withdraw Application
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {selectedApplication && (
        <ApplicationDetailsModal
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
        />
      )}
      
      {showApplyModal && jobId && (
        <ApplyJobModal jobId={jobId} onClose={handleModalClose} />
      )}
    </>
  )
}

export default function WorkerApplicationsPage() {
  return (
    <Suspense fallback={<main style={{ padding: 40 }}>Loading...</main>}>
      <ApplicationsContent />
    </Suspense>
  )
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatStatus(status: ApplicationStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function statusStyle(status: ApplicationStatus): React.CSSProperties {
  if (status === 'pending') {
    return { background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }
  }

  if (status === 'accepted') {
    return { background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0' }
  }

  if (status === 'rejected') {
    return { background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA' }
  }

  return { background: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB' }
}

const topBarStyle: React.CSSProperties = {
  height: 72,
  background: '#4B5563',
  color: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
}

const topBarInnerStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 32px',
}

const brandWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
}

const logoBoxStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  background: '#F9FAFB',
  display: 'grid',
  placeItems: 'center',
}

const headerTitleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: '1.375rem',
  fontWeight: 700,
}

const rightHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
}

const userInfoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
}

const userNameStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 700,
}

const roleBadgeStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.16)',
  fontSize: '0.8125rem',
  fontWeight: 700,
}

const logoutButtonStyle: React.CSSProperties = {
  border: '1px solid #FCA5A5',
  background: '#DC2626',
  color: '#FFFFFF',
  padding: '8px 13px',
  borderRadius: 10,
  fontSize: '0.8125rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const pageStyle: React.CSSProperties = {
  minHeight: 'calc(100vh - 72px)',
  background: '#F3F4F6',
  padding: '42px 46px',
  fontFamily: 'var(--font-body)',
}

const sectionStyle: React.CSSProperties = {
  width: '100%',
}

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 22,
}

const sectionLabelStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: '1rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  color: '#4B5563',
}

const editContactButtonStyle: React.CSSProperties = {
  border: '1px solid #D1D5DB',
  background: '#FFFFFF',
  color: '#374151',
  padding: '9px 14px',
  borderRadius: 10,
  fontSize: '0.8125rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const emptyCardStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 280,
  background: '#FFFFFF',
  border: '1px solid #D1D5DB',
  borderRadius: 16,
  padding: '42px 28px',
  textAlign: 'center',
  boxShadow: '0 8px 22px rgba(15,23,42,0.04)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
}

const errorCardStyle: React.CSSProperties = {
  ...emptyCardStyle,
  color: '#B91C1C',
  background: '#FEF2F2',
}

const emptyIconStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  marginBottom: 16,
  borderRadius: 16,
  background: '#F3F4F6',
  display: 'grid',
  placeItems: 'center',
  fontSize: 26,
}

const emptyTitleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: '1rem',
  fontWeight: 700,
  color: '#111827',
}

const emptyTextStyle: React.CSSProperties = {
  margin: '8px auto 0',
  maxWidth: 420,
  fontSize: '0.875rem',
  color: '#6B7280',
  lineHeight: 1.6,
}

const applicationCardStyle: React.CSSProperties = {
  width: '100%',
  background: '#FFFFFF',
  border: '1px solid #D1D5DB',
  borderRadius: 16,
  padding: 22,
  boxShadow: '0 8px 22px rgba(15,23,42,0.04)',
}

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 18,
}

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: '1rem',
  fontWeight: 700,
  color: '#111827',
}

const cardMetaStyle: React.CSSProperties = {
  margin: '7px 0 0',
  fontSize: '0.8125rem',
  color: '#6B7280',
}

const statusBadgeBaseStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: '0.75rem',
  fontWeight: 700,
}

const cardActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  marginTop: 18,
}

const secondaryActionButtonStyle: React.CSSProperties = {
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

const dangerActionButtonStyle: React.CSSProperties = {
  border: '1px solid #FECACA',
  background: '#FEF2F2',
  color: '#B91C1C',
  padding: '8px 12px',
  borderRadius: 9,
  fontSize: '0.8125rem',
  fontWeight: 700,
  cursor: 'pointer',
}