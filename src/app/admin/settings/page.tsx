'use client'

import { useState, useEffect } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { Check, Eye, EyeOff } from 'lucide-react'

const ORANGE = '#F97316'
const TEXT = '#1C1917'
const BORDER = '#E2E8F0'
const MUTED = '#94A3B8'

export default function AdminSettingsPage() {
  const [adminUserId, setAdminUserId] = useState('')
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
    const authUid = localStorage.getItem('tasking_user_id')
    if (!authUid) return
    setAdminUserId(authUid)
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
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, current_password: currentPassword, new_password: newPassword }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.message ?? 'Failed to change password'); return }
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
    border: `1.5px solid ${BORDER}`, borderRadius: 10,
    padding: '11px 14px', fontSize: 14, color: TEXT,
    background: '#FFFFFF', outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 6,
  }

  const cardStyle: React.CSSProperties = {
    background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 16,
    padding: '28px 32px',
  }

  return (
    <main style={{ display: 'flex', minHeight: '100vh', background: '#27272A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <AdminSidebar />
      <section style={{ marginLeft: 64, padding: '36px 40px', flex: 1, background: 'transparent' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginBottom: 28 }}>
          <div>
            <p style={{ margin: '0 0 6px', color: '#64748B', fontSize: 11, letterSpacing: 1.4, fontWeight: 700, textTransform: 'uppercase' }}>Marketing Admin</p>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#F1F5F9', fontFamily: 'var(--font-heading)' }}>Settings</h1>
          </div>
          {adminUserId && <OwnerUserBadge userId={adminUserId} companyId="" />}
        </header>

        <div style={{ maxWidth: 520 }}>
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
          {/* Password */}
          <div style={{ ...cardStyle }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: TEXT }}>Change password</h2>
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
                    <button type="button" onClick={toggle} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: MUTED, display: 'flex', alignItems: 'center' }}>
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={savingPassword} style={{ background: ORANGE, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 800, cursor: savingPassword ? 'default' : 'pointer', opacity: savingPassword ? 0.75 : 1 }}>
                  {savingPassword ? 'Saving…' : 'Change password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}
