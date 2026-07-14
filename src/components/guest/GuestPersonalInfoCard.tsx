'use client'

// Personal Information card for the Guest User's Profile page. Renders inline (no modal) as a
// sibling of the Skills / Certificates / Resume cards, using the same card chrome. Reads and
// writes through the same user APIs the shared OwnerUserBadge modal used.

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User, Check, Pencil, Camera } from 'lucide-react'
import DatePickerField from '@/components/DatePickerField'

const DATE_DISPLAY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function formatDateDisplay(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')} ${DATE_DISPLAY_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function Avatar({ photoUrl, size = 48 }: { photoUrl?: string | null; size?: number }) {
  if (photoUrl) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: 999, flexShrink: 0, overflow: 'hidden' }}>
        <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </span>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: 999, background: '#0F172A', color: '#FFFFFF', flexShrink: 0 }}>
      <User size={Math.round(size * 0.46)} />
    </span>
  )
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

export default function GuestPersonalInfoCard({ userId, onToast }: { userId: string; onToast?: (msg: string) => void }) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchProfile = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/user/me?user_id=${userId}`)
      const data = await res.json()
      if (data.success && data.user) setProfile(data.user)
    } catch {}
  }, [userId])

  useEffect(() => { void fetchProfile() }, [fetchProfile])

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true); setError('')
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const ext = file.name.split('.').pop() ?? 'jpg'
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { data, error: uploadError } = await supabase.storage.from('avatars').upload(filename, file, { contentType: file.type })
      if (uploadError || !data) throw new Error('Photo upload failed')
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path)
      setPhotoUrl(publicUrl)
    } catch {
      setError('Failed to upload photo. Please try again.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const startEdit = () => {
    setName(profile?.full_name ?? '')
    setPhone(profile?.phone_number ?? '')
    setDob(profile?.date_of_birth ?? '')
    setPhotoUrl(profile?.profile_photo_url ?? null)
    setError('')
    setEditing(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Full name is required'); return }
    if (!phone) { setError('Phone number is required'); return }
    if (phone.length !== 8) { setError('Phone number must be exactly 8 digits'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/user/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, full_name: name, phone_number: phone, date_of_birth: dob, profile_photo_url: photoUrl }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.message ?? 'Update failed'); return }
      setProfile(prev => prev ? { ...prev, full_name: data.user.full_name, phone_number: data.user.phone_number, date_of_birth: data.user.date_of_birth, profile_photo_url: data.user.profile_photo_url } : prev)
      setEditing(false)
      onToast?.('Profile updated successfully.')
    } catch {
      setError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <User size={16} color="#EA580C" />
          </div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>Personal Information</p>
        </div>
        {!editing && (
          <button type="button" onClick={startEdit}
            style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg, #F97316, #EA580C)', fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Pencil size={13} /> Edit Profile
          </button>
        )}
      </div>

      {/* Avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Avatar photoUrl={editing ? photoUrl : profile?.profile_photo_url} size={48} />
          {editing && (
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto} title="Change photo"
              style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 999, background: '#F97316', border: '2px solid #FFFFFF', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploadingPhoto ? 'not-allowed' : 'pointer', padding: 0 }}>
              {uploadingPhoto ? <Spinner size={11} /> : <Camera size={12} />}
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
        </div>
        <p style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#0F172A', margin: 0 }}>{profile?.full_name ?? '—'}</p>
      </div>

      {/* Fields */}
      <form onSubmit={handleSave}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
            <label style={labelStyle}>Email Address</label>
            <p style={valueStyle}>{profile?.email_address ?? '—'}</p>
          </div>
          <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
            <label style={labelStyle}>Full Name</label>
            {editing
              ? <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} autoFocus />
              : <p style={valueStyle}>{profile?.full_name ?? '—'}</p>}
          </div>
          <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
            <label style={labelStyle}>Date of Birth</label>
            {editing
              ? <DatePickerField value={dob} onChange={setDob} placeholder="Select date" max={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 16); return d.toISOString().slice(0, 10) })()} />
              : <p style={valueStyle}>{formatDateDisplay(profile?.date_of_birth)}</p>}
          </div>
          <div style={{ padding: '14px 0', borderBottom: editing ? '1px solid #F3F4F6' : 'none' }}>
            <label style={labelStyle}>Phone Number</label>
            {editing
              ? <input type="tel" value={phone} onChange={e => { setPhone(e.target.value.replace(/\D/g, '')); setError('') }} maxLength={8} style={inputStyle} placeholder="91234567" />
              : <p style={valueStyle}>{profile?.phone_number ?? '—'}</p>}
          </div>

          {error && (
            <div style={{ padding: '12px 0 4px' }}>
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626' }}>{error}</div>
            </div>
          )}
        </div>

        {editing && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={() => { setEditing(false); setError(''); setPhotoUrl(profile?.profile_photo_url ?? null) }}
              style={{ padding: '7px 16px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', fontWeight: 600, fontSize: '0.8125rem', color: '#374151', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '7px 18px', border: 'none', borderRadius: 8, background: saving ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.65 : 1 }}>
              {saving ? <Spinner size={13} /> : <Check size={13} />} Save Changes
            </button>
          </div>
        )}
      </form>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 14,
  border: '1.5px solid #E5E7EB',
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: 4,
}

const valueStyle: React.CSSProperties = {
  fontSize: '0.9375rem', color: '#111827', margin: 0,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8,
  fontSize: '0.9375rem', color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
}
