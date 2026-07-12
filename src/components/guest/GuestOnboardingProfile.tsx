'use client'

// Post-verification onboarding: a worker's account isn't considered "fully registered" until
// they've built the core of their Worker Profile. Skills are required (they're the main signal
// the AI candidate matcher uses); resume and certificates are optional and can be added now or
// later from the profile page. Persists through the same worker-profile APIs used elsewhere.

import { useRef, useState } from 'react'
import { Award, FileText, Paperclip, Plus, Trash2, Upload, Wrench, X } from 'lucide-react'
import { PRESET_CERTIFICATES, WorkerCertificate } from '@/types/WorkerProfile'

const DOCUMENT_ACCEPT = '.pdf,.doc,.docx'
const CERTIFICATE_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png'
const CUSTOM_OPTION = '__custom__'

export default function GuestOnboardingProfile({
  authId,
  onDone,
}: {
  authId: string
  onDone: () => void
}) {
  const [skills, setSkills] = useState('')
  const [certificates, setCertificates] = useState<WorkerCertificate[]>([])
  const [resumeName, setResumeName] = useState<string | null>(null)
  const [certChoice, setCertChoice] = useState('')
  const [certCustomName, setCertCustomName] = useState('')
  const [certFile, setCertFile] = useState<File | null>(null)
  const [certBusy, setCertBusy] = useState(false)
  const [resumeBusy, setResumeBusy] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState('')
  const certFileRef = useRef<HTMLInputElement>(null)
  const resumeRef = useRef<HTMLInputElement>(null)

  const addCertificate = async () => {
    const name = certChoice === CUSTOM_OPTION ? certCustomName.trim() : certChoice
    if (!name) { setError('Choose a certificate or enter a name.'); return }
    setCertBusy(true); setError('')
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
      if (certFileRef.current) certFileRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add certificate')
    } finally {
      setCertBusy(false)
    }
  }

  const removeCertificate = async (id: string) => {
    const res = await fetch(`/api/guest/profile/certificates?user_id=${authId}&certificate_id=${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) setCertificates(prev => prev.filter(c => c.id !== id))
  }

  const uploadResume = async (file: File) => {
    setResumeBusy(true); setError('')
    try {
      const form = new FormData()
      form.append('user_id', authId)
      form.append('resume', file)
      const res = await fetch('/api/guest/profile/resume', { method: 'POST', body: form })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to upload resume')
      setResumeName(file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload resume')
    } finally {
      setResumeBusy(false)
      if (resumeRef.current) resumeRef.current.value = ''
    }
  }

  const finish = async () => {
    if (!skills.trim()) { setError('Please add at least a few skills to complete your profile.'); return }
    setFinishing(true); setError('')
    try {
      const res = await fetch('/api/guest/profile/skills', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: authId, skills: skills.trim() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save skills')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete registration')
      setFinishing(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Skills — required */}
      <div>
        <label style={labelStyle}>
          <Wrench size={14} color="#EA580C" style={{ verticalAlign: -2, marginRight: 6 }} />
          Skills <span style={{ color: '#DC2626' }}>*</span>
        </label>
        <textarea
          value={skills}
          onChange={e => setSkills(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="e.g. Customer service, Barista, Cash handling, Food preparation"
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55, fontFamily: 'inherit' }}
        />
      </div>

      {/* Certificates — optional */}
      <div>
        <label style={labelStyle}>
          <Award size={14} color="#EA580C" style={{ verticalAlign: -2, marginRight: 6 }} />
          Certificates <span style={{ color: '#9CA3AF', fontWeight: 500 }}>(optional)</span>
        </label>
        {certificates.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
            {certificates.map(cert => (
              <div key={cert.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', background: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                <Award size={13} color="#EA580C" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: '#111827', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cert.name}</span>
                {cert.file_url && <Paperclip size={12} color="#15803D" style={{ flexShrink: 0 }} />}
                <button onClick={() => removeCertificate(cert.id)} style={{ display: 'flex', border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', padding: 3 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select value={certChoice} onChange={e => { setCertChoice(e.target.value); setError('') }}
            style={{ ...inputStyle, cursor: 'pointer', color: certChoice ? '#111827' : '#9CA3AF' }}>
            <option value="">Select a certificate…</option>
            {PRESET_CERTIFICATES.map(name => <option key={name} value={name}>{name}</option>)}
            <option value={CUSTOM_OPTION}>+ Add custom certificate</option>
          </select>
          {certChoice === CUSTOM_OPTION && (
            <input value={certCustomName} onChange={e => setCertCustomName(e.target.value)} maxLength={100}
              placeholder="Certificate name" style={inputStyle} />
          )}
          {certChoice && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input ref={certFileRef} type="file" accept={CERTIFICATE_ACCEPT} style={{ display: 'none' }}
                onChange={e => setCertFile(e.target.files?.[0] ?? null)} />
              <button onClick={() => certFileRef.current?.click()} style={ghostBtn}>
                <Paperclip size={13} /> {certFile ? certFile.name : 'Attach file (optional)'}
              </button>
              {certFile && (
                <button onClick={() => { setCertFile(null); if (certFileRef.current) certFileRef.current.value = '' }}
                  style={{ ...ghostBtn, width: 34, padding: 0, justifyContent: 'center' }}><X size={13} /></button>
              )}
              <button onClick={addCertificate} disabled={certBusy} style={{ ...primaryBtn(certBusy), width: 'auto', padding: '0 14px', height: 36 }}>
                {certBusy ? 'Adding…' : <><Plus size={14} /> Add</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Resume — optional */}
      <div>
        <label style={labelStyle}>
          <FileText size={14} color="#EA580C" style={{ verticalAlign: -2, marginRight: 6 }} />
          Resume <span style={{ color: '#9CA3AF', fontWeight: 500 }}>(optional)</span>
        </label>
        <input ref={resumeRef} type="file" accept={DOCUMENT_ACCEPT} style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) void uploadResume(f) }} />
        <button onClick={() => resumeRef.current?.click()} disabled={resumeBusy}
          style={{ width: '100%', padding: '14px 0', border: '1.5px dashed #D1D5DB', borderRadius: 10, background: resumeName ? '#F0FDF4' : '#FAFAFA', color: resumeName ? '#15803D' : '#6B7280', fontWeight: 700, fontSize: '0.875rem', cursor: resumeBusy ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Upload size={15} /> {resumeBusy ? 'Uploading…' : resumeName ? `Uploaded: ${resumeName}` : 'Upload Resume (PDF, DOC, DOCX)'}
        </button>
      </div>

      {error && <p style={{ margin: 0, fontSize: '0.85rem', color: '#DC2626' }}>{error}</p>}

      <button onClick={finish} disabled={finishing} style={{ ...primaryBtn(finishing || !skills.trim()), height: 46, fontSize: '0.9375rem' }}>
        {finishing ? 'Finishing…' : 'Finish & Browse Jobs'}
      </button>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#374151', marginBottom: 8,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10,
  fontSize: '0.9375rem', color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
}

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px',
  border: '1.5px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', color: '#6B7280',
  fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer', maxWidth: 240,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  border: 'none', borderRadius: 10, background: disabled ? '#FCA97A' : '#F97316', color: '#FFFFFF',
  fontWeight: 700, cursor: disabled ? 'default' : 'pointer', fontSize: '0.8125rem', padding: '10px 0',
})
