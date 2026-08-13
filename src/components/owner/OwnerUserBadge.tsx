'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import { Crown, X, Check, Pencil, Camera, Eye, EyeOff, KeyRound } from 'lucide-react'
import DatePickerField from '@/components/DatePickerField'
import Toast from '@/components/Toast'
import { isValidImageFile, prepareAvatarForUpload } from '@/lib/imageValidation'

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

// "01 Jul 2026" — fixed 3-letter months (en-GB Intl renders September as "Sept")
const DATE_DISPLAY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function formatDateDisplay(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')} ${DATE_DISPLAY_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB',
  borderRadius: 8, fontSize: '0.9375rem', fontFamily: "'Inter', system-ui, sans-serif",
  color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
}
// Matches the shared modalLabelStyle used by the Team member-profile modal
const labelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 600, fontSize: '0.875rem',
  color: '#374151', marginBottom: 4,
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
  // "Save Changes" renders in the exact spot "Edit Profile" occupied, so the click that opens edit
  // mode leaves the cursor sitting on the submit button. A stray second click — or an Enter press
  // right after — submitted instantly, which reads as "the dialog saved and closed by itself
  // without me touching anything". Ignore submits for a moment after entering edit mode.
  const [editJustOpened, setEditJustOpened] = useState(false)
  const editGuardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successToast, setSuccessToast] = useState('')
  const [mounted, setMounted] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const successToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isMarketingAdmin = profile?.role === 'Marketing Admin'

  useEffect(() => () => { if (successToastTimerRef.current) clearTimeout(successToastTimerRef.current) }, [])

  useEffect(() => () => { if (editGuardTimerRef.current) clearTimeout(editGuardTimerRef.current) }, [])

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
    setChangingPassword(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingPhoto(true)
    setError('')
    try {
      if (!(await isValidImageFile(file))) {
        setError('That file is not a valid image. Please choose a photo.')
        return
      }
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const prepared = await prepareAvatarForUpload(file)
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${prepared.extension}`
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filename, prepared.blob, { contentType: prepared.contentType })
      if (uploadError || !data) throw new Error('Photo upload failed')
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path)
      setPhotoUrl(publicUrl)
    } catch {
      setError('Failed to upload photo. Please try again.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const enterEditMode = () => {
    setName(profile?.full_name ?? '')
    setPhone(profile?.phone_number ?? '')
    setDob(profile?.date_of_birth ?? '')
    setPhotoUrl(profile?.profile_photo_url ?? null)
    setError('')
    setEditing(true)
    setEditJustOpened(true)
    if (editGuardTimerRef.current) clearTimeout(editGuardTimerRef.current)
    editGuardTimerRef.current = setTimeout(() => setEditJustOpened(false), 400)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    // Covers the Enter key too, not just a second click on the button.
    if (editJustOpened) return
    if (!name.trim()) { setError('Full name is required'); return }
    if (!isMarketingAdmin) {
      if (!phone) { setError('Phone number is required'); return }
      if (phone.length !== 8) { setError('Phone number must be exactly 8 digits'); return }
    }
    setSaving(true)
    setError('')
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
      if (successToastTimerRef.current) clearTimeout(successToastTimerRef.current)
      setSuccessToast('Profile updated successfully.')
      successToastTimerRef.current = setTimeout(() => setSuccessToast(''), 3000)
    } catch { setError('Something went wrong') }
    finally { setSaving(false) }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    if (newPassword !== confirmPassword) { setPasswordError('New passwords do not match'); return }
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters'); return }
    setSavingPassword(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: profile?.email_address, current_password: currentPassword, new_password: newPassword }),
      })
      const data = await res.json()
      if (!data.success) { setPasswordError(data.message ?? 'Failed to change password'); return }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setChangingPassword(false)
      if (successToastTimerRef.current) clearTimeout(successToastTimerRef.current)
      setSuccessToast('Password changed successfully.')
      successToastTimerRef.current = setTimeout(() => setSuccessToast(''), 3000)
    } catch { setPasswordError('Something went wrong') }
    finally { setSavingPassword(false) }
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
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <BigAvatar photoUrl={editing ? photoUrl : profile?.profile_photo_url} name={profile?.full_name ?? ''} size={44} />
              {editing && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  title="Change photo"
                  style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 999, background: '#F97316', border: '2px solid #FFFFFF', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploadingPhoto ? 'not-allowed' : 'pointer', padding: 0 }}
                >
                  {uploadingPhoto ? <Spinner size={10} /> : <Camera size={11} />}
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
              <p style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', margin: '0 0 5px' }}>{profile?.full_name ?? '—'}</p>
              <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: '#0F172A', color: '#FFFFFF' }}>
                {profile?.role ?? 'Owner'}
              </span>
            </div>
          </div>

          {/* Fields */}
          {changingPassword ? (
            <form onSubmit={handleChangePassword}>
              <div style={{ padding: '0 24px 4px', display: 'flex', flexDirection: 'column', animation: 'oubFieldsIn 0.22s ease both' }}>
                {[
                  { label: 'Current password', value: currentPassword, set: setCurrentPassword, show: showCurrent, toggle: () => setShowCurrent(v => !v) },
                  { label: 'New password', value: newPassword, set: setNewPassword, show: showNew, toggle: () => setShowNew(v => !v) },
                  { label: 'Confirm new password', value: confirmPassword, set: setConfirmPassword, show: showConfirm, toggle: () => setShowConfirm(v => !v) },
                ].map(({ label, value, set, show, toggle }) => (
                  <div key={label} style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <label style={labelStyle}>{label}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={show ? 'text' : 'password'}
                        style={{ ...inputStyle, paddingRight: 40 }}
                        value={value}
                        onChange={e => { set(e.target.value); setPasswordError('') }}
                        placeholder="••••••••"
                        required
                      />
                      <button type="button" onClick={toggle} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center' }}>
                        {show ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                ))}
                {passwordError && (
                  <div style={{ padding: '12px 0 4px' }}>
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626' }}>{passwordError}</div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => { setChangingPassword(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError('') }} style={{ padding: '7px 16px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', fontWeight: 600, fontSize: '0.8125rem', color: '#374151', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={savingPassword} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, background: savingPassword ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: savingPassword ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: savingPassword ? 0.65 : 1 }}>
                  {savingPassword ? <Spinner size={13} /> : <Check size={13} />} Change Password
                </button>
              </div>
            </form>
          ) : (
          <form onSubmit={handleSave}>
            <div key={String(editing)} style={{ padding: '0 24px 4px', display: 'flex', flexDirection: 'column', animation: 'oubFieldsIn 0.22s ease both' }}>
              {/* Email — read only */}
              <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                <label style={labelStyle}>Email Address</label>
                <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>{profile?.email_address ?? '—'}</p>
              </div>
              {/* Full Name */}
              <div style={{ padding: '14px 0', borderBottom: isMarketingAdmin ? (editing && error ? '1px solid #F3F4F6' : 'none') : '1px solid #F3F4F6' }}>
                <label style={labelStyle}>Full Name</label>
                {editing
                  ? <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} autoFocus />
                  : <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>{profile?.full_name ?? '—'}</p>}
              </div>
              {/* Date of Birth — not shown for Marketing Admin (platform role, no HR fields) */}
              {!isMarketingAdmin && (
              <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                <label style={labelStyle}>Date of Birth</label>
                {editing
                  ? <DatePickerField value={dob} onChange={setDob} placeholder="Select date" max={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 16); return d.toISOString().slice(0, 10) })()} />
                  : <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>{formatDateDisplay(profile?.date_of_birth)}</p>}
              </div>
              )}
              {/* Phone — not shown for Marketing Admin */}
              {!isMarketingAdmin && (
              <div style={{ padding: '14px 0', borderBottom: editing && error ? '1px solid #F3F4F6' : 'none' }}>
                <label style={labelStyle}>Phone Number</label>
                {editing
                  ? <input
                      type="tel"
                      value={phone}
                      onChange={e => { setPhone(e.target.value.replace(/\D/g, '')); setError('') }}
                      maxLength={8}
                      style={inputStyle}
                      placeholder="91234567"
                    />
                  : <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>{profile?.phone_number ?? '—'}</p>}
              </div>
              )}
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
                  <button type="button" onClick={() => { setEditing(false); setError(''); setPhotoUrl(profile?.profile_photo_url ?? null) }} style={{ padding: '7px 16px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', fontWeight: 600, fontSize: '0.8125rem', color: '#374151', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving || editJustOpened} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, background: saving ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.65 : 1 }}>
                    {saving ? <Spinner size={13} /> : <Check size={13} />} Save Changes
                  </button>
                </>
              ) : (
                <>
                  {isMarketingAdmin && (
                    <button type="button" onClick={() => { setChangingPassword(true); setPasswordError('') }} style={{ padding: '7px 16px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', fontWeight: 600, fontSize: '0.8125rem', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <KeyRound size={13} /> Change Password
                    </button>
                  )}
                  <button type="button" onClick={enterEditMode} style={{ padding: '7px 16px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg, #F97316, #EA580C)', fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Pencil size={13} /> Edit Profile
                  </button>
                </>
              )}
            </div>
          </form>
          )}
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
      {mounted && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none' }}>
          <Toast message={successToast} />
        </div>,
        document.body,
      )}
    </>
  )
}
