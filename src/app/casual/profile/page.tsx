'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CreditCard, User } from 'lucide-react'
import CasualSidebar from '@/components/CasualSidebar'
import WorkerProfileSections from '@/components/worker/WorkerProfileSections'

const pageKeyframes = `
  @keyframes blockSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes fadeSlideUpToast { from { opacity: 0; transform: translateX(-50%) translateY(10px) } to { opacity: 1; transform: translateX(-50%) translateY(0) } }
`

type PaymentMethod = 'paynow' | 'bank_transfer'

export default function CasualProfilePage() {
  const router = useRouter()
  const [internalUserId, setInternalUserId] = useState('')
  const [authUserId, setAuthUserId] = useState('')
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)

  // payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('paynow')
  const [paymentAccount, setPaymentAccount] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const userId = localStorage.getItem('tasking_user_id')

      if (!userId) {
        router.replace('/signin')
        return
      }

      const profileRes = await fetch(`/api/casual/profile?user_id=${userId}`)
      const profileData = await profileRes.json()

      if (cancelled) return

      if (!profileData.success) {
        router.replace('/signin')
        return
      }

      const u = profileData.profile.user
      setInternalUserId(u.id)
      setAuthUserId(userId)
      setUserName(u.full_name ?? 'Casual Worker')
      if (u.payment_method) setPaymentMethod(u.payment_method as PaymentMethod)
      if (u.payment_account) setPaymentAccount(u.payment_account)
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [router])

  const handleSavePayment = async () => {
    if (!paymentAccount.trim()) { setPaymentError('Please enter your account number.'); return }
    setPaymentSaving(true); setPaymentError('')
    try {
      const res = await fetch('/api/casual/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: internalUserId, payment_method: paymentMethod, payment_account: paymentAccount.trim() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save')
      showToast('Payment info saved successfully.')
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to save payment info')
    } finally {
      setPaymentSaving(false)
    }
  }

  return (
    <div style={pageStyle}>
      <style>{pageKeyframes}</style>
      <CasualSidebar />

      <main style={mainStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Profile</h1>

          {!loading && (
            <div style={userBadgeStyle}>
              <span style={userIconStyle}>
                <User size={14} strokeWidth={2.2} />
              </span>
              <span>{userName}</span>
            </div>
          )}
        </div>

        {!loading && (
          <div style={{ maxWidth: 480, animation: 'blockSlideUp 0.38s ease both 0.06s', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Worker Profile — skills, certificates, resume (shared with the Guest profile page) */}
            {authUserId && <WorkerProfileSections authId={authUserId} onToast={showToast} />}

            {/* Payment Information */}
            <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1.5px solid #E5E7EB', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CreditCard size={16} color="#EA580C" />
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>Payment Information</p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#6B7280' }}>How you receive your pay</p>
                </div>
              </div>

              {/* Method selector */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {(['paynow', 'bank_transfer'] as const).map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1.5px solid ${paymentMethod === m ? '#EA580C' : '#E5E7EB'}`, background: paymentMethod === m ? '#FFF7ED' : '#FAFAFA', color: paymentMethod === m ? '#EA580C' : '#6B7280', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                    {m === 'paynow' ? 'PayNow' : 'Bank Transfer'}
                  </button>
                ))}
              </div>

              {/* Account input */}
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                {paymentMethod === 'paynow' ? 'PayNow Number (mobile / NRIC)' : 'Bank Account Number'}
              </label>
              <input
                value={paymentAccount}
                onChange={e => setPaymentAccount(e.target.value)}
                placeholder={paymentMethod === 'paynow' ? 'e.g. +65 9123 4567 or S1234567A' : 'e.g. 123-456-789-0'}
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.9rem', color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF' }}
              />

              {paymentError && (
                <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: '#DC2626' }}>{paymentError}</p>
              )}

              <button onClick={handleSavePayment} disabled={paymentSaving}
                style={{ marginTop: 14, width: '100%', padding: '10px 0', background: paymentSaving ? '#9CA3AF' : '#EA580C', color: '#FFFFFF', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9375rem', cursor: paymentSaving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {paymentSaving ? 'Saving…' : <><Check size={15} /> Save Payment Info</>}
              </button>
            </div>
          </div>
        )}
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
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  background: '#F3F4F6',
  fontFamily: 'var(--font-body)',
}

const mainStyle: React.CSSProperties = {
  marginLeft: '64px',
  flex: 1,
  minHeight: '100vh',
  padding: '24px 32px',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingBottom: '22px',
  borderBottom: '1px solid #E5E7EB',
  marginBottom: '24px',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.75rem',
  fontWeight: 700,
  color: '#111827',
  letterSpacing: '-0.04em',
}

const userBadgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '5px 12px 5px 7px',
  borderRadius: '999px',
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  boxShadow: '0 2px 8px rgba(15,23,42,0.12)',
  color: '#111827',
  fontSize: '0.82rem',
  fontWeight: 700,
}

const userIconStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: '999px',
  background: '#334155',
  color: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const emptyTextStyle: React.CSSProperties = {
  margin: 0,
  color: '#6B7280',
  fontSize: '0.95rem',
}