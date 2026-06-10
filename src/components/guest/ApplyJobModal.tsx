'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  jobId: string
  onClose: () => void
}

type Profile = {
  id: string
  full_name: string
  email_address: string
  phone_number: string
}

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export default function ApplyJobModal({ jobId, onClose }: Props) {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const authId = localStorage.getItem('tasking_user_id')

        if (!authId) {
          router.replace('/signin')
          return
        }

        const res = await fetch(`/api/guest/profile?user_id=${authId}`)
        const data = await res.json()

        if (!data.success) throw new Error(data.message)

        setProfile(data.profile)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])

  const validateFile = (file: File, label: string) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `${label} must be PDF, DOC, or DOCX.`
    }

    if (file.size > MAX_FILE_SIZE) {
      return `${label} must be smaller than 5MB.`
    }

    return ''
  }

  const handleResumeChange = (file: File | null) => {
    setError('')
    if (!file) {
      setResumeFile(null)
      return
    }

    const fileError = validateFile(file, 'Resume')
    if (fileError) {
      setError(fileError)
      setResumeFile(null)
      return
    }

    setResumeFile(file)
  }

  const handleCoverLetterChange = (file: File | null) => {
    setError('')
    if (!file) {
      setCoverLetterFile(null)
      return
    }

    const fileError = validateFile(file, 'Cover letter')
    if (fileError) {
      setError(fileError)
      setCoverLetterFile(null)
      return
    }

    setCoverLetterFile(file)
  }

  const handleSubmit = async () => {
    setError('')

    if (!profile) {
      setError('Profile not loaded.')
      return
    }

    if (!resumeFile) {
      setError('Please upload your resume.')
      return
    }

    if (!coverLetterFile) {
      setError('Please upload your cover letter.')
      return
    }

    const formData = new FormData()
    formData.append('job_id', jobId)
    formData.append('user_id', profile.id)
    formData.append('resume_file', resumeFile)
    formData.append('cover_letter_file', coverLetterFile)

    try {
      setSubmitting(true)

      const res = await fetch('/api/guest/applications', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!data.success) throw new Error(data.message)

      sessionStorage.removeItem('apply_job_id')
      onClose()
      router.replace('/guest/applications')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>Submit Job Application</h2>
          <p style={{ color: '#6B7280', marginTop: 8 }}>
            Your contact details are auto-filled from your account.
          </p>
        </div>

        {loading ? (
          <p>Loading profile...</p>
        ) : (
          <>
            {error && <div style={errorStyle}>{error}</div>}

            <div style={gridStyle}>
              <label style={labelStyle}>
                Full Name
                <input value={profile?.full_name ?? ''} readOnly style={readOnlyInputStyle} />
              </label>

              <label style={labelStyle}>
                Email
                <input value={profile?.email_address ?? ''} readOnly style={readOnlyInputStyle} />
              </label>

              <label style={labelStyle}>
                Phone Number
                <input value={profile?.phone_number ?? ''} readOnly style={readOnlyInputStyle} />
              </label>

              <label style={labelStyle}>
                Resume File
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => handleResumeChange(e.target.files?.[0] ?? null)}
                  style={fileInputStyle}
                />
                <small style={hintStyle}>Accepted: PDF, DOC, DOCX. Max 5MB.</small>
              </label>

              <label style={labelStyle}>
                Cover Letter File
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => handleCoverLetterChange(e.target.files?.[0] ?? null)}
                  style={fileInputStyle}
                />
                <small style={hintStyle}>Accepted: PDF, DOC, DOCX. Max 5MB.</small>
              </label>
            </div>

            <div style={footerStyle}>
              <button onClick={onClose} disabled={submitting} style={secondaryButtonStyle}>
                Cancel
              </button>

              <button onClick={handleSubmit} disabled={submitting} style={primaryButtonStyle}>
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
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

  background: 'rgba(0,0,0,0.4)',

  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',

  padding: 24,

  overflowY: 'auto',

  zIndex: 9999,
}

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 720,
  maxHeight: '90vh',
  overflowY: 'auto',
  background: '#FFFFFF',
  borderRadius: 18,
  padding: 32,
  boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gap: 16,
}

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#374151',
}

const readOnlyInputStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  marginTop: 6,
  borderRadius: 10,
  border: '1px solid #D1D5DB',
  background: '#F9FAFB',
  color: '#4B5563',
}

const fileInputStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  marginTop: 6,
  borderRadius: 10,
  border: '1px solid #D1D5DB',
  background: '#FFFFFF',
}

const hintStyle: React.CSSProperties = {
  display: 'block',
  marginTop: 6,
  color: '#6B7280',
  fontWeight: 400,
}

const errorStyle: React.CSSProperties = {
  color: '#B91C1C',
  background: '#FEE2E2',
  padding: 12,
  borderRadius: 10,
  marginBottom: 16,
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,

  marginTop: 32,
  paddingTop: 20,

  borderTop: '1px solid #E5E7EB',
  background: '#FFFFFF',
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '12px 18px',
  borderRadius: 10,
  border: 'none',
  background: '#16A34A',
  color: 'white',
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '12px 18px',
  borderRadius: 10,
  border: '1px solid #D1D5DB',
  background: '#FFFFFF',
  fontWeight: 600,
  cursor: 'pointer',
}