'use client'

// Apply flow (reworked): the application collects only what is specific to THIS job — a
// relevant-experience answer and an optional note. Skills, certificates, and resume come from
// the Worker Profile and are snapshotted server-side at submit time. Hard gates (age, job still
// open, duplicates, schedule conflicts) are enforced by the service; this modal mirrors the age
// gate up-front so an ineligible worker sees why before typing anything.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, Cake, Clock, DollarSign, Shirt, UserCheck, X } from 'lucide-react'
import {
  ModalOverlay, ModalBox, ModalHeader,
  modalErrorBoxStyle, modalGhostButtonStyle, modalLabelStyle, modalPrimaryButtonStyle,
} from '@/components/modal'
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport'

type Props = {
  jobId: string
  onClose: () => void
  // When provided (e.g. from the public job board), stay in place after a successful apply and
  // let the host show a toast + refresh, instead of redirecting to My Applications.
  onApplied?: (jobTitle: string) => void
}

type Profile = {
  id: string
  full_name: string
  email_address: string
  phone_number: string | null
  date_of_birth: string | null
  skills: string | null
  resume_url: string | null
  certificates: { id: string; name: string; certificate_url: string | null }[]
}

type Job = {
  id: string
  title: string
  company_name: string | null
  minimum_age: number | null
  experience_required: string | null
  uniform_type: string | null
  uniform_details: string | null
  responsibilities: string | null
  skills: string | null
  salary_amount: number | null
  job_type: string | null
  job_date: string | null
  job_start_time: string | null
  job_end_time: string | null
  break_start_time: string | null
  break_end_time: string | null
  estimated_hours: string | null
  expires_at: string | null
}

// The posting's experience_required values that act as a hard apply gate (must match the
// service's HARD_EXPERIENCE_MINIMUMS), mapped to the wording shown in the requirement copy.
// 'Not Required' and 'Preferred' don't gate and show no experience section at all.
const HARD_EXPERIENCE_MINIMUMS: Record<string, string> = {
  '6+ Months': '6 months',
  '1+ Year': '1 year',
  '2+ Years': '2 years',
}

function computeAge(dateOfBirth: string): number {
  const dob = new Date(`${dateOfBirth.slice(0, 10)}T00:00:00`)
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const hadBirthday =
    now.getMonth() > dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate())
  if (!hadBirthday) age -= 1
  return age
}

