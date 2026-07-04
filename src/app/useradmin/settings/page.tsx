'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Check, Eye, EyeOff } from 'lucide-react'
import UserAdminSidebar from '@/components/UserAdminSidebar'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'

const SIDEBAR_WIDTH = 64

const T = {
  bg:      '#27272A',
  surface: '#FFFFFF',
  border:  '#E2E8F0',
  text1:   '#0F172A',
  text3:   '#94A3B8',
  accent:  '#F97316',
}

export default function UserAdminSettingsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/signin')
    })
    supabase.auth.getSession().catch(() => router.replace('/signin'))
    return () => subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    const authUid = localStorage.getItem('tasking_user_id')
    if (!authUid) return
    setUserId(authUid)
    fetch(`/api/user/me?user_id=${authUid}`)
      .then(r => r.json())
      .then(d => { if (d.success) setEmail(d.user.email_address ?? '') })
  }, [])

  const showNotice = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 3500)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) { setError('New passwords do not match'); return }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return }
    setSavingPassword(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
      if (signInErr) { setError('Current password is incorrect'); setSavingPassword(false); return }
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
      if (updateErr) { setError(updateErr.message); setSavingPassword(false); return }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showNotice('Password changed successfully')
    } catch {
      setError('Something went wrong')
    } finally {
      setSavingPassword(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    border: `1.5px solid ${T.border}`, borderRadius: 10,
    padding: '11px 14px', fontSize: 14, color: T.text1,
    background: '#FFFFFF', outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 700, color: T.text1, marginBottom: 6,
  }

  const cardStyle: React.CSSProperties = {
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12,
    padding: '28px 32px',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <UserAdminSidebar />
      <div style={{ marginLeft: SIDEBAR_WIDTH, flex: 1, minWidth: 0, background: 'transparent' }}>
        <div style={{ padding: '24px 32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontWeight: 800, fontSize: '1.75rem', color: '#F1F5F9', margin: 0, letterSpacing: '-0.025em' }}>Settings</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {userId && <OwnerUserBadge userId={userId} companyId="" />}
          </div>
        </div>

        <div style={{ padding: '20px 32px 32px', maxWidth: 480 }}>
          {notice && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, background: '#ECFDF5', border: '1px solid #BBF7D0', color: '#047857', borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 700 }}>
              <Check size={15} /> {notice}
            </div>
          )}
          {error && (
            <div style={{ marginBottom: 16, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 700 }}>
              {error}
            </div>
          )}

          <div style={cardStyle}>
            <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: T.text1 }}>Change password</h2>
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Current password', value: currentPassword, set: setCurrentPassword, show: showCurrent, toggle: () => setShowCurrent(v => !v) },
                { label: 'New password', value: newPassword, set: setNewPassword, show: showNew, toggle: () => setShowNew(v => !v) },
                { label: 'Confirm new password', value: confirmPassword, set: setConfirmPassword, show: showConfirm, toggle: () => setShowConfirm(v => !v) },
              ].map(({ label, value, set, show, toggle }) => (
                <div key={label}>
                  <label style={labelStyle}>{label}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={show ? 'text' : 'password'}
                      style={{ ...inputStyle, paddingRight: 44 }}
                      value={value}
                      onChange={e => set(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                    <button type="button" onClick={toggle} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.text3, display: 'flex', alignItems: 'center' }}>
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={savingPassword} style={{ background: T.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 800, cursor: savingPassword ? 'default' : 'pointer', opacity: savingPassword ? 0.75 : 1 }}>
                  {savingPassword ? 'Saving…' : 'Change password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
