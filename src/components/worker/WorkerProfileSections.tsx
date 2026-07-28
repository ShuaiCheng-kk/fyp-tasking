'use client'

// Shared Worker Profile cards (Skills / Certificates / Resume) used by both the Guest User
// profile page and the Casual Worker profile page — one set of components, two hosts, per the
// shared-UI principle. Each card is self-contained (owns its own fetch/save) so pages are free to
// lay them out independently (e.g. Casual's two-column grid). This is the long-lived profile
// whose contents get snapshotted into each job application at apply time.

import { useEffect, useRef, useState } from 'react'
import { Award, Check, FileText, Paperclip, Pencil, Plus, RefreshCw, Trash2, Upload, Wrench } from 'lucide-react'
import { PRESET_CERTIFICATES, WorkerCertificate } from '@/types/WorkerProfile'
import DropdownField from '@/components/DropdownField'
import { TitledBlock } from '@/components/panel'

const DOCUMENT_ACCEPT = '.pdf,.doc,.docx'
const CERTIFICATE_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png'
const CUSTOM_OPTION = '__custom__'
// Matches the certificate row height used on the registration onboarding form so the two flows
// read as one consistent design.
const CERT_ROW_HEIGHT = 48

type Props = {
  authId: string
  onToast?: (msg: string) => void
}

