'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import ApplicationDetailsModal from '@/components/guest/ApplicationDetailsModal'
import ApplyJobModal from '@/components/guest/ApplyJobModal'
import GuestProfileMenu from '@/components/guest/GuestProfileMenu'

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
  job_postings?: (Partial<Application> & { title?: string }) | null
}

function ApplicationsContent() {
  const searchParams = useSearchParams()
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [withdrawTargetId, setWithdrawTargetId] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)

  const loadApplications = async (userId: string) => {
    const res = await fetch(`/api/guest/applications?user_id=${userId}`)
    const data = await res.json()

    if (!data.success) {
      throw new Error(data.message || 'Failed to load applications')
    }

    setApplications(
      data.applications.map((app: RawApplication) => ({
        id: app.id,
        job_title:
          app.job_postings?.job_title ||
          app.job_postings?.title ||
          'Job Opening',
        company_name: app.job_postings?.company_name || 'Company',
        status: app.status,
        applied_at: formatDate(app.applied_at),
        resume_url: app.resume_url,
        cover_letter: app.cover_letter,
        ...app.job_postings,
      }))
    )
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

  const confirmWithdrawApplication = async () => {
    if (!withdrawTargetId) return

    try {
      setWithdrawing(true)

      const res = await fetch(`/api/guest/applications/${withdrawTargetId}/withdraw`, {
        method: 'PATCH',
      })

      const data = await res.json()

      if (!data.success) {
        alert(data.message || 'Failed to withdraw application.')
        return
      }

      if (profile?.id) await loadApplications(profile.id)

      setSelectedApplication(null)
      setWithdrawTargetId(null)
    } finally {
      setWithdrawing(false)
    }
  }

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    await supabase.auth.signOut()

    localStorage.removeItem('tasking_user_id')
    localStorage.removeItem('tasking_user_role')
    localStorage.removeItem('tasking_company_id')
    localStorage.removeItem('tasking_active_session')
    sessionStorage.removeItem('tasking_session_active')

    window.location.href = '/signout'
  }

  return (
    <>
      <header style={topBarStyle}>
        <div style={topBarInnerStyle}>
          <Link href="/" style={brandWrapStyle}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
              <rect width="32" height="32" rx="8" fill="#F97316" />
              <rect x="8" y="9" width="9" height="2.5" rx="1.25" fill="white" />
              <rect x="8" y="14.75" width="16" height="2.5" rx="1.25" fill="white" />
              <rect x="8" y="20.5" width="12" height="2.5" rx="1.25" fill="white" />
              <circle cx="22" cy="10.25" r="3.5" fill="#10B981" />
              <path
                d="M20.3 10.25L21.5 11.5L23.8 9"
                stroke="white"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <h1 style={headerTitleStyle}>Tasking</h1>
          </Link>

          <div style={rightHeaderStyle}>
            <GuestProfileMenu profile={profile} onLogout={handleLogout} />
          </div>
        </div>
      </header>

      <main style={pageStyle}>
        <section style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <p style={sectionLabelStyle}>MY APPLICATIONS</p>
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
            <div style={applicationsGridStyle}>
              {applications.map((app) => (
                <article key={app.id} style={applicationCardStyle}>
                  <div style={cardTopRowStyle}>
                    <p style={companyLabelStyle}>{app.company_name}</p>

                    <span style={{ ...statusBadgeBaseStyle, ...statusStyle(app.status) }}>
                      {formatStatus(app.status)}
                    </span>
                  </div>

                  <h3 style={cardTitleStyle}>{app.job_title}</h3>

                  <div style={cardInfoStyle}>
                    <div>
                      <p style={infoLabelStyle}>Applied on</p>
                      <p style={infoValueStyle}>{app.applied_at}</p>
                    </div>

                    <div>
                      <p style={infoLabelStyle}>Description</p>
                      <p style={infoValueStyle}>
                        {app.description || 'No description provided'}
                      </p>
                    </div>
                  </div>

                  <div style={cardActionsStyle}>
                    <button
                      style={primaryActionButtonStyle}
                      onClick={() => setSelectedApplication(app)}
                    >
                      View Details
                    </button>

                    {app.status === 'pending' && (
                      <button
                        style={dangerActionButtonStyle}
                        onClick={() => setWithdrawTargetId(app.id)}
                      >
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
          onWithdraw={() => setWithdrawTargetId(selectedApplication.id)}
        />
      )}

      {showApplyModal && jobId && (
        <ApplyJobModal
          jobId={jobId}
          onClose={async () => {
            setShowApplyModal(false)
            if (profile?.id) await loadApplications(profile.id)
          }}
        />
      )}

      {withdrawTargetId && (
        <div style={confirmOverlayStyle}>
          <div style={confirmModalStyle}>
            <h2 style={confirmTitleStyle}>Withdraw Application</h2>

            <p style={confirmTextStyle}>
              Are you sure you want to withdraw this application?
            </p>

            <div style={confirmActionsStyle}>
              <button
                onClick={() => setWithdrawTargetId(null)}
                disabled={withdrawing}
                style={confirmCancelButtonStyle}
              >
                Cancel
              </button>

              <button
                onClick={confirmWithdrawApplication}
                disabled={withdrawing}
                style={confirmWithdrawButtonStyle}
              >
                {withdrawing ? 'Withdrawing...' : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>
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
  background: '#1C1C1E',
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
  gap: 10,
  textDecoration: 'none',
  cursor: 'pointer',
}

const headerTitleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: '1.0625rem',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  color: '#FFFFFF',
}

const rightHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
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

const applicationsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
  gap: 24,
}

const applicationCardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #D1D5DB',
  borderRadius: 18,
  padding: 26,
  boxShadow: '0 8px 22px rgba(15,23,42,0.05)',
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  minHeight: 280,
}

const cardTopRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
}

const companyLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.78rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#F97316',
}

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: '1.25rem',
  fontWeight: 700,
  color: '#111827',
  lineHeight: 1.3,
}

