'use client'

// Shared Worker Profile sections (Skills / Certificates / Resume) used by both the Guest User
// profile page and the Casual Worker profile page — one component, two hosts, per the shared-UI
// principle. This is the long-lived profile whose contents get snapshotted into each job
// application at apply time.

import { useEffect, useRef, useState } from 'react'
import { Award, Check, FileText, Paperclip, Plus, Trash2, Upload, Wrench, X } from 'lucide-react'
import { PRESET_CERTIFICATES, WorkerCertificate } from '@/types/WorkerProfile'

const DOCUMENT_ACCEPT = '.pdf,.doc,.docx'
const CERTIFICATE_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png'
const CUSTOM_OPTION = '__custom__'

type Props = {
  authId: string
  onToast?: (msg: string) => void
}

export default function WorkerProfileSections({ authId, onToast }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // skills
  const [skills, setSkills] = useState('')
  const [savedSkills, setSavedSkills] = useState('')
  const [skillsSaving, setSkillsSaving] = useState(false)

  // certificates
  const [certificates, setCertificates] = useState<WorkerCertificate[]>([])
  const [certChoice, setCertChoice] = useState('')
  const [certCustomName, setCertCustomName] = useState('')
  const [certFile, setCertFile] = useState<File | null>(null)
  const [certSaving, setCertSaving] = useState(false)
  const [certError, setCertError] = useState('')
  const certFileInputRef = useRef<HTMLInputElement>(null)

  // resume
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
        setSkills(data.profile.skills ?? '')
        setSavedSkills(data.profile.skills ?? '')
        setCertificates(data.profile.certificates ?? [])
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
      onToast?.('Skills saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save skills')
    } finally {
      setSkillsSaving(false)
    }
  }

  const addCertificate = async () => {
    const name = certChoice === CUSTOM_OPTION ? certCustomName.trim() : certChoice
    if (!name) { setCertError('Choose a certificate or enter a name.'); return }
    setCertSaving(true); setCertError('')
    try {
      const form = new FormData()
      form.append('user_id', authId)
      form.append('name', name)
      if (certFile) form.append('file', certFile)
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
    return <div style={{ ...cardStyle, color: '#6B7280', fontSize: '0.9rem' }}>Loading worker profile…</div>
  }

  const skillsDirty = skills.trim() !== savedSkills.trim()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && (
        <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#B91C1C', fontSize: '0.8125rem', fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* Skills */}
      <div style={cardStyle}>
        <CardHeader icon={<Wrench size={16} color="#EA580C" />} title="Skills" subtitle="" />
        <textarea
          value={skills}
          onChange={e => setSkills(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="e.g. Customer service, Barista, Cash handling, Food preparation"
          style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.9rem', color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF', resize: 'vertical', lineHeight: 1.55, fontFamily: 'inherit' }}
        />
        <button onClick={saveSkills} disabled={skillsSaving || !skillsDirty} style={primaryButtonStyle(skillsSaving || !skillsDirty)}>
          {skillsSaving ? 'Saving…' : <><Check size={15} /> Save Skills</>}
        </button>
      </div>

      {/* Certificates */}
      <div style={cardStyle}>
        <CardHeader icon={<Award size={16} color="#EA580C" />} title="Certificates" subtitle="" />

        {certificates.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {certificates.map(cert => (
              <div key={cert.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                <Award size={14} color="#EA580C" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, color: '#111827', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cert.name}
                </span>
                {cert.file_url ? (
                  <a href={cert.file_url} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 700, color: '#15803D', background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 999, padding: '3px 9px', textDecoration: 'none', flexShrink: 0 }}>
                    <Paperclip size={11} /> Attached
                  </a>
                ) : (
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 999, padding: '3px 9px', flexShrink: 0 }}>
                    No file
                  </span>
                )}
                <button onClick={() => removeCertificate(cert.id)} title="Remove certificate"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', borderRadius: 6, flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEF2F2' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'transparent' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select
            value={certChoice}
            onChange={e => { setCertChoice(e.target.value); setCertError('') }}
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.9rem', color: certChoice ? '#111827' : '#9CA3AF', outline: 'none', background: '#FFFFFF', cursor: 'pointer' }}
          >
            <option value="">Select a certificate…</option>
            {PRESET_CERTIFICATES.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
            <option value={CUSTOM_OPTION}>+ Add custom certificate</option>
          </select>

          {certChoice === CUSTOM_OPTION && (
            <input
              value={certCustomName}
              onChange={e => setCertCustomName(e.target.value)}
              maxLength={100}
              placeholder="Certificate name"
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.9rem', color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF' }}
            />
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input ref={certFileInputRef} type="file" accept={CERTIFICATE_ACCEPT} style={{ display: 'none' }}
              onChange={e => setCertFile(e.target.files?.[0] ?? null)} />
            <button onClick={() => certFileInputRef.current?.click()} style={ghostButtonStyle}>
              <Paperclip size={13} /> {certFile ? certFile.name : 'Attach file (optional)'}
            </button>
            {certFile && (
              <button onClick={() => { setCertFile(null); if (certFileInputRef.current) certFileInputRef.current.value = '' }}
                title="Clear selected file"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 34, border: '1.5px solid #E5E7EB', background: '#FFFFFF', color: '#6B7280', cursor: 'pointer', borderRadius: 8, flexShrink: 0 }}>
                <X size={13} />
              </button>
            )}
            <button onClick={addCertificate} disabled={certSaving} style={{ ...primaryButtonStyle(certSaving), marginTop: 0, width: 'auto', padding: '0 16px', height: 34, flexShrink: 0 }}>
              {certSaving ? 'Adding…' : <><Plus size={14} /> Add</>}
            </button>
          </div>

          {certError && <p style={{ margin: 0, fontSize: '0.8125rem', color: '#DC2626' }}>{certError}</p>}
        </div>
      </div>

      {/* Resume */}
      <div style={cardStyle}>
        <CardHeader icon={<FileText size={16} color="#EA580C" />} title="Resume" subtitle="" />
        <input ref={resumeInputRef} type="file" accept={DOCUMENT_ACCEPT} style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) void uploadResume(f) }} />

        {resumeUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 8 }}>
            <FileText size={14} color="#EA580C" style={{ flexShrink: 0 }} />
            <a href={resumeUrl} target="_blank" rel="noreferrer"
              style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, color: '#111827', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>
              {decodeURIComponent(resumeUrl.split('/').pop() ?? 'Resume').replace(/^\d+-resume-/, '')}
            </a>
            <button onClick={() => resumeInputRef.current?.click()} disabled={resumeBusy} style={{ ...ghostButtonStyle, flexShrink: 0 }}>
              <Upload size={13} /> Replace
            </button>
            <button onClick={removeResume} disabled={resumeBusy} title="Remove resume"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', borderRadius: 6, flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEF2F2' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'transparent' }}>
              <Trash2 size={14} />
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
      </div>
    </div>
  )
}

function CardHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>{title}</p>
      {subtitle ? <p style={{ margin: 0, fontSize: '0.78rem', color: '#6B7280' }}>{subtitle}</p> : null}
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

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  marginTop: 12,
  width: '100%',
  padding: '10px 0',
  background: disabled ? '#9CA3AF' : '#EA580C',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: 8,
  fontWeight: 700,
  fontSize: '0.9375rem',
  cursor: disabled ? 'default' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
})

const ghostButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 34,
  padding: '0 12px',
  border: '1.5px solid #E5E7EB',
  borderRadius: 8,
  background: '#FFFFFF',
  color: '#6B7280',
  fontWeight: 700,
  fontSize: '0.8125rem',
  cursor: 'pointer',
  maxWidth: 260,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
