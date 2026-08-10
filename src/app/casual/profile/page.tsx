'use client'

// Casual Worker's Profile page — same two-column layout and card language as Guest's Profile
// page (Personal Info + Skills on the left, Certificates + Resume on the right), plus one Payment
// Information card a Guest User doesn't have, placed at the bottom of the left column. A Casual
// Worker is just a confirmed Guest User, so everything else is the exact same shared component.
//
// First login (no payment info on file yet): the other four cards are dimmed and locked so the
// worker's eye goes straight to Payment Information — the one thing blocking the rest of the app.

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, CreditCard } from 'lucide-react'
import GuestPersonalInfoCard from '@/components/guest/GuestPersonalInfoCard'
import { SkillsCard, CertificatesCard, ResumeCard, ProfileCardSkeleton } from '@/components/worker/WorkerProfileSections'
import { TitledBlock } from '@/components/panel'
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport'
import type { WorkerProfile } from '@/types/WorkerProfile'

const pageKeyframes = `
  @keyframes blockSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes fadeSlideUpToast { from { opacity: 0; transform: translateX(-50%) translateY(10px) } to { opacity: 1; transform: translateX(-50%) translateY(0) } }
`

type PaymentMethod = 'paynow' | 'bank_transfer'

// Locks out interaction and visually recedes a card the worker shouldn't be touching yet, without
// unmounting it (their data is still there once the gate lifts).
const lockedWrapperStyle: React.CSSProperties = {
  opacity: 0.4,
  filter: 'grayscale(60%)',
  pointerEvents: 'none',
  userSelect: 'none',
  transition: 'opacity 0.25s ease',
}