export function SkillsCard({ authId, onToast }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [skills, setSkills] = useState('')
  const [savedSkills, setSavedSkills] = useState('')
  const [skillsSaving, setSkillsSaving] = useState(false)
  const [skillsEditing, setSkillsEditing] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/guest/profile?user_id=${authId}`)
        const data = await res.json()
        if (cancelled) return
        if (!data.success) throw new Error(data.message || 'Failed to load profile')
        setSkills(data.profile.skills ?? '')
        setSavedSkills(data.profile.skills ?? '')
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [authId])

  const saveSkills = async () => {
    setSkillsSaving(true)
    try {
      const res = await fetch('/api/guest/profile/skills', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: authId, skills }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save skills')
      setSavedSkills(data.profile.skills ?? '')
      setSkills(data.profile.skills ?? '')
      setSkillsEditing(false)
      onToast?.('Skills saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save skills')
    } finally {
      setSkillsSaving(false)
    }
  }

  if (loading) {
    return <div style={{ ...cardStyle, color: '#6B7280', fontSize: '0.9rem' }}>Loading skills…</div>
  }

  const skillsDirty = skills.trim() !== savedSkills.trim()

  return (
    <TitledBlock
      icon={<Wrench size={15} color="#F97316" />}
      title="Skills"
      headerRight={!skillsEditing && (
        <button type="button" onClick={() => { setSkills(savedSkills); setError(''); setSkillsEditing(true) }} style={editButtonStyle}>
          <Pencil size={13} /> Edit Skills
        </button>
      )}
    >
      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 14, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#B91C1C', fontSize: '0.8125rem', fontWeight: 600 }}>
          {error}
        </div>
      )}
      {skillsEditing ? (
        <>
          <textarea
            value={skills}
            onChange={e => setSkills(e.target.value)}
            rows={3}
            maxLength={2000}
            autoFocus
            placeholder="e.g. Customer service, Barista, Cash handling, Food preparation"
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.9rem', color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF', resize: 'vertical', lineHeight: 1.55, fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => { setSkills(savedSkills); setError(''); setSkillsEditing(false) }}
              style={{ padding: '7px 16px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', fontWeight: 600, fontSize: '0.8125rem', color: '#374151', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={saveSkills} disabled={skillsSaving || !skillsDirty}
              style={{ padding: '7px 18px', border: 'none', borderRadius: 8, background: (skillsSaving || !skillsDirty) ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: (skillsSaving || !skillsDirty) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: (skillsSaving || !skillsDirty) ? 0.7 : 1 }}>
              {skillsSaving ? 'Saving…' : <><Check size={14} /> Save Skills</>}
            </button>
          </div>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.6, color: savedSkills ? '#111827' : '#9CA3AF', whiteSpace: 'pre-wrap' }}>
          {savedSkills || 'No skills added yet.'}
        </p>
      )}
    </TitledBlock>
  )
}

export function CertificatesCard({ authId, onToast }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [certificates, setCertificates] = useState<WorkerCertificate[]>([])
  const [certChoice, setCertChoice] = useState('')
  const [certCustomName, setCertCustomName] = useState('')
  const [certFile, setCertFile] = useState<File | null>(null)
  const [certSaving, setCertSaving] = useState(false)
  const [certError, setCertError] = useState('')
  const certFileInputRef = useRef<HTMLInputElement>(null)
  // Which existing certificate the replace-file picker is currently targeting.
  const replaceFileInputRef = useRef<HTMLInputElement>(null)
  const replaceTargetRef = useRef<string | null>(null)
  const [replacingCertId, setReplacingCertId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/guest/profile?user_id=${authId}`)
        const data = await res.json()
        if (cancelled) return
        if (!data.success) throw new Error(data.message || 'Failed to load profile')
        setCertificates(data.profile.certificates ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [authId])

  const addCertificate = async () => {
    const name = certChoice === CUSTOM_OPTION ? certCustomName.trim() : certChoice
    if (!name) { setCertError('Choose a certificate or enter a name.'); return }
    if (!certFile) { setCertError('Please upload a file to prove you hold this certificate.'); return }
    setCertSaving(true); setCertError('')
    try {
      const form = new FormData()
      form.append('user_id', authId)
      form.append('name', name)
      form.append('file', certFile)
      const res = await fetch('/api/guest/profile/certificates', { method: 'POST', body: form })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to add certificate')
      setCertificates(prev => [...prev, data.certificate])
      setCertChoice(''); setCertCustomName(''); setCertFile(null)
      if (certFileInputRef.current) certFileInputRef.current.value = ''
      onToast?.('Certificate added')
    } catch (err) {
      setCertError(err instanceof Error ? err.message : 'Failed to add certificate')
    } finally {
      setCertSaving(false)
    }
  }

  const replaceCertificateFile = async (certificateId: string, file: File) => {
    setReplacingCertId(certificateId); setCertError('')
    try {
      const form = new FormData()
      form.append('user_id', authId)
      form.append('certificate_id', certificateId)
      form.append('file', file)
      const res = await fetch('/api/guest/profile/certificates', { method: 'PATCH', body: form })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to replace file')
      setCertificates(prev => prev.map(c => (c.id === certificateId ? data.certificate : c)))
      onToast?.('Certificate file replaced')
    } catch (err) {
      setCertError(err instanceof Error ? err.message : 'Failed to replace file')
    } finally {
      setReplacingCertId(null)
      replaceTargetRef.current = null
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = ''
    }
  }

  const removeCertificate = async (certificateId: string) => {
    try {
      const res = await fetch(`/api/guest/profile/certificates?user_id=${authId}&certificate_id=${certificateId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to remove certificate')
      setCertificates(prev => prev.filter(c => c.id !== certificateId))
      onToast?.('Certificate removed')
    } catch (err) {
      setCertError(err instanceof Error ? err.message : 'Failed to remove certificate')
    }
  }

  if (loading) {
    return <div style={{ ...cardStyle, color: '#6B7280', fontSize: '0.9rem' }}>Loading certificates…</div>
  }

  return (
    <TitledBlock icon={<Award size={15} color="#F97316" />} title="Certificates">
      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 14, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#B91C1C', fontSize: '0.8125rem', fontWeight: 600 }}>
          {error}
        </div>
      )}
      {/* Hidden picker for swapping the proof file on an already-added certificate. */}
      <input ref={replaceFileInputRef} type="file" accept={CERTIFICATE_ACCEPT} style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          const id = replaceTargetRef.current
          if (f && id) void replaceCertificateFile(id, f)
        }} />

      {certificates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {certificates.map(cert => (
            <div key={cert.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 54, boxSizing: 'border-box', padding: '0 14px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10 }}>
              <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 400, color: '#111827', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cert.name}
              </span>
              {/* Opens the uploaded proof file so the worker can double-check they attached the
                  right document to the right certificate. */}
              {cert.certificate_url && (
                <a href={cert.certificate_url} target="_blank" rel="noreferrer" title="View uploaded file"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, color: '#15803D', borderRadius: 6, flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#DCFCE7' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  <Paperclip size={16} />
                </a>
              )}
              {/* Wrong scan attached? Replace the file without re-adding the certificate. */}
              <button type="button" disabled={replacingCertId === cert.id} title="Replace uploaded file"
                onClick={() => { replaceTargetRef.current = cert.id; replaceFileInputRef.current?.click() }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', outline: 'none', background: 'transparent', color: '#6B7280', cursor: replacingCertId === cert.id ? 'default' : 'pointer', borderRadius: 6, flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.color = '#374151' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#6B7280' }}>
                <RefreshCw size={15} className={replacingCertId === cert.id ? 'animate-spin' : undefined} />
              </button>
              <button onClick={() => removeCertificate(cert.id)} title="Remove certificate"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', background: 'transparent', color: '#DC2626', cursor: 'pointer', borderRadius: 6, flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input shared by both branches below. */}
      <input ref={certFileInputRef} type="file" accept={CERTIFICATE_ACCEPT} style={{ display: 'none' }}
        onChange={e => setCertFile(e.target.files?.[0] ?? null)} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Picking a preset name opens the file picker immediately — a claimed certificate must
            come with proof, so there's no standalone "Attach file" step to skip. */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <DropdownField
              value={certChoice}
              onChange={v => {
                setCertChoice(v); setCertError(''); setCertFile(null)
                if (v && v !== CUSTOM_OPTION) certFileInputRef.current?.click()
              }}
              placeholder="Select a certificate…"
              height={CERT_ROW_HEIGHT}
              options={[
                ...PRESET_CERTIFICATES.map(name => ({ value: name, label: name })),
                { value: CUSTOM_OPTION, label: '+ Add custom certificate' },
              ]}
            />
          </div>
          {certChoice && certChoice !== CUSTOM_OPTION && (
            <>
              <button type="button" onClick={() => certFileInputRef.current?.click()}
                title={certFile ? certFile.name : 'A file is required to add this certificate'}
                style={{ ...certFileBtnStyle(!!certFile), height: CERT_ROW_HEIGHT, flexShrink: 0 }}>
                <Paperclip size={13} /> {certFile ? certFile.name : 'Upload file'}
              </button>
              <button type="button" onClick={addCertificate} disabled={certSaving || !certFile} title="Add certificate"
                style={{ ...squareAddBtnStyle(certSaving || !certFile), width: CERT_ROW_HEIGHT, height: CERT_ROW_HEIGHT, flexShrink: 0 }}>
                <Plus size={16} />
              </button>
            </>
          )}
        </div>

        {certChoice === CUSTOM_OPTION && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={certCustomName} onChange={e => setCertCustomName(e.target.value)} maxLength={100}
              placeholder="Certificate name"
              style={{ flex: 1, minWidth: 0, height: CERT_ROW_HEIGHT, padding: '0 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '0.9rem', color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF' }} />
            <button type="button" onClick={() => certFileInputRef.current?.click()}
              title={certFile ? certFile.name : 'A file is required to add this certificate'}
              style={{ ...certFileBtnStyle(!!certFile), height: CERT_ROW_HEIGHT, flexShrink: 0 }}>
              <Paperclip size={13} /> {certFile ? certFile.name : 'Upload file'}
            </button>
            <button type="button" onClick={addCertificate} disabled={certSaving || !certFile} title="Add certificate"
              style={{ ...squareAddBtnStyle(certSaving || !certFile), width: CERT_ROW_HEIGHT, height: CERT_ROW_HEIGHT, flexShrink: 0 }}>
              <Plus size={16} />
            </button>
          </div>
        )}

        {certError && <p style={{ margin: 0, fontSize: '0.8125rem', color: '#DC2626' }}>{certError}</p>}
      </div>
    </TitledBlock>
  )
}

export function ResumeCard({ authId, onToast }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resumeUrl, setResumeUrl] = useState<string | null>(null)
  const [resumeBusy, setResumeBusy] = useState(false)
  const [resumeError, setResumeError] = useState('')
  const resumeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/guest/profile?user_id=${authId}`)
        const data = await res.json()
        if (cancelled) return
        if (!data.success) throw new Error(data.message || 'Failed to load profile')
        setResumeUrl(data.profile.resume_url ?? null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [authId])

  const uploadResume = async (file: File) => {
    setResumeBusy(true); setResumeError('')
    try {
      const form = new FormData()
      form.append('user_id', authId)
      form.append('resume', file)
      const res = await fetch('/api/guest/profile/resume', { method: 'POST', body: form })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to upload resume')
      setResumeUrl(data.profile.resume_url)
      onToast?.('Resume uploaded')
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : 'Failed to upload resume')
    } finally {
      setResumeBusy(false)
      if (resumeInputRef.current) resumeInputRef.current.value = ''
    }
  }

  const removeResume = async () => {
    setResumeBusy(true); setResumeError('')
    try {
      const res = await fetch(`/api/guest/profile/resume?user_id=${authId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to remove resume')
      setResumeUrl(null)
      onToast?.('Resume removed')
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : 'Failed to remove resume')
    } finally {
      setResumeBusy(false)
    }
  }

  if (loading) {
    return <div style={{ ...cardStyle, color: '#6B7280', fontSize: '0.9rem' }}>Loading resume…</div>
  }

  return (
    <TitledBlock icon={<FileText size={15} color="#F97316" />} title="Resume">
      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 14, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#B91C1C', fontSize: '0.8125rem', fontWeight: 600 }}>
          {error}
        </div>
      )}
      <input ref={resumeInputRef} type="file" accept={DOCUMENT_ACCEPT} style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) void uploadResume(f) }} />

      {resumeUrl ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 54, boxSizing: 'border-box', padding: '0 14px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10 }}>
          <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 400, color: '#111827', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {decodeURIComponent(resumeUrl.split('/').pop() ?? 'Resume').replace(/^\d+-resume-/, '')}
          </span>
          {/* Opens the uploaded resume — matches the certificate rows' paperclip preview. */}
          <a href={resumeUrl} target="_blank" rel="noreferrer" title="View uploaded file"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, color: '#15803D', borderRadius: 6, flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#DCFCE7' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            <Paperclip size={16} />
          </a>
          <button onClick={() => resumeInputRef.current?.click()} disabled={resumeBusy} title="Replace uploaded file"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', outline: 'none', background: 'transparent', color: '#6B7280', cursor: resumeBusy ? 'default' : 'pointer', borderRadius: 6, flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#374151' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6B7280' }}>
            <RefreshCw size={15} className={resumeBusy ? 'animate-spin' : undefined} />
          </button>
          <button onClick={removeResume} disabled={resumeBusy} title="Remove resume"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', background: 'transparent', color: '#DC2626', cursor: 'pointer', borderRadius: 6, flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        <button onClick={() => resumeInputRef.current?.click()} disabled={resumeBusy}
          style={{ width: '100%', padding: '18px 0', border: '1.5px dashed #D1D5DB', borderRadius: 10, background: '#FAFAFA', color: '#6B7280', fontWeight: 700, fontSize: '0.875rem', cursor: resumeBusy ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'border-color 0.12s, color 0.12s' }}
          onMouseEnter={e => { if (!resumeBusy) { e.currentTarget.style.borderColor = '#EA580C'; e.currentTarget.style.color = '#EA580C' } }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#6B7280' }}>
          <Upload size={16} /> {resumeBusy ? 'Uploading…' : 'Upload Resume (PDF, DOC, DOCX)'}
        </button>
      )}

      {resumeError && <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: '#DC2626' }}>{resumeError}</p>}
    </TitledBlock>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 14,
  border: '1.5px solid #E5E7EB',
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}

// Matches the "Edit Profile" button on the Personal Information card.
const editButtonStyle: React.CSSProperties = {
  padding: '7px 14px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg, #F97316, #EA580C)',
  fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
}

// Doubles as the "did I attach proof?" indicator: red/empty until a file is chosen (a claimed
// certificate isn't valid without one), green with the filename once it is. Mirrors the register
// onboarding form.
const certFileBtnStyle = (hasFile: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px',
  border: `1.5px solid ${hasFile ? '#BBF7D0' : '#FECACA'}`, borderRadius: 8,
  background: hasFile ? '#F0FDF4' : '#FEF2F2', color: hasFile ? '#15803D' : '#DC2626',
  fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer', maxWidth: 240,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
})

const squareAddBtnStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  border: 'none', borderRadius: 10, background: disabled ? '#FCA97A' : '#F97316', color: '#FFFFFF',
  cursor: disabled ? 'default' : 'pointer',
})