export default function ApplyJobModal({ jobId, onClose, onApplied }: Props) {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [meetsRequirement, setMeetsRequirement] = useState(false)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Side card with the full job details — toggled by clicking the job title, so the
  // worker can read the posting while filling in the application (the modal stays open).
  const [showJobInfo, setShowJobInfo] = useState(false)
  // Phone: there's no space beside the modal to dock the job-details card into, so it becomes a
  // centered full-width sheet over the form instead of a side card.
  const isPhone = useIsCompactViewport(640)
  const [titleHovered, setTitleHovered] = useState(false)
  // The overlay flex-centers the modal, so its top edge moves with content height — measure it
  // via a marker at the top of the ModalBox so the side card always sits on the same line.
  const modalTopRef = useRef<HTMLDivElement | null>(null)
  const [sideCardTop, setSideCardTop] = useState<number | null>(null)
  useEffect(() => {
    if (!showJobInfo) return
    const measure = () => {
      const top = modalTopRef.current?.getBoundingClientRect().top
      if (top != null) setSideCardTop(Math.max(16, top))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [showJobInfo, loading, error, meetsRequirement])

  useEffect(() => {
    const load = async () => {
      try {
        const authId = localStorage.getItem('tasking_user_id')
        if (!authId) {
          router.replace('/signin')
          return
        }

        const [profileRes, jobRes] = await Promise.all([
          fetch(`/api/guest/profile?user_id=${authId}`),
          fetch(`/api/recruitment?resource=job_posting&job_id=${jobId}`),
        ])

        if (profileRes.status === 404) {
          // The stored session points at an account that no longer exists (e.g. deleted, or a
          // stale localStorage id from before a data reset) — treat this the same as never
          // having logged in rather than dead-ending on a broken form.
          localStorage.removeItem('tasking_user_id')
          localStorage.removeItem('tasking_user_role')
          router.replace('/signin')
          return
        }

        const profileData = await profileRes.json()
        const jobData = await jobRes.json()

        if (!profileData.success) throw new Error(profileData.message || 'Failed to load profile')
        if (!jobData.success) throw new Error(jobData.message || 'Failed to load job')

        setProfile(profileData.profile)
        setJob(jobData.posting)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load application form')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [jobId, router])

  const age = profile?.date_of_birth ? computeAge(profile.date_of_birth) : null
  const ageIneligible = job?.minimum_age != null && age != null && age < job.minimum_age
  // Hard experience gate — mirrors the service-side check: the worker confirms the posting's
  // minimum instead of re-answering how much experience they have.
  const experienceMinimum = job?.experience_required ? HARD_EXPERIENCE_MINIMUMS[job.experience_required] : undefined

  const handleSubmit = async () => {
    setError('')
    if (!profile) { setError('Profile not loaded.'); return }
    if (experienceMinimum && !meetsRequirement) {
      setError('Please confirm you meet the experience requirement.')
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch('/api/guest/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          user_id: profile.id,
          meets_experience_requirement: meetsRequirement,
          additional_note: note.trim() || null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)

      localStorage.removeItem('apply_job_id')
      if (onApplied) {
        // Job board: stay put so the worker can keep browsing/applying.
        onApplied(job?.title ?? 'this job')
        onClose()
      } else {
        onClose()
        router.replace('/guest/applications')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose} maxWidth="520px">
      <ModalBox>
        <div ref={modalTopRef} />
        <ModalHeader
          title="Apply for Position"
          icon={<Briefcase size={15} color="#fff" strokeWidth={2.5} />}
          onClose={onClose}
        />

        <div style={{ padding: '20px 24px' }}>
        <div style={{ marginBottom: 18 }}>
          <button
            onClick={() => setShowJobInfo(v => !v)}
            onMouseEnter={() => setTitleHovered(true)}
            onMouseLeave={() => setTitleHovered(false)}
            style={{
              display: 'block', margin: '0 0 4px', padding: 0, border: 'none', background: 'transparent',
              color: titleHovered ? '#C2410C' : '#EA580C', fontSize: '1rem', fontWeight: 700,
              lineHeight: 1.4, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              textDecoration: 'underline', textUnderlineOffset: 3, transition: 'color 0.15s',
            }}
          >
            {job?.title ?? 'Job Opening'}
          </button>
          {job?.company_name && (
            <p style={{ margin: 0, color: '#6B7280', fontSize: '0.9rem', lineHeight: 1.5 }}>{job.company_name}</p>
          )}
        </div>

        {loading ? (
          <p style={{ margin: 0, color: '#6B7280', fontSize: '0.9rem' }}>Loading application…</p>
        ) : (
          <>
            {ageIneligible ? (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626' }}>
                You must be at least {job?.minimum_age} years old to apply for this job.
              </div>
            ) : (
              <>
                {/* Experience requirement — the posting already states its minimum, so instead of
                    re-asking a level, the worker confirms meeting it. Unchecked = cannot submit. */}
                {experienceMinimum && (
                  <div style={{ marginBottom: 18, borderTop: '1px solid #F0EBE3', paddingTop: 18 }}>
                    <p style={sectionTitleStyle}>
                      This job requires at least {experienceMinimum} of relevant experience.
                    </p>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 400, color: '#6B7280', lineHeight: 1.5 }}>
                      <input
                        type="checkbox"
                        checked={meetsRequirement}
                        onChange={e => setMeetsRequirement(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: '#F97316', cursor: 'pointer', flexShrink: 0 }}
                      />
                      I have the required experience
                    </label>
                  </div>
                )}

                {/* Optional free-text note */}
                <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 18 }}>
                  <p style={sectionTitleStyle}>Additional note (optional)</p>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="e.g. I worked at Starbucks for one year. I have weekend availability."
                    style={textareaStyle}
                  />
                </div>
              </>
            )}

          </>
        )}
        </div>

        {error && !loading && <div style={modalErrorBoxStyle}>{error}</div>}

        <div style={{ padding: '0 24px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={submitting} style={modalGhostButtonStyle}>
            Cancel
          </button>
          {!loading && !ageIneligible && (
            <button
              onClick={handleSubmit}
              disabled={submitting || (!!experienceMinimum && !meetsRequirement)}
              style={modalPrimaryButtonStyle(submitting || (!!experienceMinimum && !meetsRequirement))}
            >
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>
          )}
        </div>
      </ModalBox>

      {/* Job details side card — same design as the Job Board detail panel, docked just beside
          the application modal so the worker can read the posting while filling in the form. */}
      {showJobInfo && job && (() => {
        const isShiftJob = job.job_type === 'shift'
        const payLabel = job.salary_amount != null ? (isShiftJob ? `$${job.salary_amount}/hr` : `$${job.salary_amount} flat rate`) : null
        const fmt12 = (t: string) => { const [h, m] = t.slice(0, 5).split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}:${String(m).padStart(2, '0')} ${ap}` }
        const dateLabel = job.job_date
          ? new Date(`${job.job_date.slice(0, 10)}T00:00:00`).toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : null
        const uniformLabel = job.uniform_type === 'dress_code'
          ? 'Specific Dress Code'
          : job.uniform_type === 'company' ? 'Company Uniform Provided' : null
        const cd = (() => {
          if (!job.expires_at) return null
          const diffMs = new Date(job.expires_at).getTime() - Date.now()
          if (diffMs <= 0) return { label: 'Application Closed', expired: true }
          const totalMins = Math.floor(diffMs / 60000)
          const days = Math.floor(totalMins / 1440)
          const hours = Math.floor((totalMins % 1440) / 60)
          const mins = totalMins % 60
          if (days >= 1) return { label: `Closes in ${days}d ${hours}h`, expired: false }
          if (hours >= 1) return { label: `Closes in ${hours}h ${mins}m`, expired: false }
          return { label: `Closes in ${Math.max(1, mins)}m`, expired: false }
        })()
        const metaRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 }
        const metaText: React.CSSProperties = { fontSize: '0.875rem', color: '#374151' }
        const scheduleLine: React.CSSProperties = { fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, margin: 0 }
        return (
          <div style={{
            // Docked just to the right of the 520px-wide centered modal, top-aligned with it.
            position: 'fixed',
            left: isPhone ? 12 : 'min(calc(50% + 276px), calc(100vw - 424px))',
            top: isPhone ? 16 : (sideCardTop ?? 96),
            width: isPhone ? 'calc(100vw - 24px)' : 'min(400px, calc(100vw - 48px))',
            maxHeight: isPhone ? 'calc(100vh - 32px)' : `calc(100vh - ${(sideCardTop ?? 96) + 24}px)`,
            overflowY: 'auto',
            background: '#FFFFFF', border: '1px solid #EDE9E3', borderRadius: 20, padding: isPhone ? 18 : 28,
            display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
            animation: 'tabFadeIn 0.18s ease-out',
          }}>
            {/* Header — title + deadline pill + company, mirroring the Job Board detail panel */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <p style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', lineHeight: 1.35, margin: 0 }}>{job.title}</p>
                  {cd && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: cd.expired ? '#FEF2F2' : '#FFFBEB', color: cd.expired ? '#B91C1C' : '#B45309', border: `1px solid ${cd.expired ? '#FECACA' : '#FDE68A'}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      <Clock size={11} />{cd.label}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6B7280', margin: '0 0 14px' }}>{job.company_name ?? '—'}</p>

                {/* Meta rows — same set and order as the Job Board detail */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {job.minimum_age != null && (
                    <div style={metaRow}><Cake size={14} color="#F97316" strokeWidth={2} style={{ flexShrink: 0 }} /><span style={metaText}>{job.minimum_age}+</span></div>
                  )}
                  {job.experience_required && job.experience_required !== 'Not Required' && (
                    <div style={metaRow}><UserCheck size={14} color="#F97316" strokeWidth={2} style={{ flexShrink: 0 }} /><span style={metaText}>Experience {job.experience_required}</span></div>
                  )}
                  {uniformLabel && (
                    <div style={metaRow}><Shirt size={14} color="#F97316" strokeWidth={2} style={{ flexShrink: 0 }} /><span style={metaText}>{uniformLabel}</span></div>
                  )}
                  {!isShiftJob && job.estimated_hours && (
                    <div style={metaRow}><Clock size={14} color="#F97316" strokeWidth={2} style={{ flexShrink: 0 }} /><span style={metaText}>Est. {job.estimated_hours} hours</span></div>
                  )}
                  {payLabel && (
                    <div style={metaRow}><DollarSign size={14} color="#F97316" strokeWidth={2} style={{ flexShrink: 0 }} /><span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#059669' }}>{payLabel}</span></div>
                  )}
                </div>
              </div>
              <button onClick={() => setShowJobInfo(false)} aria-label="Close job details"
                style={{ background: '#F3F4F6', border: 'none', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <X size={14} color="#374151" />
              </button>
            </div>

            {/* Schedule — Date / Working Hours / Break Time (shift) or Start Time (one-off) */}
            {(dateLabel || job.job_start_time) && (
              <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Schedule</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {dateLabel && (
                    <p style={scheduleLine}><span style={{ fontWeight: 600, color: '#EA580C' }}>Date:</span> {dateLabel}</p>
                  )}
                  {isShiftJob && (job.job_start_time || job.job_end_time) && (
                    <p style={scheduleLine}><span style={{ fontWeight: 600, color: '#EA580C' }}>Working Hours:</span> {job.job_start_time ? fmt12(job.job_start_time) : '—'} – {job.job_end_time ? fmt12(job.job_end_time) : '—'}</p>
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
            <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
              <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Responsibilities</p>
              <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }}>{job.responsibilities || '—'}</p>
            </div>

            {/* Skills & Qualifications */}
            <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
              <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>Skills &amp; Qualifications</p>
              <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }}>{job.skills || '—'}</p>
            </div>

            {/* Dress code / uniform details */}
            {uniformLabel && job.uniform_details && (
              <div style={{ borderTop: '1px solid #F0EBE3', paddingTop: 20 }}>
                <p style={{ ...modalLabelStyle, margin: '0 0 8px' }}>{job.uniform_type === 'dress_code' ? 'Dress Code' : 'Uniform Details'}</p>
                <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }}>{job.uniform_details}</p>
              </div>
            )}
          </div>
        )
      })()}
    </ModalOverlay>
  )
}

// Same label treatment as the register (get-started) form fields — identical font family,
// weight, size, and color, so the two forms read as one system.
const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontFamily: 'var(--font-body, inherit)',
  fontSize: '0.9375rem',
  fontWeight: 600,
  color: '#374151',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1.5px solid #E5E7EB',
  fontSize: '0.9rem',
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#FFFFFF',
  resize: 'vertical',
  lineHeight: 1.55,
  fontFamily: 'inherit',
}

