'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Profile = {
  full_name: string
  email_address: string
  phone_number: string
}

function WorkerApplyPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const jobId = searchParams.get('job_id')

  const [profile, setProfile] = useState<Profile>({
    full_name: '',
    email_address: '',
    phone_number: '',
  })

  const [resumeUrl, setResumeUrl] = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userId = localStorage.getItem('tasking_user_id')

        if (!userId) {
          router.replace('/signin')
          return
        }

        if (!jobId) {
          setError('Missing job information.')
          return
        }

        const res = await fetch(`/api/worker/profile?user_id=${userId}`)
        const data = await res.json()

        if (!data.success) {
          throw new Error(data.message)
        }

        setProfile(data.profile)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [jobId, router])

  const handleSubmitApplication = async () => {
    setError('')

    if (!resumeUrl.trim()) {
      setError('Please enter your resume URL.')
      return
    }

    if (!coverLetter.trim()) {
      setError('Please enter your cover letter.')
      return
    }

    try {
      setSubmitting(true)

      const userId = localStorage.getItem('tasking_user_id')

      const res = await fetch('/api/worker/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          user_id: userId,
          resume_url: resumeUrl.trim(),
          cover_letter: coverLetter.trim(),
        }),
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.message)
      }

      sessionStorage.removeItem('apply_job_id')
      router.replace('/worker/applications')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <main style={{ padding: 40 }}>Loading application form...</main>
  }

  return (
    <main style={{ maxWidth: 760, margin: '40px auto', padding: 24 }}>
      <h1>Submit Application</h1>
      <p style={{ color: '#6B7280' }}>
        Your personal information is auto-filled from your account.
      </p>

      {error && (
        <div style={{ color: '#DC2626', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        <label>
          Full Name
          <input value={profile.full_name} readOnly style={inputStyle} />
        </label>

        <label>
          Email
          <input value={profile.email_address} readOnly style={inputStyle} />
        </label>

        <label>
          Phone Number
          <input value={profile.phone_number} readOnly style={inputStyle} />
        </label>

        <label>
          Resume URL
          <input
            value={resumeUrl}
            onChange={(e) => setResumeUrl(e.target.value)}
            placeholder="Paste your resume link"
            style={inputStyle}
          />
        </label>

        <label>
          Cover Letter
          <textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            placeholder="Write your cover letter"
            rows={8}
            style={inputStyle}
          />
        </label>

        <button
          onClick={handleSubmitApplication}
          disabled={submitting}
          style={buttonStyle}
        >
          {submitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </div>
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  marginTop: '6px',
  borderRadius: '8px',
  border: '1px solid #D1D5DB',
}

const buttonStyle: React.CSSProperties = {
  padding: '12px 18px',
  borderRadius: '8px',
  border: 'none',
  background: '#16A34A',
  color: 'white',
  fontWeight: 600,
  cursor: 'pointer',
}

export default function WorkerApplyPage() {
  return (
    <Suspense fallback={<main style={{ padding: 40 }}>Loading...</main>}>
      <WorkerApplyPageContent />
    </Suspense>
  )
}