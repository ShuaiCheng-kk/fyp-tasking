'use client'

import { useEffect, useRef, useState } from 'react'
import { LogOut, User } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

type Profile = {
  id: string
  full_name: string
  email_address: string
  phone_number: string | null
  date_of_birth: string | null
  profile_photo_url: string | null
  role: string
}

export default function GuestProfileMenu({
  profile,
  onLogout,
}: {
  profile: Profile | null
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(profile)
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCurrentProfile(profile)
    setFullName(profile?.full_name || '')
    setPhoneNumber(profile?.phone_number || '')
    setDateOfBirth(profile?.date_of_birth || '')
    setPhotoUrl(profile?.profile_photo_url || null)
  }, [profile])

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const ext = file.name.split('.').pop() ?? 'jpg'
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filename, file, { contentType: file.type })
      if (uploadError || !data) throw new Error('Photo upload failed')
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path)
      setPhotoUrl(publicUrl)
    } catch {
      setError('Failed to upload photo. Please try again.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError('')

      const authId = localStorage.getItem('tasking_user_id')
      if (!authId) throw new Error('Missing user id')

      const res = await fetch(`/api/guest/profile?user_id=${authId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          phone_number: phoneNumber || null,
          date_of_birth: dateOfBirth || null,
          profile_photo_url: photoUrl || null,
        }),
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update profile')

      setCurrentProfile(data.profile)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditing(false)
    setFullName(currentProfile?.full_name || '')
    setPhoneNumber(currentProfile?.phone_number || '')
    setDateOfBirth(currentProfile?.date_of_birth || '')
    setPhotoUrl(currentProfile?.profile_photo_url || null)
    setError('')
  }

  const avatarSrc = editing ? photoUrl : currentProfile?.profile_photo_url

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={profileTriggerStyle}>
        {currentProfile?.profile_photo_url ? (
          <img
            src={currentProfile.profile_photo_url}
            alt="avatar"
            style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <User size={16} strokeWidth={2.2} />
        )}
        <span style={userNameStyle}>{profile?.full_name || 'Guest'}</span>
      </button>

      {open && (
        <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) { setOpen(false); setEditing(false); setError('') } }}>
          <aside style={panelStyle}>
            <div style={panelHeaderStyle}>
              <h2 style={titleStyle}>My Profile</h2>
              <button
                type="button"
                onClick={() => { setOpen(false); setEditing(false); setError('') }}
                style={closeButtonStyle}
              >
                Close
              </button>
            </div>

            <div style={cardStyle}>
              <div style={profileTopStyle}>
                {/* Avatar */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt="avatar"
                      style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #4B5563' }}
                    />
                  ) : (
                    <div style={avatarStyle}>
                      {(currentProfile?.full_name || 'G').charAt(0).toUpperCase()}
                    </div>
                  )}
                  {editing && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      style={photoEditBtnStyle}
                      title="Change photo"
                    >
                      {uploadingPhoto ? '…' : '✎'}
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handlePhotoChange}
                  />
                </div>

                <div>
                  <span style={roleBadgeStyle}>Guest User</span>
                  <h3 style={nameStyle}>{currentProfile?.full_name || 'Guest'}</h3>
                  <p style={emailStyle}>{currentProfile?.email_address || '-'}</p>
                </div>
              </div>

              <div style={dividerStyle} />

              {editing ? (
                <>
                  <FormField label="Full Name" value={fullName} onChange={setFullName} />
                  <ProfileField label="Email" value={currentProfile?.email_address || '-'} />
                  <FormField label="Phone Number" value={phoneNumber} onChange={setPhoneNumber} />
                  <DateField label="Date of Birth" value={dateOfBirth} onChange={setDateOfBirth} />

                  {error && <p style={errorStyle}>{error}</p>}

                  <div style={buttonRowStyle}>
                    <button type="button" onClick={handleSave} style={saveButtonStyle} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={handleCancelEdit} style={cancelButtonStyle}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <ProfileField label="Full Name" value={currentProfile?.full_name || 'Not added'} />
                  <ProfileField label="Email" value={currentProfile?.email_address || 'Not added'} />
                  <ProfileField label="Phone Number" value={currentProfile?.phone_number || 'Not added'} />
                  <ProfileField
                    label="Date of Birth"
                    value={currentProfile?.date_of_birth
                      ? new Date(currentProfile.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                      : 'Not added'}
                  />

                  <button type="button" onClick={() => setEditing(true)} style={editButtonStyle}>
                    Edit Profile
                  </button>
                </>
              )}
            </div>

            <button onClick={onLogout} style={logoutButtonStyle}>
              <LogOut size={18} />
              <span>Log Out</span>
            </button>
          </aside>
        </div>
      )}
    </>
  )
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={fieldLabelStyle}>{label}</p>
      <p style={fieldValueStyle}>{value}</p>
    </div>
  )
}

function FormField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={fieldLabelStyle}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </div>
  )
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={fieldLabelStyle}>{label}</label>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
    </div>
  )
}

const profileTriggerStyle: React.CSSProperties = {
  border: '1px solid #D1D5DB',
  background: '#FFFFFF',
  color: '#111827',
  padding: '7px 14px',
  borderRadius: 999,
  fontSize: '0.875rem',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const userNameStyle: React.CSSProperties = {
  color: '#111827',
  fontSize: '0.875rem',
  fontWeight: 700,
  whiteSpace: 'nowrap',
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.45)',
  zIndex: 999,
  display: 'flex',
  justifyContent: 'flex-end',
}

const panelStyle: React.CSSProperties = {
  width: 420,
  maxWidth: '100%',
  height: '100vh',
  background: '#F3F4F6',
  padding: '34px',
  overflowY: 'auto',
  fontFamily: 'var(--font-body)',
}

const panelHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 28,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: '1.375rem',
  fontWeight: 700,
  color: '#111827',
}

const closeButtonStyle: React.CSSProperties = {
  border: 'none',
  background: '#1C1C1E',
  color: '#FFFFFF',
  padding: '9px 14px',
  borderRadius: 10,
  fontSize: '0.8125rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const cardStyle: React.CSSProperties = {
  background: '#1C1C1E',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: 24,
  boxShadow: '0 12px 28px rgba(0,0,0,0.25)',
}

const profileTopStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 18,
}

const avatarStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: '50%',
  background: '#F9FAFB',
  color: '#1F2937',
  display: 'grid',
  placeItems: 'center',
  fontSize: '1.5rem',
  fontWeight: 700,
  border: '1px solid #4B5563',
}

const photoEditBtnStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  right: 0,
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: '#F97316',
  border: 'none',
  color: '#fff',
  fontSize: '0.7rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const roleBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 12px',
  borderRadius: 999,
  background: '#374151',
  color: '#F9FAFB',
  fontSize: '0.8125rem',
  fontWeight: 700,
  marginBottom: 10,
}

const nameStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: '1.25rem',
  fontWeight: 700,
  color: '#FFFFFF',
}

const emailStyle: React.CSSProperties = {
  margin: '6px 0 0',
  fontSize: '0.875rem',
  color: '#D1D5DB',
}

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: '#374151',
  margin: '24px 0',
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  margin: '0 0 7px',
  fontFamily: 'var(--font-heading)',
  fontSize: '0.8125rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#9CA3AF',
}

const fieldValueStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.875rem',
  fontWeight: 700,
  color: '#F9FAFB',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #4B5563',
  background: '#111827',
  color: '#F9FAFB',
  padding: '11px 12px',
  borderRadius: 10,
  fontSize: '0.875rem',
  fontWeight: 700,
  outline: 'none',
  boxSizing: 'border-box',
}

const editButtonStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 8,
  padding: '11px 14px',
  borderRadius: 10,
  border: 'none',
  background: '#F97316',
  color: '#FFFFFF',
  fontSize: '0.8125rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const buttonRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 8,
}

const saveButtonStyle: React.CSSProperties = {
  padding: '11px 14px',
  borderRadius: 10,
  border: 'none',
  background: '#F97316',
  color: '#FFFFFF',
  fontSize: '0.8125rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const cancelButtonStyle: React.CSSProperties = {
  padding: '11px 14px',
  borderRadius: 10,
  border: '1px solid #4B5563',
  background: '#1F2937',
  color: '#F9FAFB',
  fontSize: '0.8125rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const errorStyle: React.CSSProperties = {
  margin: '0 0 12px',
  color: '#FCA5A5',
  fontSize: '0.8125rem',
  fontWeight: 700,
}

const logoutButtonStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 24,
  padding: '11px 14px',
  borderRadius: 10,
  border: '1px solid rgba(239,68,68,0.35)',
  background: 'rgba(239,68,68,0.12)',
  color: '#EF4444',
  fontSize: '0.875rem',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
}