function Spinner({ size = 13 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function PaymentInformationCard({
  internalUserId, initialMethod, initialAccount, onToast, onSaved,
}: {
  internalUserId: string
  initialMethod: PaymentMethod
  initialAccount: string
  onToast: (msg: string) => void
  onSaved: (savedAccount: string) => void
}) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialMethod)
  const [paymentAccount, setPaymentAccount] = useState(initialAccount)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!paymentAccount.trim()) { setError('Please enter your account number.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/casual/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // casualProfileRepository.updatePaymentInfo matches on users.id (not supabase_auth_id),
        // so the PATCH must use the internal user id or it silently updates zero rows.
        body: JSON.stringify({ user_id: internalUserId, payment_method: paymentMethod, payment_account: paymentAccount.trim() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save')
      onToast('Payment info saved successfully.')
      onSaved(paymentAccount.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payment info')
    } finally {
      setSaving(false)
    }
  }

  return (
    <TitledBlock
      icon={<CreditCard size={15} color="#F97316" />}
      title="Payment Information"
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['paynow', 'bank_transfer'] as const).map(m => (
          <button key={m} type="button" onClick={() => setPaymentMethod(m)}
            style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1.5px solid ${paymentMethod === m ? '#EA580C' : '#E5E7EB'}`, background: paymentMethod === m ? '#FFF7ED' : '#FAFAFA', color: paymentMethod === m ? '#EA580C' : '#6B7280', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
            {m === 'paynow' ? 'PayNow' : 'Bank Transfer'}
          </button>
        ))}
      </div>

      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: 4 }}>
        {paymentMethod === 'paynow' ? 'PayNow Number (mobile / NRIC)' : 'Bank Account Number'}
      </label>
      <input
        value={paymentAccount}
        onChange={e => setPaymentAccount(e.target.value)}
        placeholder={paymentMethod === 'paynow' ? 'e.g. +65 9123 4567 or S1234567A' : 'e.g. 123-456-789-0'}
        style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.9375rem', color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF' }}
      />

      {error && (
        <div style={{ padding: '12px 0 4px' }}>
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626' }}>{error}</div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" onClick={handleSave} disabled={saving}
          style={{ padding: '7px 18px', border: 'none', borderRadius: 8, background: saving ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.65 : 1 }}>
          {saving ? <Spinner /> : <Check size={13} />} {saving ? 'Saving…' : 'Save Payment Info'}
        </button>
      </div>
    </TitledBlock>
  )
}

export default function CasualProfilePage() {
  // Single column on phone; the section below still scrolls internally, same as desktop.
  const isPhone = useIsCompactViewport(640)
  // One fetch for the whole profile (personal info + skills + certificates + resume) instead of
  // each card below running its own identical `/api/guest/profile` fetch — same fix as Guest's
  // Profile page (2026-07-31). Payment info stays a separate parallel fetch since it's
  // Casual-Worker-only and doesn't live on WorkerProfile.
  const [profile, setProfile] = useState<WorkerProfile | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('paynow')
  const [paymentAccount, setPaymentAccount] = useState('')
  const [paymentLoaded, setPaymentLoaded] = useState(false)
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

      const [profileRes, casualRes] = await Promise.all([
        fetch(`/api/guest/profile?user_id=${storedAuthId}`),
        fetch(`/api/casual/profile?user_id=${storedAuthId}`),
      ])
      const profileData = await profileRes.json()
      if (profileData.success) setProfile(profileData.profile)

      const casualData = await casualRes.json()
      if (casualData.success) {
        const u = casualData.profile.user
        if (u.payment_method) setPaymentMethod(u.payment_method as PaymentMethod)
        setPaymentAccount(u.payment_account ?? '')
      }
      setPaymentLoaded(true)
    }
    void load()
  }, [])

  const paymentMissing = paymentLoaded && !paymentAccount

  const handlePaymentSaved = (savedAccount: string) => {
    // First-time completion (the gate case): the whole account just unlocked, so land the
    // worker on their dashboard instead of leaving them on the now-unlocked profile page.
    if (paymentMissing) {
      window.location.href = '/casual/dashboard'
      return
    }
    setPaymentAccount(savedAccount)
    // Saving happens without a navigation, so the layout's payment-gate check (keyed on
    // pathname) never re-runs on its own — tell it to re-check now so the sidebar unlocks.
    window.dispatchEvent(new Event('casual:payment-updated'))
  }

  return (
    <>
      <style>{pageKeyframes}</style>

      <main style={isPhone ? { ...pageStyle, height: '100%', padding: '12px 12px 12px' } : pageStyle}>
        <div style={{ marginBottom: 20, flexShrink: 0 }}>
          <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
            My Profile
          </h1>
        </div>

        {paymentMissing && (
          <div style={{ maxWidth: 1080, margin: '0 auto 16px', width: '100%', flexShrink: 0, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 12, color: '#9A3412', fontSize: '0.875rem', fontWeight: 700 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, color: '#EA580C' }} />
            Add your payment details below to unlock the rest of your account.
          </div>
        )}

        {/* The profile grid is the page's scroll block — the header (and banner) above stay fixed
            and this section scrolls internally once the cards outgrow the viewport, same pattern
            as Guest's Worker Profile page and the Owner pages.
            Keyed on whether both fetches above have landed, so this block — and its entrance
            animation — mounts fresh right when the real cards are ready, instead of animating an
            already-empty shell the instant the page mounts and settling long before the API
            round-trips actually return anything to show. */}
        <section key={(profile && paymentLoaded) ? 'ready' : 'loading'} style={isPhone
          ? { maxWidth: 1080, margin: '0 auto', width: '100%', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr', gap: 16, alignItems: 'start', animation: 'blockSlideUp 0.38s ease both' }
          : { maxWidth: 1080, margin: '0 auto', width: '100%', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start', animation: 'blockSlideUp 0.38s ease both' }}>
          {profile && paymentLoaded ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={paymentMissing ? lockedWrapperStyle : undefined}>
                  <GuestPersonalInfoCard initialProfile={profile} onToast={showToast} />
                </div>
                <div style={paymentMissing ? lockedWrapperStyle : undefined}>
                  <SkillsCard authId={profile.supabase_auth_id} profile={profile} onToast={showToast} />
                </div>
                <PaymentInformationCard
                  internalUserId={profile.id}
                  initialMethod={paymentMethod}
                  initialAccount={paymentAccount}
                  onToast={showToast}
                  onSaved={handlePaymentSaved}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={paymentMissing ? lockedWrapperStyle : undefined}>
                  <CertificatesCard authId={profile.supabase_auth_id} profile={profile} onToast={showToast} />
                </div>
                <div style={paymentMissing ? lockedWrapperStyle : undefined}>
                  <ResumeCard authId={profile.supabase_auth_id} profile={profile} onToast={showToast} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <ProfileCardSkeleton lines={4} />
                <ProfileCardSkeleton lines={1} />
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

const pageStyle: React.CSSProperties = {
  height: '100vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  padding: '20px 28px 28px',
}
