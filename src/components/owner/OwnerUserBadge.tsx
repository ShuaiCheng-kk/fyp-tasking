'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Crown, X, Check, Pencil } from 'lucide-react'
import DatePickerField from '@/components/DatePickerField'

const keyframes = `
  @keyframes oubOverlayIn  { from { opacity: 0 } to { opacity: 1 } }
  @keyframes oubModalIn    { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
  @keyframes oubFieldsIn   { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
`

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function Avatar({ photoUrl, name, size = 26 }: { photoUrl?: string | null; name: string; size?: number }) {
  if (photoUrl) {
    return <img src={photoUrl} alt={name} style={{ width: size, height: size, borderRadius: 999, objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: 999, background: '#0F172A', color: '#FFFFFF', flexShrink: 0 }}>
      <Crown size={Math.round(size * 0.5)} />
    </span>
  )
}

function BigAvatar({ photoUrl, name, size = 44 }: { photoUrl?: string | null; name: string; size?: number }) {
  if (photoUrl) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: 999, flexShrink: 0, overflow: 'hidden' }}>
        <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </span>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: 999, background: '#0F172A', color: '#FFFFFF', flexShrink: 0 }}>
      <Crown size={Math.round(size * 0.42)} />
    </span>
  )
}

function formatDateDisplay(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB',
  borderRadius: 8, fontSize: '0.9375rem', fontFamily: "'Inter', system-ui, sans-serif",
  color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 600, fontSize: '0.75rem',
  color: '#6B7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em',
}

interface ProfileData {
  id: string
  full_name: string
  email_address: string
  phone_number: string | null
  date_of_birth: string | null
  role: string
  profile_photo_url?: string | null
}

export default function OwnerUserBadge({ userId, companyId }: { userId: string; companyId: string }) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Fetch profile on first open or when userId available
  const fetchProfile = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/user/me?user_id=${userId}`)
      const data = await res.json()
      if (data.success && data.user) setProfile(data.user)
    } catch {}
  }, [userId])

  useEffect(() => {
    if (userId) fetchProfile()
  }, [userId, fetchProfile])

  const handleOpen = () => {
    setOpen(true)
    setEditing(false)
    setError('')
    if (!profile && userId) fetchProfile()
  }

  const handleClose = () => {
    setOpen(false)
    setEditing(false)
    setError('')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Full name is required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/user/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, full_name: name, phone_number: phone, date_of_birth: dob }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.message ?? 'Update failed'); return }
      setProfile(prev => prev ? { ...prev, full_name: data.user.full_name, phone_number: data.user.phone_number, date_of_birth: data.user.date_of_birth } : prev)
      setEditing(false)
    } catch { setError('Something went wrong') }
    finally { setSaving(false) }
  }

  const modal = open && mounted ? createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'oubOverlayIn 0.18s ease-out',
    }}>
      <style>{keyframes}</style>
      <div style={{ width: 'min(420px, calc(100% - 32px))' }}>
        <div style={{
          background: '#FFFFFF', borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)',
          maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column',
          animation: 'oubModalIn 0.22s cubic-bezier(0.16,1,0.3,1)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
            <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>My Profile</h2>
            <button
              onClick={handleClose}
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8, flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Avatar + name hero */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 14 }}>
            <BigAvatar photoUrl={profile?.profile_photo_url} name={profile?.full_name ?? ''} size={44} />
            <div>
              <p style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', margin: '0 0 5px' }}>{profile?.full_name ?? '—'}</p>
              <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: '#0F172A', color: '#FFFFFF' }}>
                {profile?.role ?? 'Owner'}
              </span>
            </div>
          </div>

          {/* Fields */}
          <form onSubmit={handleSave}>
            <div key={String(editing)} style={{ padding: '0 24px 4px', display: 'flex', flexDirection: 'column', animation: 'oubFieldsIn 0.22s ease both' }}>
              {/* Email — read only */}
              <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                <label style={labelStyle}>Email Address</label>
                <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0 }}>{profile?.email_address ?? '—'}</p>
              </div>
              {/* Full Name */}
              <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                <label style={labelStyle}>Full Name</label>
                {editing
                  ? <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} autoFocus />
                  : <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0 }}>{profile?.full_name ?? '—'}</p>}
              </div>
              {/* Date of Birth */}
              <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                <label style={labelStyle}>Date of Birth</label>
                {editing
                  ? <DatePickerField value={dob} onChange={setDob} placeholder="Select date" />
                  : <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0 }}>{formatDateDisplay(profile?.date_of_birth)}</p>}
              </div>
              {/* Phone */}
              <div style={{ padding: '14px 0', borderBottom: editing && error ? '1px solid #F3F4F6' : 'none' }}>
                <label style={labelStyle}>Phone Number</label>
                {editing
                  ? <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="+65 9xxx xxxx" />
                  : <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0 }}>{profile?.phone_number ?? '—'}</p>}
              </div>
              {editing && error && (
                <div style={{ padding: '12px 0 4px' }}>
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626' }}>{error}</div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {editing ? (
                <>
                  <button type="button" onClick={() => { setEditing(false); setError('') }} style={{ padding: '7px 16px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', fontWeight: 600, fontSize: '0.8125rem', color: '#374151', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, background: saving ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.65 : 1 }}>
                    {saving ? <Spinner size={13} /> : <Check size={13} />} Save Changes
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => { setName(profile?.full_name ?? ''); setPhone(profile?.phone_number ?? ''); setDob(profile?.date_of_birth ?? ''); setError(''); setEditing(true) }} style={{ padding: '7px 16px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg, #F97316, #EA580C)', fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Pencil size={13} /> Edit Profile
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(249,115,22,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none' }}
      >
        <Avatar photoUrl={profile?.profile_photo_url} name={profile?.full_name ?? ''} size={26} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{profile?.full_name ?? '—'}</span>
      </button>
      {modal}
    </>
  )
}