const cardInfoStyle: React.CSSProperties = {
  display: 'grid',
  gap: 14,
}

const infoLabelStyle: React.CSSProperties = {
  margin: '0 0 4px',
  color: '#6B7280',
  fontSize: '0.85rem',
  fontWeight: 600,
}

const infoValueStyle: React.CSSProperties = {
  margin: 0,
  color: '#111827',
  fontSize: '0.9rem',
  fontWeight: 700,
  lineHeight: 1.5,
}

const statusBadgeBaseStyle: React.CSSProperties = {
  padding: '5px 11px',
  borderRadius: 999,
  fontSize: '0.75rem',
  fontWeight: 700,
  whiteSpace: 'nowrap',
}

const cardActionsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  marginTop: 'auto',
}

const primaryActionButtonStyle: React.CSSProperties = {
  border: 'none',
  background: '#F97316',
  color: '#FFFFFF',
  padding: '13px 14px',
  borderRadius: 10,
  fontSize: '0.85rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const dangerActionButtonStyle: React.CSSProperties = {
  border: '1px solid #FECACA',
  background: '#FEF2F2',
  color: '#DC2626',
  padding: '13px 14px',
  borderRadius: 10,
  fontSize: '0.85rem',
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

const confirmOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17,24,39,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: 24,
}

const confirmModalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 520,
  background: '#FFFFFF',
  borderRadius: 22,
  padding: 32,
  boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
}

const confirmTitleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: '1.5rem',
  fontWeight: 700,
  color: '#111827',
}

const confirmTextStyle: React.CSSProperties = {
  margin: '22px 0 32px',
  color: '#6B7280',
  fontSize: '1rem',
}

const confirmActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 14,
}

const confirmCancelButtonStyle: React.CSSProperties = {
  padding: '12px 20px',
  borderRadius: 10,
  border: '1px solid #D1D5DB',
  background: '#FFFFFF',
  color: '#374151',
  fontWeight: 700,
  cursor: 'pointer',
}

const confirmWithdrawButtonStyle: React.CSSProperties = {
  border: '1px solid #FECACA',
  background: '#FEF2F2',
  color: '#DC2626',
  padding: '12px 20px',
  borderRadius: 10,
  fontWeight: 700,
  cursor: 'pointer',
}