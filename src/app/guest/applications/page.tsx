'use client'

import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { ArrowRight, Check, CheckCircle2, Clock, Mail } from 'lucide-react'
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport'
import ApplyJobModal from '@/components/guest/ApplyJobModal'
import { JobCard, JobDetailPanel, JobView } from '@/components/jobs/JobPresentation'
import { FLOW_STEPS, FlowTone, getApplicationFlowState } from '@/components/guest/ApplicationFlow'

// One icon per step, matching FLOW_STEPS' order (Pending Review / Accept-Reject Job Offer / Confirmed).
const STEP_ICONS = [Clock, Mail, CheckCircle2]

const pageKeyframes = `
  @keyframes overlayFadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes modalSlideIn  { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
  @keyframes blockSlideUp  { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes fadeSlideUpToast { from { opacity: 0; transform: translateX(-50%) translateY(10px) } to { opacity: 1; transform: translateX(-50%) translateY(0) } }
  @keyframes cardStagger   { from { opacity: 0; transform: translateY(14px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
`

type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'cancelled_by_employer' | 'job_closed'

type Profile = {
  id: string
  full_name: string
  email_address: string
  phone_number: string | null
  date_of_birth: string | null
  profile_photo_url: string | null
  role: string
}

type InvitationStatus = 'sent' | 'accepted' | 'declined' | 'expired' | 'position_filled' | 'cancelled'

type Application = {
  id: string
  job_title: string
  company_name: string
  industry?: string
  status: ApplicationStatus
  // Raw ISO timestamps driving the card's timeline.
  applied_at: string
  decided_at?: string
  invitation_sent_at?: string
  invitation_responded_at?: string
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
  // Extra posting fields (now that the applications API joins the full posting + company/department)
  // so an applied job renders with the exact same JobCard / JobDetailPanel as the public board.
  created_at?: string
  expires_at?: string
  minimum_age?: number
  experience_required?: string
  uniform_type?: string
  uniform_required?: boolean
  uniform_details?: string
  form_type?: string
  job_start_time?: string
  department_name?: string
  company_location?: string
  company_address?: string
  company_size?: string
  company_industry?: string
  company_description?: string
  invitation_id?: string
  invitation_status?: InvitationStatus
  invitation_message?: string
}

// Adapt an application row to the shared JobView the board's JobCard / JobDetailPanel render from.
function toJobView(app: Application): JobView {
  return {
    id: app.id,
    title: app.job_title,
    company_name: app.company_name,
    company_location: app.company_location,
    company_address: app.company_address,
    company_size: app.company_size,
    company_industry: app.company_industry,
    company_description: app.company_description,
    department_name: app.department_name,
    salary_amount: app.salary_amount,
    estimated_hours: app.estimated_hours,
    expires_at: app.expires_at,
    created_at: app.created_at,
    urgency: app.urgency,
    minimum_age: app.minimum_age,
    experience_required: app.experience_required,
    uniform_type: app.uniform_type,
    uniform_required: app.uniform_required,
    uniform_details: app.uniform_details,
    form_type: app.form_type,
    is_recurring: app.is_recurring,
    shift_date: app.shift_date,
    shift_start_time: app.shift_start_time,
    shift_end_time: app.shift_end_time,
    break_start_time: app.break_start_time,
    break_end_time: app.break_end_time,
    job_start_time: app.job_start_time,
    description: app.description,
    requirements: app.requirements,
  }
}

type RawApplication = {
  id: string
  status: ApplicationStatus
  applied_at: string
  decided_at?: string | null
  resume_url?: string
  cover_letter?: string
  job_postings?: (Partial<Application> & { title?: string }) | null
  job_invitations?: {
    id: string
    status: InvitationStatus
    message: string | null
    sent_at?: string | null
    responded_at?: string | null
  }[] | null
}

