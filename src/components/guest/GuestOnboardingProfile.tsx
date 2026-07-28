'use client'

// Post-verification onboarding: a worker's account isn't considered "fully registered" until
// they've built the core of their Worker Profile. Skills are required (they're the main signal
// the AI candidate matcher uses); resume and certificates are optional and can be added now or
// later from the profile page. A certificate that IS added must carry a proof file — you can't
// claim to hold one without evidence — so picking a name opens the file picker immediately.
// Persists through the same worker-profile APIs used elsewhere.

import { useRef, useState } from 'react'
import { Paperclip, Plus, RefreshCw, Trash2, Upload } from 'lucide-react'
import { PRESET_CERTIFICATES, WorkerCertificate } from '@/types/WorkerProfile'
import DropdownField from '@/components/DropdownField'

const DOCUMENT_ACCEPT = '.pdf,.doc,.docx'
const CERTIFICATE_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png'
const CUSTOM_OPTION = '__custom__'
// Taller than DropdownField's 40px default so the certificate row matches the roomier feel of
// the rest of this form (Skills textarea, Resume upload button).
const CERT_ROW_HEIGHT = 48

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
  // Which existing certificate the replace-file picker is currently targeting.
  const replaceFileRef = useRef<HTMLInputElement>(null)
  const replaceTargetRef = useRef<string | null>(null)
  const [replacingCertId, setReplacingCertId] = useState<string | null>(null)

  const addCertificate = async () => {
    const name = certChoice === CUSTOM_OPTION ? certCustomName.trim() : certChoice
    if (!name) { setError('Choose a certificate or enter a name.'); return }
    if (!certFile) { setError('Please upload a file to prove you hold this certificate.'); return }
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

  const replaceCertificateFile = async (certId: string, file: File) => {
    setReplacingCertId(certId); setError('')
    try {
      const form = new FormData()
      form.append('user_id', authId)
      form.append('certificate_id', certId)
      form.append('file', file)
      const res = await fetch('/api/guest/profile/certificates', { method: 'PATCH', body: form })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to replace file')
      setCertificates(prev => prev.map(c => (c.id === certId ? data.certificate : c)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to replace file')
    } finally {
      setReplacingCertId(null)
      replaceTargetRef.current = null
      if (replaceFileRef.current) replaceFileRef.current.value = ''
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
        <label style={labelStyle}>Skills</label>
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
        <label style={labelStyle}>Certificates <span style={{ color: '#9CA3AF', fontWeight: 500 }}>(optional)</span></label>
        {/* Hidden picker for swapping the proof file on an already-added certificate. */}
        <input ref={replaceFileRef} type="file" accept={CERTIFICATE_ACCEPT} style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            const id = replaceTargetRef.current
            if (f && id) void replaceCertificateFile(id, f)
          }} />
        {certificates.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
            {certificates.map(cert => (
              <div key={cert.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 54, boxSizing: 'border-box', padding: '0 14px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10 }}>
                <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 400, color: '#111827', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cert.name}</span>
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
                  onClick={() => { replaceTargetRef.current = cert.id; replaceFileRef.current?.click() }}
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
        {/* Hidden file input shared by both branches below (only one is ever mounted at a time,
            since certChoice can't be both a preset and CUSTOM_OPTION simultaneously). */}
        <input ref={certFileRef} type="file" accept={CERTIFICATE_ACCEPT} style={{ display: 'none' }}
          onChange={e => setCertFile(e.target.files?.[0] ?? null)} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Picking a preset name opens the file picker immediately — a claimed certificate must
              come with proof, so there's no standalone "Attach file" step to skip. */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DropdownField
                value={certChoice}
                onChange={v => {
                  setCertChoice(v); setError(''); setCertFile(null)
                  if (v && v !== CUSTOM_OPTION) certFileRef.current?.click()
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
                <button type="button" onClick={() => certFileRef.current?.click()}
                  title={certFile ? certFile.name : 'A file is required to add this certificate'}
                  style={{ ...certFileBtn(!!certFile), height: CERT_ROW_HEIGHT, flexShrink: 0 }}>
                  <Paperclip size={13} /> {certFile ? certFile.name : 'Upload file'}
                </button>
                <button type="button" onClick={addCertificate} disabled={certBusy || !certFile} title="Add certificate"
                  style={{ ...primaryBtn(certBusy || !certFile), width: CERT_ROW_HEIGHT, height: CERT_ROW_HEIGHT, padding: 0, flexShrink: 0 }}>
                  <Plus size={16} />
                </button>
              </>
            )}
          </div>

          {certChoice === CUSTOM_OPTION && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={certCustomName} onChange={e => setCertCustomName(e.target.value)} maxLength={100}
                placeholder="Certificate name" style={{ ...inputStyle, flex: 1, minWidth: 0, height: CERT_ROW_HEIGHT }} />
              <button type="button" onClick={() => certFileRef.current?.click()}
                title={certFile ? certFile.name : 'A file is required to add this certificate'}
                style={{ ...certFileBtn(!!certFile), height: CERT_ROW_HEIGHT, flexShrink: 0 }}>
                <Paperclip size={13} /> {certFile ? certFile.name : 'Upload file'}
              </button>
              <button type="button" onClick={addCertificate} disabled={certBusy || !certFile} title="Add certificate"
                style={{ ...primaryBtn(certBusy || !certFile), width: CERT_ROW_HEIGHT, height: CERT_ROW_HEIGHT, padding: 0, flexShrink: 0 }}>
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Resume — optional */}
      <div>
        <label style={labelStyle}>Resume <span style={{ color: '#9CA3AF', fontWeight: 500 }}>(optional)</span></label>
        <input ref={resumeRef} type="file" accept={DOCUMENT_ACCEPT} style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) void uploadResume(f) }} />
        <button onClick={() => resumeRef.current?.click()} disabled={resumeBusy}
          style={{ width: '100%', padding: '14px 0', border: '1.5px dashed #D1D5DB', borderRadius: 10, background: resumeName ? '#F0FDF4' : '#FAFAFA', color: resumeName ? '#15803D' : '#6B7280', fontWeight: 700, fontSize: '0.875rem', cursor: resumeBusy ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Upload size={15} /> {resumeBusy ? 'Uploading…' : resumeName ? `Uploaded: ${resumeName}` : 'Upload Resume (PDF, DOC, DOCX)'}
        </button>
      </div>

      {error && <p style={{ margin: 0, fontSize: '0.85rem', color: '#DC2626' }}>{error}</p>}

      {/* Extra top margin on top of the parent's 20px gap so the space above the button reads
          the same as the space between field groups (which also carries a label's height). */}
      <button onClick={finish} disabled={finishing} style={{ ...primaryBtn(finishing || !skills.trim()), height: 46, fontSize: '0.9375rem', marginTop: 24 }}>
        {finishing ? 'Finishing…' : 'Finish & Browse Jobs'}
      </button>
    </div>
  )
}

// Matches the shared field label style used on the account form (Full Name, Email, etc.) so
// every step of registration reads as one consistent form.
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  fontSize: '0.9375rem',
  color: '#374151',
  marginBottom: '10px',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10,
  fontSize: '0.9375rem', color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
}

// Doubles as the "did I attach proof?" indicator: red/empty until a file is chosen (a claimed
// certificate isn't valid without one), green with the filename once it is.
const certFileBtn = (hasFile: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px',
  border: `1.5px solid ${hasFile ? '#BBF7D0' : '#FECACA'}`, borderRadius: 8,
  background: hasFile ? '#F0FDF4' : '#FEF2F2', color: hasFile ? '#15803D' : '#DC2626',
  fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer', maxWidth: 240,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
})

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  border: 'none', borderRadius: 10, background: disabled ? '#FCA97A' : '#F97316', color: '#FFFFFF',
  fontWeight: 700, cursor: disabled ? 'default' : 'pointer', fontSize: '0.8125rem', padding: '10px 0',
})
