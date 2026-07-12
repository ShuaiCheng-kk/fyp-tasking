'use client'

// Apply flow (reworked): the application collects only what is specific to THIS job — a
// relevant-experience answer and an optional note. Skills, certificates, and resume come from
// the Worker Profile and are snapshotted server-side at submit time. Hard gates (age, job still
// open, duplicates, schedule conflicts) are enforced by the service; this modal mirrors the age
// gate up-front so an ineligible worker sees why before typing anything.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Award, Cake, FileText, Paperclip, Shirt, Wrench } from 'lucide-react'

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
  certificates: { id: string; name: string; file_url: string | null }[]
}

type Job = {
  id: string
  title: string
  company_name: string | null
  minimum_age: number | null
  experience_required: string | null
  uniform_required: boolean
  uniform_type: string | null
  uniform_details: string | null
}

const EXPERIENCE_OPTIONS = [
  { value: 'none', label: 'No experience' },
  { value: 'less_than_1', label: 'Less than 1 year' },
  { value: '1_to_2', label: '1–2 years' },
  { value: 'more_than_2', label: 'More than 2 years' },
] as const

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
  const [experience, setExperience] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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

  const handleSubmit = async () => {
    setError('')
    if (!profile) { setError('Profile not loaded.'); return }
    if (!experience) { setError('Please select your relevant experience for this role.'); return }

    try {
      setSubmitting(true)
      const res = await fetch('/api/guest/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          user_id: profile.id,
          relevant_experience: experience,
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

  const uniformLine = job?.uniform_required
    ? (job.uniform_type === 'company'
      ? `Company uniform provided${job.uniform_details ? ` — ${job.uniform_details}` : ''}`
      : `Dress code${job.uniform_details ? ` — ${job.uniform_details}` : ''}`)
    : null

  return (
    <div style={overlayStyle}>
      <style>{`
        @keyframes overlayFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modalSlideIn  { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>
      <div style={modalStyle}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={modalTitleStyle}>Apply — {job?.title ?? 'Job Opening'}</h2>
          {job?.company_name && <p style={modalSubtitleStyle}>{job.company_name}</p>}
        </div>

        {loading ? (
          <p>Loading application…</p>
        ) : (
          <>
            {error && <div style={errorStyle}>{error}</div>}

            {/* Job requirements — read-only; uniform and minimum age are the employer's info,
                the applicant only reads them. */}
            {(job?.minimum_age != null || job?.experience_required || uniformLine) && (
              <div style={requirementBoxStyle}>
                <p style={sectionTitleStyle}>Job Requirements</p>
                {job?.minimum_age != null && (
                  <div style={requirementRowStyle}>
                    <Cake size={14} color="#F97316" style={{ flexShrink: 0 }} />
                    <span>Minimum age: {job.minimum_age}+{age != null ? ` (you are ${age})` : ''}</span>
                  </div>
                )}
                {job?.experience_required && (
                  <div style={requirementRowStyle}>
                    <Wrench size={14} color="#F97316" style={{ flexShrink: 0 }} />
                    <span>Experience required: {job.experience_required}</span>
                  </div>
                )}
                {uniformLine && (
                  <div style={requirementRowStyle}>
                    <Shirt size={14} color="#F97316" style={{ flexShrink: 0 }} />
                    <span>{uniformLine}</span>
                  </div>
                )}
              </div>
            )}

            {ageIneligible ? (
              <div style={{ ...errorStyle, marginBottom: 0 }}>
                You must be at least {job?.minimum_age} years old to apply for this job.
              </div>
            ) : (
              <>
                {/* Relevant experience for THIS role — the one thing the profile can't answer */}
                <div style={{ marginBottom: 18 }}>
                  <p style={sectionTitleStyle}>
                    How much experience do you have in this role?
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {EXPERIENCE_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => setExperience(opt.value)}
                        style={{
                          padding: '10px 0', borderRadius: 10, cursor: 'pointer',
                          border: `1.5px solid ${experience === opt.value ? '#F97316' : '#E5E7EB'}`,
                          background: experience === opt.value ? '#FFF7ED' : '#FFFFFF',
                          color: experience === opt.value ? '#EA580C' : '#4B5563',
                          fontWeight: 700, fontSize: '0.8425rem',
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional free-text note */}
                <div style={{ marginBottom: 18 }}>
                  <p style={sectionTitleStyle}>Additional Note (optional)</p>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="e.g. I worked at Starbucks for one year. I have weekend availability."
                    style={textareaStyle}
                  />
                </div>

                {/* What gets attached automatically from the Worker Profile */}
                <div style={attachedBoxStyle}>
                  <p style={sectionTitleStyle}>Attached from your Worker Profile</p>
                  <div style={requirementRowStyle}>
                    <Wrench size={14} color={profile?.skills ? '#15803D' : '#9CA3AF'} style={{ flexShrink: 0 }} />
                    <span style={{ color: profile?.skills ? '#111827' : '#9CA3AF' }}>
                      {profile?.skills ? `Skills: ${profile.skills}` : 'No skills added yet'}
                    </span>
                  </div>
                  <div style={requirementRowStyle}>
                    <Award size={14} color={profile?.certificates?.length ? '#15803D' : '#9CA3AF'} style={{ flexShrink: 0 }} />
                    <span style={{ color: profile?.certificates?.length ? '#111827' : '#9CA3AF' }}>
                      {profile?.certificates?.length
                        ? `Certificates: ${profile.certificates.map(c => c.name).join(', ')}`
                        : 'No certificates added yet'}
                    </span>
                  </div>
                  <div style={requirementRowStyle}>
                    <FileText size={14} color={profile?.resume_url ? '#15803D' : '#9CA3AF'} style={{ flexShrink: 0 }} />
                    <span style={{ color: profile?.resume_url ? '#111827' : '#9CA3AF' }}>
                      {profile?.resume_url ? 'Resume attached' : 'No resume uploaded yet'}
                    </span>
                  </div>
                  {(!profile?.skills || !profile?.resume_url || !profile?.certificates?.length) && (
                    <a href="/guest/profile" style={profileLinkStyle}>
                      <Paperclip size={12} /> Complete your Worker Profile to strengthen this application
                    </a>
                  )}
                </div>
              </>
            )}

            <div style={footerStyle}>
              <button onClick={onClose} disabled={submitting} style={secondaryButtonStyle}>
                Cancel
              </button>
              {!ageIneligible && (
                <button onClick={handleSubmit} disabled={submitting} style={primaryButtonStyle}>
                  {submitting ? 'Submitting…' : 'Submit Application'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.45)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 24,
  overflowY: 'auto',
  zIndex: 9999,
  animation: 'overlayFadeIn 0.18s ease-out',
}

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 640,
  maxHeight: '90vh',
  overflowY: 'auto',
  background: '#FFFFFF',
  borderRadius: 20,
  padding: 32,
  boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)',
  animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)',
}

const modalTitleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: 22,
  fontWeight: 700,
  color: '#111827',
}

const modalSubtitleStyle: React.CSSProperties = {
  color: '#6B7280',
  margin: '6px 0 0',
  fontSize: '0.9rem',
  fontFamily: 'var(--font-body)',
}

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: '0.8125rem',
  fontWeight: 700,
  color: '#374151',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const requirementBoxStyle: React.CSSProperties = {
  background: '#FAFAFA',
  border: '1px solid #E5E7EB',
  borderRadius: 12,
  padding: '14px 16px',
  marginBottom: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const attachedBoxStyle: React.CSSProperties = {
  background: '#F0FDF4',
  border: '1px solid #BBF7D0',
  borderRadius: 12,
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const requirementRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  fontSize: '0.875rem',
  color: '#111827',
  lineHeight: 1.45,
}

const profileLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  marginTop: 4,
  fontSize: '0.8125rem',
  fontWeight: 700,
  color: '#EA580C',
  textDecoration: 'none',
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

const errorStyle: React.CSSProperties = {
  color: '#B91C1C',
  background: '#FEE2E2',
  padding: 12,
  borderRadius: 10,
  marginBottom: 16,
  fontSize: '0.875rem',
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
  marginTop: 24,
  paddingTop: 20,
  borderTop: '1px solid #E5E7EB',
  background: '#FFFFFF',
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '9px 18px',
  borderRadius: 8,
  border: 'none',
  background: 'linear-gradient(135deg, #F97316, #EA580C)',
  color: 'white',
  fontWeight: 700,
  fontSize: '0.8425rem',
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '9px 18px',
  borderRadius: 8,
  border: '1.5px solid #E5E7EB',
  background: '#FFFFFF',
  color: '#6B7280',
  fontWeight: 700,
  fontSize: '0.8425rem',
  cursor: 'pointer',
}