function ApplicationsContent() {
  const searchParams = useSearchParams()
  const isCompact = useIsCompactViewport(1366)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [withdrawTargetId, setWithdrawTargetId] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Pill tab: applications still moving through the happy path vs. ones that ended off it.
  const [viewTab, setViewTab] = useState<'ongoing' | 'closed'>('ongoing')
  // After confirming an offer the account becomes a Casual Worker, so the Guest pages stop being
  // theirs. Rather than silently swap the UI out from under them on their next click, we hold a
  // short countdown → sign out, and tell them to log back in as a Casual Worker.
  const [confirmedJobTitle, setConfirmedJobTitle] = useState<string | null>(null)
  const [signOutCountdown, setSignOutCountdown] = useState(30)

  const signOutToReauth = () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    void supabase.auth.signOut().finally(() => {
      localStorage.removeItem('tasking_user_id')
      localStorage.removeItem('tasking_user_role')
      localStorage.removeItem('tasking_company_id')
      localStorage.removeItem('tasking_active_session')
      localStorage.removeItem('apply_job_id')
      sessionStorage.removeItem('tasking_session_active')
      window.location.href = '/signout'
    })
  }

  // Tick the post-confirmation countdown down to 0, then sign out automatically.
  useEffect(() => {
    if (confirmedJobTitle === null) return
    if (signOutCountdown <= 0) {
      signOutToReauth()
      return
    }
    const t = setTimeout(() => setSignOutCountdown(n => n - 1), 1000)
    return () => clearTimeout(t)
  }, [confirmedJobTitle, signOutCountdown])

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(''), 3000)
  }

  const loadApplications = async (userId: string) => {
    const res = await fetch(`/api/guest/applications?user_id=${userId}`)
    const data = await res.json()

    if (!data.success) {
      throw new Error(data.message || 'Failed to load applications')
    }

    setApplications(
      data.applications.map((app: RawApplication) => {
        const invite = Array.isArray(app.job_invitations) ? app.job_invitations[0] : null
        // Spread the posting FIRST — it now carries the full job_postings row, whose own
        // id/status ('open') must never overwrite the application's id/status.
        return {
          ...app.job_postings,
          id: app.id,
          job_title:
            app.job_postings?.job_title ||
            app.job_postings?.title ||
            'Job Opening',
          company_name: app.job_postings?.company_name || 'Company',
          status: app.status,
          // Raw ISO — the timeline formats these at render time (date AND time; the old
          // formatDate dropped the clock, which is exactly what the tracker needs to show).
          applied_at: app.applied_at,
          decided_at: app.decided_at ?? undefined,
          resume_url: app.resume_url,
          cover_letter: app.cover_letter,
          invitation_id: invite?.id,
          invitation_status: invite?.status,
          invitation_message: invite?.message ?? undefined,
          invitation_sent_at: invite?.sent_at ?? undefined,
          invitation_responded_at: invite?.responded_at ?? undefined,
        }
      })
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
    const selectedJobId = searchParams.get('job_id') || localStorage.getItem('apply_job_id')

    if (selectedJobId) {
      setJobId(selectedJobId)
      setShowApplyModal(true)
      // Consume the stashed intent the moment it's acted on. ApplyJobModal only clears it on a
      // successful submit, so without this, dismissing the modal would leave it behind and it'd
      // pop open again on every later visit.
      localStorage.removeItem('apply_job_id')
    }
  }, [searchParams])

  const confirmWithdrawApplication = async () => {
    if (!withdrawTargetId) return
    try {
      setWithdrawing(true)
      const res = await fetch(`/api/guest/applications/${withdrawTargetId}/withdraw`, { method: 'PATCH' })
      const data = await res.json()
      if (!data.success) {
        showToast(data.message || 'Failed to withdraw application.')
        return
      }
      if (profile?.id) await loadApplications(profile.id)
      setWithdrawTargetId(null)
      showToast('Application withdrawn.')
    } finally {
      setWithdrawing(false)
    }
  }

  const respondToInvitation = async (app: Application, response: 'accepted' | 'declined') => {
    setRespondingId(app.id)
    try {
      const res = await fetch(`/api/guest/applications/${app.id}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: app.invitation_id, response }),
      })
      const data = await res.json()
      if (!data.success) {
        showToast(data.message || 'Failed to respond to invitation.')
        return
      }
      if (profile?.id) await loadApplications(profile.id)

      if (response === 'accepted') {
        // Confirming promoted the account to Casual Worker — hand off with an explicit countdown
        // instead of letting the next click silently change the whole page.
        setSignOutCountdown(30)
        setConfirmedJobTitle(app.job_title)
      } else {
        showToast('Invitation declined.')
      }
    } finally {
      setRespondingId(null)
    }
  }

  // The action buttons a card carries in its footer — Accept/Decline for an offer awaiting the
  // worker, Withdraw for a pending application. Rendered ON the card (like the Job Board's own
  // actions), not tucked inside the detail modal. stopPropagation so a button press doesn't also
  // open the card's detail view.
  const renderCardActions = (app: Application): React.ReactNode => {
    if (app.invitation_id && app.invitation_status === 'sent') {
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...detailActionButtonStyle, background: '#059669' }} disabled={respondingId === app.id}
            onClick={(e) => { e.stopPropagation(); respondToInvitation(app, 'accepted') }}>
            {respondingId === app.id ? 'Responding…' : 'Accept Offer'}
          </button>
          <button style={detailDangerButtonStyle} disabled={respondingId === app.id}
            onClick={(e) => { e.stopPropagation(); respondToInvitation(app, 'declined') }}>
            Decline
          </button>
        </div>
      )
    }
    if (app.status === 'pending' && !app.invitation_id) {
      return (
        <button style={withdrawButtonStyle} onClick={(e) => { e.stopPropagation(); setWithdrawTargetId(app.id) }}>
          Withdraw Application
        </button>
      )
    }
    return null
  }

  // Split into the two pill tabs: applications still moving through the 3-step happy path
  // ("Ongoing") vs. every terminal outcome ("History") — whether the worker walked away
  // (withdrew, declined an offer) or the employer/system ended it (rejected, removed after
  // confirming, position filled, job closed, offer expired).
  //
  // Ongoing ones are further grouped by step (1 = Pending Review, 2 = Accept/Reject Job Offer,
  // 3 = Confirmed) so each step renders as its own column — the column IS the step indicator,
  // there's no separate stepper widget above them.
  const ongoingByStep = useMemo(() => {
    const groups: Record<number, Application[]> = { 1: [], 2: [], 3: [] }
    for (const app of applications) {
      const state = getApplicationFlowState(app)
      if (state.kind === 'stepper') groups[state.step]?.push(app)
    }
    return groups
  }, [applications])
  const closedApplications = useMemo(
    () => applications.filter(app => getApplicationFlowState(app).kind === 'terminal'),
    [applications]
  )

  return (
    <>
      <style>{pageKeyframes}</style>

      <main style={pageStyle}>
        {/* Page header — title left, matching the Owner pages */}
        <div style={{ marginBottom: 20, flexShrink: 0 }}>
          <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
            Applications
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 20, flexShrink: 0 }}>
          <div style={pillTabBarStyle}>
            {(['ongoing', 'closed'] as const).map(tab => {
              const active = viewTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setViewTab(tab)}
                  style={{ ...pillTabButtonStyle, ...(active ? pillTabButtonActiveStyle : null) }}
                >
                  {tab === 'ongoing' ? 'Ongoing' : 'History'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Keyed on loading too (not just viewTab): applications take an API round-trip to arrive,
            so a fresh, animated section must mount right when `loading` flips false — keying on
            viewTab alone would have this section (and its animation) already sitting on screen,
            fully settled, well before the real cards show up. */}
        <section key={loading ? 'loading' : viewTab} style={{ ...sectionStyle, animation: 'blockSlideUp 0.28s ease-out both' }}>
          {loading ? (
            <div style={emptyCardStyle}>Loading applications...</div>
          ) : error ? (
            <div style={errorCardStyle}>{error}</div>
          ) : viewTab === 'ongoing' ? (
            // Each step IS a block — no separate stepper widget above them. A job's card lives
            // in whichever block matches its current step, so moving through the flow means
            // literally seeing the card move one block to the right.
            <div style={stepsRowStyle}>
              {FLOW_STEPS.map((label, idx) => {
                const step = idx + 1
                const StepIcon = STEP_ICONS[idx]
                const cards = ongoingByStep[step] ?? []
                return (
                  <Fragment key={label}>
                    <div style={stepPanelStyle}>
                      <div style={stepPanelHeaderStyle}>
                        <div style={stepIconBadgeStyle}>
                          <StepIcon size={15} style={{ color: '#F97316' }} />
                        </div>
                        <span style={stepPanelTitleStyle}>{label}</span>
                      </div>
                      {/* One card per row on compact laptops — two 140px-wide cards side by side
                          would be unreadable once the three panels split ~1070px between them. */}
                      <div style={{ ...stepPanelBodyStyle, gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))' }}>
                        {cards.map(app => (
                          <JobCard
                            key={app.id}
                            job={toJobView(app)}
                            onClick={() => setSelectedApplication(app)}
                            // Details open by clicking the card itself; the footer carries the
                            // step's action inline (Accept/Decline an offer, or Withdraw a pending
                            // application) instead of hiding it behind the detail modal.
                            footer={
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <CardTimeline app={app} />
                                {renderCardActions(app)}
                              </div>
                            }
                          />
                        ))}
                      </div>
                    </div>
                    {step < FLOW_STEPS.length && (
                      <div style={stepArrowSlotStyle}>
                        <div style={stepArrowCircleStyle}>
                          <ArrowRight size={15} strokeWidth={2.5} />
                        </div>
                      </div>
                    )}
                  </Fragment>
                )
              })}
            </div>
          ) : closedApplications.length === 0 ? null : (
            <div style={{ ...applicationsGridStyle, gridTemplateColumns: isCompact ? 'repeat(3, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))' }}>
              {closedApplications.map((app) => {
                const state = getApplicationFlowState(app)
                return (
                  <JobCard
                    key={app.id}
                    job={toJobView(app)}
                    onClick={() => setSelectedApplication(app)}
                    // The deadline is irrelevant on a finished application — hide it so every
                    // History card leads with its requirement badges, then the title.
                    hideDeadline
                    // Why this application ended — "Withdrawn" (self), "Application Unsuccessful"
                    // (employer rejected), "Cancelled by Employer", etc.
                    statusBadge={
                      state.kind === 'terminal' ? (
                        <span style={{ ...historyBadgeBaseStyle, ...historyBadgeToneStyles[state.tone] }}>
                          {state.title}
                        </span>
                      ) : undefined
                    }
                    footer={<CardTimeline app={app} />}
                  />
                )
              })}
            </div>
          )}
        </section>
      </main>

      {selectedApplication && (
        <div style={detailOverlayStyle} onClick={() => setSelectedApplication(null)}>
          <div style={{ width: 'min(680px, calc(100% - 32px))' }} onClick={e => e.stopPropagation()}>
            <JobDetailPanel
              job={toJobView(selectedApplication)}
              onClose={() => setSelectedApplication(null)}
              variant="modal"
            />
          </div>
        </div>
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

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#0F172A', color: '#FFFFFF', borderRadius: 999, padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', zIndex: 9999,
          animation: 'fadeSlideUpToast 0.22s ease',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          <Check size={15} style={{ color: '#10B981', flexShrink: 0 }} />
          {toast}
        </div>
      )}

      {/* Withdraw confirmation — destructive, so it never fires straight off the card button. */}
      {withdrawTargetId && (
        <div style={confirmOverlayStyle}>
          <div style={confirmModalStyle}>
            <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Withdraw Application</h2>
            </div>
            <div style={{ padding: '18px 24px 20px' }}>
              <p style={{ margin: '0 0 20px', color: '#6B7280', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                Are you sure you want to withdraw this application?
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  onClick={() => setWithdrawTargetId(null)}
                  disabled={withdrawing}
                  style={{ padding: '7px 18px', borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', color: '#6B7280', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmWithdrawApplication}
                  disabled={withdrawing}
                  style={{ padding: '7px 18px', borderRadius: 8, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }}
                >
                  {withdrawing ? 'Withdrawing…' : 'Withdraw'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post-confirmation hand-off — the account just became a Casual Worker, so this explains
          the sign-out and lets the countdown (or the button) carry them there deliberately. */}
      {confirmedJobTitle !== null && (
        <div style={confirmOverlayStyle}>
          <div style={{ ...confirmModalStyle, maxWidth: 440 }}>
            <div style={{ padding: '32px 28px 28px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: 999, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle2 size={28} style={{ color: '#15803D' }} />
              </div>
              <h2 style={{ margin: '0 0 10px', fontSize: '1.125rem', fontWeight: 800, color: '#111827' }}>
                You&apos;re all set!
              </h2>
              <p style={{ margin: '0 0 4px', fontSize: '0.9375rem', color: '#374151', lineHeight: 1.6 }}>
                You&apos;ve accepted the offer for <strong>{confirmedJobTitle}</strong>.
              </p>
              <p style={{ margin: '0 0 16px', fontSize: '0.9375rem', color: '#374151', lineHeight: 1.6 }}>
                Your Casual Worker account is now ready.
              </p>
              <p style={{ margin: '0 0 6px', fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6 }}>
                You&apos;ll be signed out automatically in <strong style={{ color: '#EA580C' }}>{signOutCountdown} seconds</strong>.
              </p>
              <p style={{ margin: '0 0 22px', fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6 }}>
                Sign in again to access your Casual Worker workspace.
              </p>
              <button
                onClick={signOutToReauth}
                style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFFFFF', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }}
              >
                Sign out now
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

// "14 Jul 2026, 2:49 PM" — the tracker is about WHEN each step happened, so the clock matters,
// not just the date.
function formatTimestamp(iso?: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('en-SG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

// The steps this application actually went through, in order. Only moments that really happened
// are listed — a pending application shows one line, a confirmed one shows three.
function timelineFor(app: Application): { label: string; at: string }[] {
  const steps: { label: string; at?: string | null }[] = [
    { label: 'Applied', at: app.applied_at },
    // The offer going out IS the employer's acceptance — same moment, so one line covers both.
    { label: 'Offer received', at: app.invitation_sent_at },
  ]

  if (app.invitation_status === 'accepted') {
    steps.push({ label: 'Confirmed', at: app.invitation_responded_at })
  } else if (app.invitation_status === 'position_filled') {
    // Lost the first-come-first-served race — the moment the last opening went to someone else.
    steps.push({ label: 'Not selected', at: app.invitation_responded_at })
  } else if (app.status === 'rejected' || app.status === 'job_closed') {
    steps.push({ label: 'Not selected', at: app.decided_at })
  }

  return steps.filter((s): s is { label: string; at: string } => !!s.at)
}

function CardTimeline({ app }: { app: Application }) {
  const steps = timelineFor(app)
  if (steps.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 2 }}>
      {steps.map(step => (
        <div key={step.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.72rem', lineHeight: 1.5 }}>
          <span style={{ color: '#6B7280', fontWeight: 600, flexShrink: 0 }}>{step.label}</span>
          <span style={{ color: '#374151', textAlign: 'right' }}>{formatTimestamp(step.at)}</span>
        </div>
      ))}
    </div>
  )
}

// No fontFamily override here — Owner pages don't set one either, so this page inherits the
// same ambient system font as the rest of the app instead of forcing Inter over it (that's what
// was making this page's pill tabs render in a visibly different typeface than Owner's).
// The guest layout's <main> is locked to one viewport (100vh, overflow hidden) — this page fills
// it as a flex column; header/tabs stay fixed and the section below scrolls internally.
const pageStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  padding: '20px 28px 28px',
}

const sectionStyle: React.CSSProperties = {
  width: '100%',
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

// 4 columns on desktop (3 below the compact breakpoint — set at render). The grid is the History
// tab's scroll container: the page itself never scrolls, this block does. maxWidth caps how wide
// the cards get on an ultra-wide screen; below that they shrink together.
const applicationsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 16,
  maxWidth: 1800,
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  alignContent: 'start',
}

// The Ongoing tab's 3-block pipeline — one panel per step (Pending Review / Accept-Reject Job
// Offer / Confirmed) with a circular arrow between them. Like the Owner Task page's Kanban, the
// three panels stretch edge-to-edge across the page (equal flex columns), each wide enough to
// fit two job cards per row.
// The row fills the section's remaining height — all three step panels share that one height
// (same full-height column look as the Owner Task page's Kanban).
const stepsRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  width: '100%',
  flex: 1,
  minHeight: 0,
  paddingBottom: 8,
}

// Each panel is bounded by the row's height — past that the card list scrolls inside the panel
// instead of growing it (the page itself never scrolls).
const stepPanelStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  background: '#FFFFFF',
  border: '1.5px solid #E5E7EB',
  borderRadius: 14,
  overflow: 'hidden',
}

const stepPanelHeaderStyle: React.CSSProperties = {
  height: 56,
  padding: '0 18px',
  boxSizing: 'border-box',
  borderBottom: '1px solid #E5E7EB',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const stepIconBadgeStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 9,
  background: '#FFF7ED',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const stepPanelTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: '#0F172A',
  letterSpacing: '-0.1px',
  lineHeight: 1.2,
}

// Two cards per row inside each step block. minHeight keeps an empty block from collapsing to
// just its header; overflowY scrolls the list once it hits the panel's viewport-height cap
// (minHeight: 0 lets the flex child actually shrink so that scroll can kick in).
const stepPanelBodyStyle: React.CSSProperties = {
  flex: '1 1 auto',
  minHeight: 96,
  overflowY: 'auto',
  padding: 16,
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  alignContent: 'start',
  gap: 12,
}

const stepArrowSlotStyle: React.CSSProperties = {
  width: 48,
  flexShrink: 0,
  display: 'flex',
  justifyContent: 'center',
  paddingTop: 28,
}

const stepArrowCircleStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #F97316, #EA580C)',
  color: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 6px rgba(249,115,22,0.35)',
}

// Pill tab bar switching between Ongoing and History applications — same rounded
// "pill container + dark active segment" language as the Owner Team page's tab switcher.
const pillTabBarStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: 4,
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 999,
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
}

const pillTabButtonStyle: React.CSSProperties = {
  height: 36,
  padding: '0 18px',
  borderRadius: 999,
  border: 'none',
  background: 'transparent',
  color: '#64748B',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'background 0.18s ease, color 0.18s ease',
}

const pillTabButtonActiveStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, #0F172A 0%, #111827 100%)',
  color: '#FFFFFF',
  boxShadow: '0 6px 18px rgba(15,23,42,0.18)',
}

// Full-width "Withdraw Application" action on the JobCard footer (details open by clicking the
// card itself).
const withdrawButtonStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #FECACA',
  background: '#FEF2F2',
  color: '#DC2626',
  padding: '11px 14px',
  borderRadius: 10,
  fontSize: '0.85rem',
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: 4,
}

// Outcome badge on History cards — colored by how the application ended.
const historyBadgeBaseStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: '0.72rem',
  fontWeight: 700,
  whiteSpace: 'nowrap',
}

const historyBadgeToneStyles: Record<FlowTone, React.CSSProperties> = {
  success: { background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D' },
  danger: { background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' },
  warning: { background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' },
  neutral: { background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280' },
}

// Withdraw confirmation dialog chrome.
const confirmOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.45)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: 24,
  animation: 'overlayFadeIn 0.18s ease-out',
}

const confirmModalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
  background: '#FFFFFF',
  borderRadius: 20,
  overflow: 'hidden',
  boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)',
  animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)',
}

// Detail-panel action buttons (Accept / Decline / Withdraw), sitting where "Apply Now" would be.
const detailActionButtonStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  background: '#F97316',
  color: '#FFFFFF',
  padding: '10px 16px',
  borderRadius: 10,
  fontSize: '0.85rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const detailDangerButtonStyle: React.CSSProperties = {
  flex: 1,
  border: '1px solid #FECACA',
  background: '#FEF2F2',
  color: '#DC2626',
  padding: '10px 16px',
  borderRadius: 10,
  fontSize: '0.85rem',
  fontWeight: 700,
  cursor: 'pointer',
}

// Overlay wrapping the shared JobDetailPanel when opened from the Applications page.
const detailOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.45)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: 24,
  animation: 'overlayFadeIn 0.18s ease-out',
}

const emptyCardStyle: React.CSSProperties = {
  padding: '42px 28px',
  textAlign: 'center',
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

