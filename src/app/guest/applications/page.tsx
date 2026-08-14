'use client'

import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, Check, CheckCircle2, Clock, Mail } from 'lucide-react'
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport'
import ApplyJobModal from '@/components/guest/ApplyJobModal'
import { JobCard, JobDetailPanel, JobView } from '@/components/jobs/JobPresentation'
import { FLOW_STEPS, FlowTone, getApplicationFlowState } from '@/components/guest/ApplicationFlow'
import { useResourceInvalidation } from '@/components/realtime/RealtimeNotificationsProvider'
import { modalLabelStyle } from '@/components/modal'
import { DASHBOARD_SKELETON_KEYFRAMES, SkeletonLine } from '@/components/dashboard/ClockFlow'
import { useLayoutWorkerProfile } from '@/app/guest/layout'
import type { ApplicantCertificateSnapshot } from '@/types/Recruitment'
import type { WorkerProfile } from '@/types/WorkerProfile'

// One icon per step, matching FLOW_STEPS' order (Pending Review / Accept-Reject Job Offer / Confirmed).
const STEP_ICONS = [Clock, Mail, CheckCircle2]

// Holds the "offer confirmed" banner message across reloads. Set here on Accept, read on mount,
// and cleared by signin/page.tsx on the worker's NEXT sign-in — see the confirmedBanner state below.
const CONFIRMED_BANNER_KEY = 'tasking_confirmed_banner'

const pageKeyframes = `
  @keyframes overlayFadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes modalSlideIn  { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
  @keyframes blockSlideUp  { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes fadeSlideUpToast { from { opacity: 0; transform: translateX(-50%) translateY(10px) } to { opacity: 1; transform: translateX(-50%) translateY(0) } }
  @keyframes cardStagger   { from { opacity: 0; transform: translateY(14px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
`

type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'cancelled_by_employer' | 'job_closed'

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
  resume?: string
  // Snapshotted at apply time (workerApplicationService.submitApplication) — must reflect what the
  // worker submitted THEN, not their current live profile (BUG-076: the applications page fetched
  // `resume` but dropped it — and never fetched skills/certificates at all — so a worker could never
  // see what they'd actually submitted for a past application). Named applicant_* to avoid colliding
  // with the job posting's own unrelated `skills` field below (the posting's required skills text).
  applicant_skills?: string | null
  applicant_certificates?: ApplicantCertificateSnapshot[] | null
  salary_amount?: number
  salary_type?: string
  responsibilities?: string
  skills?: string
  benefits?: string
  urgency?: string
  openings?: number
  job_end_date?: string
  job_date?: string
  job_start_time?: string
  job_end_time?: string
  break_start_time?: string
  break_end_time?: string
  estimated_hours?: string
  recurrence_interval?: number
  recurrence_unit?: string
  // Extra posting fields (now that the applications API joins the full posting + company/department)
  // so an applied job renders with the exact same JobCard / JobDetailPanel as the public board.
  created_at?: string
  expires_at?: string
  minimum_age?: number
  experience_required?: string
  uniform_type?: string
  uniform_details?: string
  job_type?: string
  department_name?: string
  company_location?: string
  company_address?: string
  company_size?: string
  company_industry?: string
  company_description?: string
  invitation_id?: string
  invitation_status?: InvitationStatus
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
    uniform_details: app.uniform_details,
    job_type: app.job_type,
    job_date: app.job_date,
    job_start_time: app.job_start_time,
    job_end_time: app.job_end_time,
    break_start_time: app.break_start_time,
    break_end_time: app.break_end_time,
    responsibilities: app.responsibilities,
    skills: app.skills,
  }
}

