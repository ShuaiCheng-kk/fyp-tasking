'use client'

// Guest User's Worker Profile page — the long-lived profile (skills, certificates, resume)
// that gets snapshotted into every job application. Renders the same shared sections the
// Casual Worker profile page uses; the chrome (sidebar + header) comes from the guest layout.

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import GuestPersonalInfoCard from '@/components/guest/GuestPersonalInfoCard'
import { SkillsCard, CertificatesCard, ResumeCard, ProfileCardSkeleton } from '@/components/worker/WorkerProfileSections'
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport'
import { useLayoutWorkerProfile } from '@/app/guest/layout'
import type { WorkerProfile } from '@/types/WorkerProfile'

const pageKeyframes = `
  @keyframes blockSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes fadeSlideUpToast { from { opacity: 0; transform: translateX(-50%) translateY(10px) } to { opacity: 1; transform: translateX(-50%) translateY(0) } }
`

export default function GuestWorkerProfilePage() {
  // guest/layout.tsx already fetched the full WorkerProfile for its own role-guard check before
  // this page ever mounts — reuse that instead of the page redoing the exact same
  // `/api/guest/profile` round trip a second time (2026-07-31). The 4 cards below each used to
  // ALSO run their own identical fetch on top of that, popping in independently whenever their
  // own request happened to resolve; loading it once and handing every card its slice as a prop
  // makes them render together, same as the Owner pages' single-`loading`-gate skeleton pattern.
  const layoutProfile = useLayoutWorkerProfile()
  // Single column on phone; the section below still scrolls internally, same as desktop.
  const isPhone = useIsCompactViewport(640)
  const [profile, setProfile] = useState<WorkerProfile | null>(layoutProfile)
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    if (layoutProfile) { setProfile(layoutProfile); return }
    // Fallback for the rare case the layout's own fetch hit its error path (transient failure) —
    // fetch directly instead of leaving the page stuck on skeletons forever.
    const load = async () => {
      const storedAuthId = localStorage.getItem('tasking_user_id')
      if (!storedAuthId) {
        window.location.href = '/signin'
        return
      }
      const res = await fetch(`/api/guest/profile?user_id=${storedAuthId}`)
      const data = await res.json()
      if (data.success) setProfile(data.profile)
    }
    void load()
  }, [layoutProfile])

  return (
    <>
      <style>{pageKeyframes}</style>

      <main style={isPhone ? { ...pageStyle, padding: '12px 12px 12px' } : pageStyle}>
        {/* Page header — title left, matching the Owner pages */}
        <div style={{ marginBottom: isPhone ? 14 : 20, flexShrink: 0 }}>
          <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
            My Profile
          </h1>
        </div>

        {/* The profile grid is the page's scroll block — the header above stays fixed and this
            section scrolls internally once the cards outgrow the viewport. Keyed on whether the
            single fetch above has landed, so the real cards mount fresh (and replay the entrance
            animation) right when they're ready instead of an already-settled shell sitting there
            from first paint. */}
        <section key={profile ? 'ready' : 'loading'} style={{ maxWidth: 1080, margin: '0 auto', width: '100%', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'grid', gridTemplateColumns: isPhone ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start', animation: 'blockSlideUp 0.38s ease both' }}>
          {profile ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <GuestPersonalInfoCard initialProfile={profile} onToast={showToast} />
                <SkillsCard authId={profile.supabase_auth_id} profile={profile} onToast={showToast} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <CertificatesCard authId={profile.supabase_auth_id} profile={profile} onToast={showToast} />
                <ResumeCard authId={profile.supabase_auth_id} profile={profile} onToast={showToast} />
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <ProfileCardSkeleton lines={4} />
                <ProfileCardSkeleton lines={1} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <ProfileCardSkeleton lines={2} />
                <ProfileCardSkeleton lines={1} />
              </div>
            </>
          )}
        </section>
      </main>

      {toast && (
        <div style={{
          // Phone: clear the 64px bottom tab bar instead of sitting on top of it.
          position: 'fixed', bottom: isPhone ? 76 : 28, left: '50%', transform: 'translateX(-50%)',
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
// The guest layout's <main> is locked to one viewport — this page fills it as a flex column.
const pageStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  padding: '20px 28px 28px',
}
