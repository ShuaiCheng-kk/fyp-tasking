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

export default function ApplyJobModal({
  jobId,
  onClose,
}: Props) {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [jobTitle, setJobTitle] = useState('Job Opening')

  useEffect(() => {
  const loadJob = async () => {
    const jobRes = await fetch(`/api/guest/jobs/${jobId}`)
    const jobData = await jobRes.json()

    if (jobData.success) {
      setJobTitle(jobData.job.title || 'Job Opening')
    }
  }

  void loadJob()
}, [jobId])

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
      <style>{`
        @keyframes overlayFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modalSlideIn  { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>
      <div style={modalStyle}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={modalTitleStyle}>
            Submit Job Application — {jobTitle}
          </h2>
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

              <div style={labelStyle}>
                Resume File

                <label style={fileUploadRowStyle}>
                  <span style={uploadButtonStyle}>
                    {resumeFile ? 'Change Resume' : 'Upload Resume'}
                  </span>

                  <span style={resumeFile ? uploadedFileNameStyle : fileNameStyle}>
                    {resumeFile ? resumeFile.name : 'No file selected'}
                  </span>

                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => handleResumeChange(e.target.files?.[0] ?? null)}
                    style={{ display: 'none' }}
                  />
                </label>

                <small style={hintStyle}>Accepted: PDF, DOC, DOCX. Max 5MB.</small>
              </div>

              <div style={labelStyle}>
                Cover Letter File

                <label style={fileUploadRowStyle}>
                  <span style={uploadButtonStyle}>
                    {coverLetterFile ? 'Change Cover Letter' : 'Upload Cover Letter'}
                  </span>

                  <span style={coverLetterFile ? uploadedFileNameStyle : fileNameStyle}>
                    {coverLetterFile ? coverLetterFile.name : 'No file selected'}
                  </span>

                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => handleCoverLetterChange(e.target.files?.[0] ?? null)}
                    style={{ display: 'none' }}
                  />
                </label>

                <small style={hintStyle}>Accepted: PDF, DOC, DOCX. Max 5MB.</small>
              </div>
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
  maxWidth: 720,
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
  fontSize: 24,
  fontWeight: 700,
  color: '#111827',
}

const modalSubtitleStyle: React.CSSProperties = {
  color: '#6B7280',
  marginTop: 8,
  fontFamily: 'var(--font-body)',
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

const fileUploadRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  width: '100%',
  marginTop: 6,
}

const uploadButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid #D1D5DB',
  background: '#F9FAFB',
  color: '#111827',
  fontSize: '0.875rem',
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const fileNameStyle: React.CSSProperties = {
  color: '#F97316',
  fontSize: '0.875rem',
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const uploadedFileNameStyle: React.CSSProperties = {
  color: '#F97316',
  fontSize: '0.875rem',
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
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
  padding: '7px 18px',
  borderRadius: 8,
  border: 'none',
  background: 'linear-gradient(135deg, #F97316, #EA580C)',
  color: 'white',
  fontWeight: 600,
  fontSize: '0.8125rem',
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '7px 18px',
  borderRadius: 8,
  border: '1.5px solid #E5E7EB',
  background: '#FFFFFF',
  color: '#6B7280',
  fontWeight: 600,
  fontSize: '0.8125rem',
  cursor: 'pointer',
}