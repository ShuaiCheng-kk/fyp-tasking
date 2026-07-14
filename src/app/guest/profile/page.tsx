'use client'

// Guest User's Worker Profile page — the long-lived profile (skills, certificates, resume)
// that gets snapshotted into every job application. Renders the same shared sections the
// Casual Worker profile page uses; the chrome (sidebar + header) comes from the guest layout.

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import GuestPersonalInfoCard from '@/components/guest/GuestPersonalInfoCard'
import { SkillsCard, CertificatesCard, ResumeCard } from '@/components/worker/WorkerProfileSections'

const pageKeyframes = `
  @keyframes blockSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes fadeSlideUpToast { from { opacity: 0; transform: translateX(-50%) translateY(10px) } to { opacity: 1; transform: translateX(-50%) translateY(0) } }
`

export default function GuestWorkerProfilePage() {
  const [authId, setAuthId] = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    const load = async () => {
      const storedAuthId = localStorage.getItem('tasking_user_id')
      if (!storedAuthId) {
        window.location.href = '/signin'
        return
      }
      setAuthId(storedAuthId)

      // Internal user id (not the auth uid) — the header badge's profile update matches on users.id
      const res = await fetch(`/api/guest/profile?user_id=${storedAuthId}`)
      const data = await res.json()
      if (data.success) setInternalUserId(data.profile.id)
    }
    void load()
  }, [])

  return (
    <>
      <style>{pageKeyframes}</style>

      <main style={pageStyle}>
        {/* Page header — title left, matching the Owner pages */}
        <div style={{ marginBottom: 20 }}>
          <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
            My Profile
          </h1>
        </div>

        <section style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start', animation: 'blockSlideUp 0.38s ease both 0.06s' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {internalUserId && <GuestPersonalInfoCard userId={internalUserId} onToast={showToast} />}
            {authId && <SkillsCard authId={authId} onToast={showToast} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {authId && <CertificatesCard authId={authId} onToast={showToast} />}
            {authId && <ResumeCard authId={authId} onToast={showToast} />}
          </div>
        </section>
      </main>

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
    </>
  )
}

// No fontFamily override — Owner pages don't set one either, so this page inherits the same
// ambient system font as the rest of the app instead of forcing Inter over it.
const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  padding: '20px 28px 28px',
}
