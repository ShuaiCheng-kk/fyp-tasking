'use client'

// Casual Worker Job History — absorbs the Guest User's application-tracking view (Guest is only
// a transitional role: once both sides confirm a job, the account becomes a Casual Worker, but
// they keep applying to new jobs). Shows applications still awaiting a company response, offers
// waiting for the worker's confirmation (accept/decline here), and resolved past applications.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, User } from 'lucide-react'
import CasualSidebar from '@/components/CasualSidebar'

type InvitationStatus = 'sent' | 'accepted' | 'declined' | 'expired' | 'position_filled' | 'cancelled'
type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'cancelled_by_employer' | 'job_closed'

type Application = {
  id: string
  job_title: string
  company_name: string
  status: ApplicationStatus
  applied_at: string
  invitation_id?: string
  invitation_status?: InvitationStatus
  invitation_message?: string
}

type RawApplication = {
  id: string
  status: ApplicationStatus
  applied_at: string
  job_postings?: { title?: string; company_name?: string } | null
  job_invitations?: { id: string; status: InvitationStatus; message: string | null }[] | null
}

const pageKeyframes = `
  @keyframes blockSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes fadeSlideUpToast { from { opacity: 0; transform: translateX(-50%) translateY(10px) } to { opacity: 1; transform: translateX(-50%) translateY(0) } }
`

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function statusChip(status: ApplicationStatus): { label: string; style: React.CSSProperties } {
  const base: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, borderRadius: 999, padding: '3px 11px', whiteSpace: 'nowrap' }
  switch (status) {
    case 'pending': return { label: 'Pending', style: { ...base, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' } }
    case 'accepted': return { label: 'Accepted', style: { ...base, background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0' } }
    case 'rejected': return { label: 'Rejected', style: { ...base, background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA' } }
    case 'withdrawn': return { label: 'Withdrawn', style: { ...base, background: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB' } }
    case 'cancelled_by_employer': return { label: 'Cancelled by Employer', style: { ...base, background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA' } }
    case 'job_closed': return { label: 'Job Closed', style: { ...base, background: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB' } }
  }
}

export default function CasualJobHistoryPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(''), 3000)
  }

  const loadApplications = useCallback(async (userId: string) => {
    const res = await fetch(`/api/guest/applications?user_id=${userId}`)
    const data = await res.json()
    if (!data.success) return
    setApplications((data.applications as RawApplication[]).map(app => {
      const invite = Array.isArray(app.job_invitations) ? app.job_invitations[0] : null
      return {
        id: app.id,
        job_title: app.job_postings?.title || 'Job Opening',
        company_name: app.job_postings?.company_name || 'Company',
        status: app.status,
        applied_at: formatDate(app.applied_at),
        invitation_id: invite?.id,
        invitation_status: invite?.status,
        invitation_message: invite?.message ?? undefined,
      }
    }))
  }, [])

  useEffect(() => {
    const run = async () => {
      const userId = localStorage.getItem('tasking_user_id')
      if (!userId) { router.replace('/signin'); return }

      const historyRes = await fetch(`/api/casual/job-history?user_id=${userId}`)
      const historyData = await historyRes.json()
      if (!historyData.success) { router.replace('/signin'); return }

      setUserName(historyData.jobHistory.user.full_name ?? 'Casual Worker')
      await loadApplications(userId)
      setLoading(false)
    }
    void run()
  }, [router, loadApplications])

  const respond = async (applicationId: string, invitationId: string, response: 'accepted' | 'declined') => {
    setRespondingId(applicationId)
    try {
      const res = await fetch(`/api/guest/applications/${applicationId}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invitationId, response }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to respond')
      const userId = localStorage.getItem('tasking_user_id')
      if (userId) await loadApplications(userId)
      showToast(response === 'accepted' ? 'Offer confirmed — see it on your dashboard.' : 'Offer declined.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to respond')
    } finally {
      setRespondingId(null)
    }
  }

  // An offer waiting for the worker to confirm.
  const offers = applications.filter(a => a.invitation_id && a.invitation_status === 'sent')
  // Submitted, still waiting on the employer's decision.
  const awaiting = applications.filter(a => a.status === 'pending' && !(a.invitation_id && a.invitation_status === 'sent'))
  // Everything resolved.
  const resolved = applications.filter(a => !offers.includes(a) && !awaiting.includes(a))

  const Section = ({ title, items }: { title: string; items: Application[] }) => (
    <div style={{ marginBottom: 26 }}>
      <p style={sectionLabel}>{title} <span style={{ color: '#9CA3AF' }}>({items.length})</span></p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(app => {
          const chip = statusChip(app.status)
          return (
            <div key={app.id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{app.job_title}</p>
                  <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: '#6B7280', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Building2 size={13} /> {app.company_name}
                  </p>
                </div>
                <span style={chip.style}>{chip.label}</span>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#9CA3AF' }}>Applied {app.applied_at}</p>

              {app.invitation_id && app.invitation_status === 'sent' && (
                <>
                  <div style={{ marginTop: 10, padding: '8px 12px', background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE', fontSize: '0.8125rem', color: '#1D4ED8', fontWeight: 600 }}>
                    You&apos;ve been offered this job — accept to confirm your spot (first-come-first-served).
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => respond(app.id, app.invitation_id!, 'accepted')} disabled={respondingId === app.id}
                      style={{ flex: 1, border: 'none', borderRadius: 8, background: '#059669', color: '#FFFFFF', padding: '8px 0', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                      {respondingId === app.id ? 'Working…' : 'Accept Offer'}
                    </button>
                    <button onClick={() => respond(app.id, app.invitation_id!, 'declined')} disabled={respondingId === app.id}
                      style={{ flex: 1, border: '1.5px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', color: '#6B7280', padding: '8px 0', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                      Decline
                    </button>
                  </div>
                </>
              )}
              {app.invitation_status === 'position_filled' && (
                <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#92400E', fontWeight: 600 }}>Position filled — another worker confirmed first.</p>
              )}
              {app.invitation_status === 'expired' && (
                <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#6B7280', fontWeight: 600 }}>This offer expired — the shift already started.</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div style={pageStyle}>
      <style>{pageKeyframes}</style>
      <CasualSidebar />

      <main style={mainStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Job History</h1>
          {!loading && (
            <div style={userBadgeStyle}>
              <span style={userIconStyle}><User size={14} strokeWidth={2.2} /></span>
              <span>{userName}</span>
            </div>
          )}
        </div>

        {!loading && (
          applications.length === 0 ? (
            <p style={emptyTextStyle}>You haven&apos;t applied to any jobs yet. Browse the job board to get started.</p>
          ) : (
            <div style={{ maxWidth: 640, animation: 'blockSlideUp 0.38s ease both 0.06s' }}>
              {offers.length > 0 && <Section title="Offers to Confirm" items={offers} />}
              {awaiting.length > 0 && <Section title="Awaiting Company Response" items={awaiting} />}
              {resolved.length > 0 && <Section title="Past Applications" items={resolved} />}
            </div>
          )
        )}
      </main>

      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#0F172A', color: '#FFFFFF', borderRadius: 999, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', zIndex: 9999, animation: 'fadeSlideUpToast 0.22s ease', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
          <Check size={15} style={{ color: '#10B981', flexShrink: 0 }} /> {toast}
        </div>
      )}
    </div>
  )
}

const pageStyle: React.CSSProperties = { display: 'flex', minHeight: '100vh', background: '#F3F4F6', fontFamily: 'var(--font-body)' }
const mainStyle: React.CSSProperties = { marginLeft: '64px', flex: 1, minHeight: '100vh', padding: '24px 32px' }
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '22px', borderBottom: '1px solid #E5E7EB', marginBottom: '24px' }
const titleStyle: React.CSSProperties = { margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#111827', letterSpacing: '-0.04em' }
const sectionLabel: React.CSSProperties = { margin: '0 0 12px', fontSize: '0.8rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }
const cardStyle: React.CSSProperties = { background: '#FFFFFF', borderRadius: 14, border: '1.5px solid #E5E7EB', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }
const userBadgeStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 12px 5px 7px', borderRadius: '999px', background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(15,23,42,0.12)', color: '#111827', fontSize: '0.82rem', fontWeight: 700 }
const userIconStyle: React.CSSProperties = { width: 22, height: 22, borderRadius: '999px', background: '#334155', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const emptyTextStyle: React.CSSProperties = { margin: 0, color: '#6B7280', fontSize: '0.95rem' }
