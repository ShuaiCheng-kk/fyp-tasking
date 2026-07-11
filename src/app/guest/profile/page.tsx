'use client'

// Guest User's Worker Profile page — the long-lived profile (skills, certificates, resume)
// that gets snapshotted into every job application. Renders the same shared sections the
// Casual Worker profile page uses; only the surrounding chrome (guest top bar) differs.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import GuestProfileMenu from '@/components/guest/GuestProfileMenu'
import WorkerProfileSections from '@/components/worker/WorkerProfileSections'

const pageKeyframes = `
  @keyframes blockSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes fadeSlideUpToast { from { opacity: 0; transform: translateX(-50%) translateY(10px) } to { opacity: 1; transform: translateX(-50%) translateY(0) } }
`

type Profile = {
  id: string
  full_name: string
  email_address: string
  phone_number: string | null
  date_of_birth: string | null
  profile_photo_url: string | null
  role: string
}

export default function GuestWorkerProfilePage() {
  const [authId, setAuthId] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
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

      const res = await fetch(`/api/guest/profile?user_id=${storedAuthId}`)
      const data = await res.json()
      if (data.success) setProfile(data.profile)
    }
    void load()
  }, [])

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    await supabase.auth.signOut()

    localStorage.removeItem('tasking_user_id')
    localStorage.removeItem('tasking_user_role')
    localStorage.removeItem('tasking_company_id')
    localStorage.removeItem('tasking_active_session')
    sessionStorage.removeItem('tasking_session_active')

    window.location.href = '/signout'
  }

  return (
    <>
      <style>{pageKeyframes}</style>
      <header style={topBarStyle}>
        <div style={topBarInnerStyle}>
          <Link href="/" style={brandWrapStyle}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
              <rect width="32" height="32" rx="8" fill="#F97316" />
              <rect x="8" y="9" width="9" height="2.5" rx="1.25" fill="white" />
              <rect x="8" y="14.75" width="16" height="2.5" rx="1.25" fill="white" />
              <rect x="8" y="20.5" width="12" height="2.5" rx="1.25" fill="white" />
              <circle cx="22" cy="10.25" r="3.5" fill="#10B981" />
              <path
                d="M20.3 10.25L21.5 11.5L23.8 9"
                stroke="white"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <h1 style={headerTitleStyle}>Tasking</h1>
          </Link>

          <div style={rightHeaderStyle}>
            <Link href="/guest/applications" style={navLinkStyle}
              onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#D1D5DB' }}>
              My Applications
            </Link>
            <GuestProfileMenu profile={profile} onLogout={handleLogout} />
          </div>
        </div>
      </header>

      <main style={pageStyle}>
        <section style={{ maxWidth: 560, margin: '0 auto', animation: 'blockSlideUp 0.38s ease both 0.06s' }}>
          <div style={sectionHeaderStyle}>
            <p style={sectionLabelStyle}>WORKER PROFILE</p>
          </div>

          {authId && <WorkerProfileSections authId={authId} onToast={showToast} />}
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

const topBarStyle: React.CSSProperties = {
  height: 72,
  background: '#1C1C1E',
  color: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
}

const topBarInnerStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 32px',
}

const brandWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  textDecoration: 'none',
  cursor: 'pointer',
}

const headerTitleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: '1.0625rem',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  color: '#FFFFFF',
}

const rightHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
}

const navLinkStyle: React.CSSProperties = {
  color: '#D1D5DB',
  fontSize: '0.875rem',
  fontWeight: 600,
  textDecoration: 'none',
  transition: 'color 0.12s',
}

const pageStyle: React.CSSProperties = {
  minHeight: 'calc(100vh - 72px)',
  background: '#F3F4F6',
  padding: '42px 46px',
  fontFamily: 'var(--font-body)',
}

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 22,
}

const sectionLabelStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: '1rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  color: '#4B5563',
}