type RawApplication = {
  id: string
  status: ApplicationStatus
  applied_at: string
  decided_at?: string | null
  resume?: string
  skills?: string | null
  certificates?: ApplicantCertificateSnapshot[] | null
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
  // True phone width (isPhone implies isCompact, 640 < 1366): the 3-step pipeline can't be three
  // side-by-side columns here — it turns into one stacked column per step, with the arrows
  // pointing down instead of right, and the whole pipeline scrolls inside the page's fixed shell.
  const isPhone = useIsCompactViewport(640)
  // guest/layout.tsx already fetches the full WorkerProfile for its own role-guard check —
  // reuse it instead of this page redoing the same `/api/guest/profile` round trip a second
  // time right after the layout's own "Loading…" gate clears (2026-07-31).
  const layoutProfile = useLayoutWorkerProfile()
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [profile, setProfile] = useState<WorkerProfile | null>(layoutProfile)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [withdrawTargetId, setWithdrawTargetId] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Pill tab: applications still moving through the happy path vs. ones that ended off it.
  const [viewTab, setViewTab] = useState<'ongoing' | 'closed'>('ongoing')
  // Which terminal-outcome signatures the worker has already seen (BUG-032) — drives the dot on
  // the History pill itself instead of a generic sidebar notification with nowhere to point to.
  const [seenApplicationSignatures, setSeenApplicationSignatures] = useState<Set<string>>(new Set())
  // Confirming an offer promotes the account to Casual Worker behind the scenes, but the session
  // stays put — no forced sign-out. Unlike the toast (which fades in 3s), this sits next to the
  // Ongoing/History pills with no dismiss control — it stays through reloads (persisted in
  // localStorage, not just component state) until the worker's NEXT sign-in, which is when
  // signin/page.tsx clears CONFIRMED_BANNER_KEY.
  const [confirmedBanner, setConfirmedBanner] = useState<string | null>(null)
  useEffect(() => {
    setConfirmedBanner(localStorage.getItem(CONFIRMED_BANNER_KEY))
  }, [])

  const showToast = (msg: string, durationMs = 3000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(''), durationMs)
  }

  const lastLoadedAtRef = useRef(0)
  const loadApplications = async (userId: string) => {
    lastLoadedAtRef.current = Date.now()
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
          resume: app.resume,
          applicant_skills: app.skills,
          applicant_certificates: app.certificates,
          invitation_id: invite?.id,
          invitation_status: invite?.status,
          invitation_sent_at: invite?.sent_at ?? undefined,
          invitation_responded_at: invite?.responded_at ?? undefined,
        }
      })
    )
  }

  useResourceInvalidation(['applications'], () => {
    // Skip the realtime echo of our own just-completed accept/decline/withdraw (same fix as
    // BUG-060) — this fires ~250-500ms after a manual reload already ran for the same write.
    if (Date.now() - lastLoadedAtRef.current < 1500) return
    if (profile?.id) void loadApplications(profile.id)
  })

  // BUG-032: this used to only ever write the current signature set, immediately overwriting
  // itself on every load — it never read the previous set back for comparison, so it could never
  // actually detect "what changed since I last looked," and the History pill had no dot of its
  // own even though a stray notification showed up elsewhere (the sidebar's generic realtime
  // 'applications' dot, which isn't scoped to this specific tab). Read-before-write, and only
  // mark seen when the worker actually opens History (see viewTab click below) — a dot on the
  // pill itself is the one place that should show it. (hasUnseenHistory/markHistorySeen defined
  // below, after closedApplications.)
  useEffect(() => {
    if (!profile?.id || applications.length === 0) return
    let previous: string[] = []
    try { previous = JSON.parse(localStorage.getItem(`applications_seen_${profile.id}`) ?? '[]') } catch {}
    setSeenApplicationSignatures(new Set(previous))
  }, [applications, profile?.id])

  useEffect(() => {
    const loadPageData = async () => {
      try {
        setLoading(true)

        let currentProfile = layoutProfile
        if (!currentProfile) {
          // Fallback for the rare case the layout's own fetch hit its error path (transient
          // failure) — fetch directly instead of leaving the page stuck on skeletons forever.
          const authId = localStorage.getItem('tasking_user_id')
          if (!authId) {
            window.location.href = '/signin'
            return
          }
          const profileRes = await fetch(`/api/guest/profile?user_id=${authId}`)
          const profileData = await profileRes.json()
          if (!profileData.success) throw new Error(profileData.message || 'Failed to load profile')
          currentProfile = profileData.profile
        }

        setProfile(currentProfile)
        await loadApplications(currentProfile!.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load applications')
      } finally {
        setLoading(false)
      }
    }

    loadPageData()
  }, [layoutProfile])

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
        // BUG-033: this used to always claim the account was "confirmed" into a brand-new Casual
        // Worker workspace, even for someone already a Casual Worker confirming their 2nd/3rd job
        // — profile.role here still reflects the role BEFORE this confirmation (profile hasn't
        // been refetched yet), so it's the right check for "is this actually their first job."
        const isFirstEverConfirmation = profile?.role !== 'Casual Worker'
        const msg = isFirstEverConfirmation
          ? `"${app.job_title}" confirmed! Sign in again next time to access your Casual Worker workspace.`
          : `"${app.job_title}" confirmed!`
        if (isFirstEverConfirmation) {
          // Only the first-ever promotion needs a persistent (not fading) banner, since only then
          // does it stay relevant until the worker's next sign-in.
          localStorage.setItem(CONFIRMED_BANNER_KEY, msg)
          setConfirmedBanner(msg)
        } else {
          showToast(msg)
        }
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
    // getApplicationFlowState's fallback puts a status==='accepted' application with no real
    // invitation row into this same step 2 column ("the employer said yes, an offer is coming")
    // — normally momentary, but if the invitation row genuinely never gets created (a seed/data
    // gap, or the accept-then-invite write in recruitmentService.ts partially failing), this used
    // to be a silent dead end: sorted into "needs your action" with nothing actually clickable.
    // Say so instead of showing nothing (2026-07-31).
    if (app.status === 'accepted' && !app.invitation_id) {
      return (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9CA3AF', fontStyle: 'italic' }}>
          Offer being prepared — check back soon.
        </p>
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

  const currentApplicationSignatures = useMemo(
    () => new Map(applications.filter(app => app.status !== 'pending').map(app => [app.id, `${app.id}:${app.status}:${app.invitation_status ?? ''}:`])),
    [applications],
  )
  const hasUnseenHistory = useMemo(
    () => closedApplications.some(app => {
      const sig = currentApplicationSignatures.get(app.id)
      return sig !== undefined && !seenApplicationSignatures.has(sig)
    }),
    [closedApplications, currentApplicationSignatures, seenApplicationSignatures],
  )
  // Ongoing pill's dot: "you have an offer waiting on your response" — presence-based, not a
  // seen/unseen thing like History's dot. It lights up the moment a job lands in step 2
  // (Accept/Reject Job Offer) and clears itself the moment the worker actually accepts/declines,
  // since the job then moves out of step 2 — no separate seen-tracking needed (2026-07-31).
  const hasPendingOffer = (ongoingByStep[2]?.length ?? 0) > 0

  // Phone flips the pipeline from three side-by-side columns to one stacked column: the ROW
  // scrolls (instead of each panel scrolling inside a fixed-height column), and each panel sizes
  // to its own content — `flex: 1` there would resolve to a 0-height basis in a column and
  // collapse every panel to just its header.
  const stepsRow: React.CSSProperties = isPhone
    ? { ...stepsRowStyle, flexDirection: 'column', overflowY: 'auto', paddingBottom: 4 }
    : stepsRowStyle
  const stepPanel: React.CSSProperties = isPhone
    ? { ...stepPanelStyle, flex: '0 0 auto' }
    : stepPanelStyle
  const stepArrowSlot: React.CSSProperties = isPhone
    ? { width: '100%', height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }
    : stepArrowSlotStyle

  const markHistorySeen = () => {
    if (!profile?.id) return
    const signatures = [...currentApplicationSignatures.values()]
    try { localStorage.setItem(`applications_seen_${profile.id}`, JSON.stringify(signatures)) } catch {}
    setSeenApplicationSignatures(new Set(signatures))
  }

  return (
    <>
      <style>{pageKeyframes}</style>

      <main style={isPhone ? { ...pageStyle, height: '100%', padding: '12px 12px 12px' } : pageStyle}>
        {/* Page header — title left, matching the Owner pages */}
        <div style={{ marginBottom: isPhone ? 14 : 20, flexShrink: 0 }}>
          <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
            Applications
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12, marginBottom: isPhone ? 14 : 20, flexShrink: 0, flexWrap: 'wrap' }}>
          <div style={pillTabBarStyle}>
            {(['ongoing', 'closed'] as const).map(tab => {
              const active = viewTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setViewTab(tab); if (tab === 'closed') markHistorySeen() }}
                  style={{ ...pillTabButtonStyle, ...(active ? pillTabButtonActiveStyle : null), display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  {tab === 'ongoing' ? 'Ongoing' : 'History'}
                  {/* Same capsule-tab red-dot spec as Owner Communication's Chat/Announcements
                      pill tabs (CommunicationView.tsx tab.badge) — 10x10 with a border matching
                      the tab's own background, confirmed against a side-by-side screenshot
                      (2026-08-01). */}
                  {tab === 'ongoing' && hasPendingOffer && (
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: '#EF4444', flexShrink: 0, border: active ? '1.5px solid #111827' : '1.5px solid #fff' }} />
                  )}
                  {tab === 'closed' && hasUnseenHistory && (
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: '#EF4444', flexShrink: 0, border: active ? '1.5px solid #111827' : '1.5px solid #fff' }} />
                  )}
                </button>
              )
            })}
          </div>

          {confirmedBanner && (
            <div style={confirmedBannerStyle}>
              <CheckCircle2 size={16} style={{ color: '#15803D', flexShrink: 0 }} />
              <span style={confirmedBannerTextStyle}>{confirmedBanner}</span>
            </div>
          )}
        </div>

        {/* Keyed on loading too (not just viewTab): applications take an API round-trip to arrive,
            so a fresh, animated section must mount right when `loading` flips false — keying on
            viewTab alone would have this section (and its animation) already sitting on screen,
            fully settled, well before the real cards show up. */}
        <section key={loading ? 'loading' : viewTab} style={{ ...sectionStyle, animation: 'blockSlideUp 0.28s ease-out both' }}>
          {loading ? (
            <div style={stepsRow}>
              <style>{DASHBOARD_SKELETON_KEYFRAMES}</style>
              {FLOW_STEPS.map(label => (
                <div key={label} style={{ ...stepPanel, padding: 14, gap: 10 }}>
                  <SkeletonLine width="50%" height={14} />
                  <SkeletonLine height={70} radius={12} />
                  <SkeletonLine height={70} radius={12} />
                </div>
              ))}
            </div>
          ) : error ? (
            <div style={errorCardStyle}>{error}</div>
          ) : viewTab === 'ongoing' ? (
            // Each step IS a block — no separate stepper widget above them. A job's card lives
            // in whichever block matches its current step, so moving through the flow means
            // literally seeing the card move one block to the right.
            <div style={stepsRow}>
              {FLOW_STEPS.map((label, idx) => {
                const step = idx + 1
                const StepIcon = STEP_ICONS[idx]
                const cards = ongoingByStep[step] ?? []
                return (
                  <Fragment key={label}>
                    <div style={stepPanel}>
                      <div style={stepPanelHeaderStyle}>
                        <div style={stepIconBadgeStyle}>
                          <StepIcon size={15} style={{ color: '#F97316' }} />
                        </div>
                        <span style={stepPanelTitleStyle}>{label}</span>
                      </div>
                      {/* One card per row on compact laptops — two 140px-wide cards side by side
                          would be unreadable once the three panels split ~1070px between them. */}
                      <div style={{ ...stepPanelBodyStyle, gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', ...(isPhone ? { padding: 12, minHeight: 72 } : null) }}>
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
                      <div style={stepArrowSlot}>
                        <div style={stepArrowCircleStyle}>
                          {/* Stacked pipeline on phone — the flow reads top-to-bottom, so the
                              arrow points down. */}
                          <ArrowRight size={15} strokeWidth={2.5} style={isPhone ? { transform: 'rotate(90deg)' } : undefined} />
                        </div>
                      </div>
                    )}
                  </Fragment>
                )
              })}
            </div>
          ) : closedApplications.length === 0 ? null : (
            <div style={{ ...applicationsGridStyle, gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : isCompact ? 'repeat(3, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))' }}>
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
        <div style={isPhone ? { ...detailOverlayStyle, padding: 12 } : detailOverlayStyle} onClick={() => setSelectedApplication(null)}>
          <div style={{ width: isPhone ? '100%' : 'min(680px, calc(100% - 32px))' }} onClick={e => e.stopPropagation()}>
            <JobDetailPanel
              job={toJobView(selectedApplication)}
              onClose={() => setSelectedApplication(null)}
              variant="modal"
              // What was actually submitted with this application — a frozen snapshot from apply
              // time (workerApplicationService.submitApplication), not the worker's current live
              // profile. Rendered as a section inside the same panel (after Company Profile) so
              // it scrolls together with the rest of the job detail instead of sitting as its own
              // floating block below the modal.
              afterCompanyProfile={
                (selectedApplication.resume || selectedApplication.applicant_skills || (selectedApplication.applicant_certificates?.length ?? 0) > 0) ? (
                  <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                    <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Submitted With This Application</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {selectedApplication.applicant_skills && (
                        <div>
                          <p style={{ margin: '0 0 4px', fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Skills</p>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: '#111827', lineHeight: 1.5 }}>{selectedApplication.applicant_skills}</p>
                        </div>
                      )}
                      {(selectedApplication.applicant_certificates?.length ?? 0) > 0 && (
                        <div>
                          <p style={{ margin: '0 0 4px', fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Certificates</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {selectedApplication.applicant_certificates!.map((c, i) => (
                              c.file_url
                                ? <a key={i} href={c.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.9rem', color: '#EA580C', textDecoration: 'underline' }}>{c.name}</a>
                                : <p key={i} style={{ margin: 0, fontSize: '0.9rem', color: '#111827' }}>{c.name}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedApplication.resume && (
                        <div>
                          <p style={{ margin: '0 0 4px', fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Resume</p>
                          <a href={selectedApplication.resume} target="_blank" rel="noreferrer" style={{ fontSize: '0.9rem', color: '#EA580C', textDecoration: 'underline' }}>View Resume</a>
                        </div>
                      )}
                    </div>
                  </div>
                ) : undefined
              }
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
          // Phone: clear the 64px bottom tab bar instead of sitting on top of it.
          position: 'fixed', bottom: isPhone ? 76 : 28, left: '50%', transform: 'translateX(-50%)',
          background: '#0F172A', color: '#FFFFFF', borderRadius: 14, padding: '10px 18px',
          display: 'flex', alignItems: 'flex-start', gap: 8,
          fontSize: 13, fontWeight: 600, whiteSpace: 'normal', maxWidth: isPhone ? 'calc(100vw - 32px)' : 420, textAlign: 'left',
          zIndex: 9999,
          animation: 'fadeSlideUpToast 0.22s ease',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          <Check size={15} style={{ color: '#10B981', flexShrink: 0, marginTop: 1 }} />
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
// `height` matters for the Casual Worker's copy of this page (src/app/casual/applications), whose
// layout renders a plain block <main> rather than a flex column — without it, `flex: 1` has nothing
// to grow against there and every step panel collapses to its header.
const pageStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  height: '100vh',
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

// Sits beside the pill tab bar after a Guest confirms an offer — no dismiss control, sized to its
// own content (not stretched across the row), and persisted through reloads (see
// CONFIRMED_BANNER_KEY) until the worker's next sign-in clears it.
const confirmedBannerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  height: 36,
  padding: '0 16px 0 14px',
  borderRadius: 999,
  background: '#F0FDF4',
  border: '1px solid #BBF7D0',
  color: '#166534',
  fontSize: 12.5,
  fontWeight: 600,
  maxWidth: '100%',
}

const confirmedBannerTextStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
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
