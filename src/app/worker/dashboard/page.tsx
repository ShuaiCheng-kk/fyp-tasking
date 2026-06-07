'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function WorkerDashboardContent() {
  const searchParams = useSearchParams()
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)

  useEffect(() => {
    const apply = searchParams.get('apply')
    const job = searchParams.get('job_id')

    if (apply === 'true' && job) {
      setJobId(job)
      setShowApplyModal(true)
    }
  }, [searchParams])

  return (
    <main style={{ display: 'flex', minHeight: '100vh', background: '#F9FAFB' }}>
      <aside style={{
        width: 240,
        background: '#111827',
        color: 'white',
        padding: 24,
      }}>
        <h2>Worker Portal</h2>

        <nav style={{ display: 'grid', gap: 12, marginTop: 32 }}>
          <a href="/worker/dashboard" style={linkStyle}>Dashboard</a>
          <a href="/worker/applications" style={linkStyle}>My Applications</a>
          <a href="/worker/profile" style={linkStyle}>Profile</a>
        </nav>
      </aside>

      <section style={{ flex: 1 }}>
        <header style={{
          height: 72,
          background: 'white',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          padding: '0 32px',
        }}>
          <h1 style={{ margin: 0 }}>Guest User Dashboard</h1>
        </header>

        <div style={{ padding: 32 }}>
          <h2>Welcome</h2>
          <p style={{ color: '#6B7280' }}>
            You can submit job applications, view your application status, and update your profile.
          </p>
        </div>
      </section>

      {showApplyModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h2>Submit Application</h2>
            <p style={{ color: '#6B7280' }}>
              Application form for job ID: {jobId}
            </p>

            <button
              onClick={() => setShowApplyModal(false)}
              style={buttonStyle}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

const linkStyle: React.CSSProperties = {
  color: 'white',
  textDecoration: 'none',
  padding: '10px 12px',
  borderRadius: 8,
  background: '#1F2937',
}

const modalOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
}

const modalBox: React.CSSProperties = {
  width: '100%',
  maxWidth: 620,
  background: 'white',
  borderRadius: 16,
  padding: 32,
  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
}

const buttonStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#16A34A',
  color: 'white',
  fontWeight: 600,
  cursor: 'pointer',
}

export default function WorkerDashboardPage() {
  return (
    <Suspense fallback={<main style={{ padding: 40 }}>Loading...</main>}>
      <WorkerDashboardContent />
    </Suspense>
  )
}