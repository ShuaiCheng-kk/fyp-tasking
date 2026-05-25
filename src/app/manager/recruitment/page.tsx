'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, X, RefreshCw, Briefcase, MoreHorizontal, Pencil, Copy, XCircle, Archive, Trash2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import ManagerSidebar from '@/components/ManagerSidebar'
import { JobPosting } from '@/types/recruitment.types'

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke="rgba(17,24,39,0.2)" strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

// ─── Form type ────────────────────────────────────────────────────────────────
interface PostJobForm {
  title: string
  description: string
  requirements: string
  location: string
  employment_type: string
  is_recurring: boolean
  recurrence_interval: number
  recurrence_unit: string
  company_name: string
  industry: string
  salary_amount: string
  salary_type: string
}

const defaultForm: PostJobForm = {
  title: '',
  description: '',
  requirements: '',
  location: '',
  employment_type: 'casual',
  is_recurring: false,
  recurrence_interval: 1,
  recurrence_unit: 'week',
  company_name: '',
  industry: '',
  salary_amount: '',
  salary_type: 'per hour',
}

function jobToForm(job: JobPosting): PostJobForm {
  return {
    title: job.title ?? '',
    description: job.description ?? '',
    requirements: job.requirements ?? '',
    location: job.location ?? '',
    employment_type: job.employment_type ?? 'casual',
    is_recurring: job.is_recurring ?? false,
    recurrence_interval: job.recurrence_interval ?? 1,
    recurrence_unit: job.recurrence_unit ?? 'week',
    company_name: (job as any).company_name ?? '',
    industry: (job as any).industry ?? '',
    salary_amount: (job as any).salary_amount != null ? String((job as any).salary_amount) : '',
    salary_type: (job as any).salary_type ?? 'per hour',
  }
}

// ─── Post / Edit Job Modal ────────────────────────────────────────────────────
function JobModal({
  mode, initial, onClose, onSubmit, submitting,
}: {
  mode: 'post' | 'edit'
  initial?: PostJobForm
  onClose: () => void
  onSubmit: (form: PostJobForm) => Promise<void>
  submitting: boolean
}) {
  const [form, setForm] = useState<PostJobForm>(initial ?? defaultForm)
  const set = (key: keyof PostJobForm, value: any) => setForm(f => ({ ...f, [key]: value }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.125rem', color: '#111827', margin: 0 }}>
            {mode === 'edit' ? 'Edit Job Opening' : 'Post Job Opening'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Field label="Job Title *">
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Weekend Cashier" style={inputStyle} />
          </Field>
          <Field label="Description *">
            <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the role, responsibilities, and expectations..." rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
          <Field label="Company Name">
            <input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="e.g. Tasking Pte Ltd" style={inputStyle} />
          </Field>
          <Field label="Industry">
            <select value={form.industry} onChange={e => set('industry', e.target.value)} style={inputStyle}>
              <option value="">Select industry</option>
              <option value="Retail">Retail</option>
              <option value="F&B">F&B</option>
              <option value="Logistics">Logistics</option>
              <option value="Event Management">Event Management</option>
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Salary Amount">
              <input type="number" min={0} value={form.salary_amount} onChange={e => set('salary_amount', e.target.value)} placeholder="e.g. 12" style={inputStyle} />
            </Field>
            <Field label="Salary Type">
              <select value={form.salary_type} onChange={e => set('salary_type', e.target.value)} style={inputStyle}>
                <option value="per hour">Per Hour</option>
                <option value="per day">Per Day</option>
                <option value="per month">Per Month</option>
              </select>
            </Field>
          </div>
          <Field label="Requirements">
            <textarea value={form.requirements} onChange={e => set('requirements', e.target.value)} placeholder="e.g. Must be available weekends, physically fit..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Location">
              <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Main Branch" style={inputStyle} />
            </Field>
            <Field label="Employment Type">
              <select value={form.employment_type} onChange={e => set('employment_type', e.target.value)} style={inputStyle}>
                <option value="casual">Casual</option>
                <option value="part-time">Part-time</option>
                <option value="full-time">Full-time</option>
              </select>
            </Field>
          </div>
          <div style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: '10px', padding: '14px 16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <div onClick={() => set('is_recurring', !form.is_recurring)} style={{ width: 40, height: 22, borderRadius: 999, background: form.is_recurring ? '#2563EB' : '#D1D5DB', position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: form.is_recurring ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#FFFFFF', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827', margin: 0 }}>Recurring Posting</p>
                <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: 0 }}>Automatically re-post this job on a schedule</p>
              </div>
            </label>
            {form.is_recurring && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <span style={{ fontSize: '0.875rem', color: '#374151' }}>Every</span>
                <input type="number" min={1} value={form.recurrence_interval} onChange={e => set('recurrence_interval', Number(e.target.value))} style={{ ...inputStyle, width: '64px', textAlign: 'center' }} />
                <select value={form.recurrence_unit} onChange={e => set('recurrence_unit', e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                  <option value="day">Day(s)</option>
                  <option value="week">Week(s)</option>
                  <option value="month">Month(s)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
          <button onClick={() => onSubmit(form)} disabled={submitting} style={{ ...primaryBtnStyle, opacity: submitting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {submitting ? <><Spinner size={14} /> Saving…</> : mode === 'edit' ? 'Save Changes' : 'Post Job'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }: {
  message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '28px 28px 22px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <p style={{ fontSize: '0.9375rem', color: '#111827', margin: '0 0 20px', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onCancel} style={secondaryBtnStyle}>Cancel</button>
          <button onClick={onConfirm} style={{ ...primaryBtnStyle, background: danger ? '#DC2626' : '#1E3A5F' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Action Menu ──────────────────────────────────────────────────────────────
function ActionMenu({ job, onEdit, onDuplicate, onClose, onArchive, onDelete }: {
  job: JobPosting; onEdit: () => void; onDuplicate: () => void
  onClose: () => void; onArchive: () => void; onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const isClosed = job.status === 'closed'
  const isArchived = job.status === 'archived'

  const items: { icon: React.ReactNode; label: string; action: () => void; color?: string }[] = [
    { icon: <Pencil size={14} />, label: 'Edit', action: onEdit },
    { icon: <Copy size={14} />, label: 'Duplicate', action: onDuplicate },
    ...(!isClosed && !isArchived ? [{ icon: <XCircle size={14} />, label: 'Close', action: onClose }] : []),
    ...(!isArchived ? [{ icon: <Archive size={14} />, label: 'Archive', action: onArchive }] : []),
    { icon: <Trash2 size={14} />, label: 'Delete', action: onDelete, color: '#DC2626' },
  ]

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: open ? '#F3F4F6' : 'none', border: '1px solid transparent', borderColor: open ? '#E5E7EB' : 'transparent', borderRadius: '6px', cursor: 'pointer', padding: '4px 5px', color: '#6B7280', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}>
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '148px', zIndex: 50, overflow: 'hidden' }}>
          {items.map((item, i) => (
            <button key={i} onClick={() => { setOpen(false); item.action() }}
              style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8375rem', fontWeight: 500, color: item.color ?? '#374151', textAlign: 'left', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = item.color ? '#FEF2F2' : '#F9FAFB')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {item.icon}{item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>{label}</label>
      {children}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '0.9rem', color: '#111827', background: '#FFFFFF', outline: 'none', fontFamily: 'inherit' }
const primaryBtnStyle: React.CSSProperties = { padding: '9px 20px', background: '#1E3A5F', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }
const secondaryBtnStyle: React.CSSProperties = { padding: '9px 20px', background: '#F3F4F6', color: '#374151', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    open:     { bg: '#DCFCE7', color: '#15803D' },
    closed:   { bg: '#FEF9C3', color: '#854D0E' },
    archived: { bg: '#F3F4F6', color: '#6B7280' },
  }
  const c = colors[status] ?? colors.open
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, background: c.bg, color: c.color }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ─── Confirm state type ───────────────────────────────────────────────────────
type ConfirmState = { message: string; confirmLabel: string; danger: boolean; onConfirm: () => void } | null

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ManagerRecruitmentPage() {
  const [companyName, setCompanyName] = useState('')
  const [deptName, setDeptName]       = useState('')
  const [companyId, setCompanyId]     = useState('')
  const [userId, setUserId]           = useState('')
  const [departmentId, setDepartmentId] = useState<string | null>(null)

  const [jobs, setJobs]               = useState<JobPosting[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)

  const [modalMode, setModalMode]     = useState<'post' | 'edit' | null>(null)
  const [editingJob, setEditingJob]   = useState<JobPosting | null>(null)
  const [confirm, setConfirm]         = useState<ConfirmState>(null)

  // ── Bootstrap user & company ─────────────────────────────────────────────
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const res = await fetch(`/api/user/me?user_id=${user.id}`)
      const d = await res.json()
      if (!d.success) return
      const { id: internalId, company_id, department_id } = d.user
      setUserId(internalId)
      if (department_id) setDepartmentId(department_id)
      if (company_id) {
        setCompanyId(company_id)
        const [compRes, deptRes] = await Promise.all([
          fetch(`/api/company/current?user_id=${internalId}&company_id=${company_id}`),
          fetch(`/api/company/departments?company_id=${company_id}`),
        ])
        const compData = await compRes.json()
        const deptData = await deptRes.json()
        if (compData.success && compData.company?.name) setCompanyName(compData.company.name)
        if (deptData.success && department_id) {
          const match = deptData.departments.find((d: { id: string; name: string }) => d.id === department_id)
          if (match) setDeptName(match.name)
        }
      }
    })
  }, [])

  // ── Fetch jobs ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) return
    setLoadingJobs(true)
    fetch(`/api/manager/recruitment/jobs?company_id=${companyId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setJobs(d.jobs) })
      .catch(() => {})
      .finally(() => setLoadingJobs(false))
  }, [companyId])

  // ── Build POST body ──────────────────────────────────────────────────────
  const buildBody = (form: PostJobForm, extra?: Record<string, any>) => ({
    company_id:          companyId,
    department_id:       departmentId,
    created_by:          userId,
    title:               form.title,
    description:         form.description,
    requirements:        form.requirements || null,
    location:            form.location || null,
    employment_type:     form.employment_type,
    is_recurring:        form.is_recurring,
    recurrence_interval: form.is_recurring ? form.recurrence_interval : null,
    recurrence_unit:     form.is_recurring ? form.recurrence_unit : null,
    company_name:        form.company_name || null,
    industry:            form.industry || null,
    salary_amount:       form.salary_amount ? Number(form.salary_amount) : null,
    salary_type:         form.salary_type,
    ...extra,
  })

  // ── Post job ─────────────────────────────────────────────────────────────
  const handlePostJob = async (form: PostJobForm) => {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/manager/recruitment/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody(form)),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setJobs(prev => [data.job, ...prev])
      setModalMode(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Edit job ─────────────────────────────────────────────────────────────
  const handleEditJob = async (form: PostJobForm) => {
    if (!editingJob) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/manager/recruitment/jobs/${editingJob.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody(form)),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setJobs(prev => prev.map(j => j.id === editingJob.id ? data.job : j))
      setModalMode(null)
      setEditingJob(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Duplicate job — delegates to the dedicated endpoint ──────────────────
  const handleDuplicate = async (job: JobPosting) => {
    setError(null)
    try {
      const res = await fetch(`/api/manager/recruitment/jobs/${job.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesting_manager_id: userId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setJobs(prev => [data.job, ...prev])
    } catch (err: any) {
      setError(err.message)
    }
  }

  // ── Update status ────────────────────────────────────────────────────────
  const handleStatusChange = async (job: JobPosting, status: 'closed' | 'archived') => {
    setError(null)
    try {
      const res = await fetch(`/api/manager/recruitment/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status } : j))
    } catch (err: any) {
      setError(err.message)
    }
  }

  // ── Delete job ───────────────────────────────────────────────────────────
  const handleDelete = async (job: JobPosting) => {
    setError(null)
    try {
      const res = await fetch(`/api/manager/recruitment/jobs/${job.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setJobs(prev => prev.filter(j => j.id !== job.id))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const title = companyName && deptName ? `${companyName} [${deptName}] — Recruitment` : 'Recruitment'

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <ManagerSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div style={{ padding: '18px 32px', background: '#1E3A5F', borderBottom: '1px solid #163050', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#FFFFFF', margin: 0 }}>{title}</h1>
          <button onClick={() => { setEditingJob(null); setModalMode('post') }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
            <Plus size={15} strokeWidth={2.5} /> Post Job
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '28px 32px', flex: 1 }}>
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#B91C1C', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
            Job Openings
          </p>

          {loadingJobs ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9CA3AF', fontSize: '0.9375rem' }}>
              <Spinner /> Loading…
            </div>
          ) : jobs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '60px 20px', color: '#9CA3AF', textAlign: 'center' }}>
              <Briefcase size={36} strokeWidth={1.5} />
              <p style={{ fontWeight: 600, fontSize: '1rem', color: '#6B7280', margin: 0 }}>No job openings yet</p>
              <p style={{ fontSize: '0.875rem', margin: 0 }}>Click "Post Job" to create your first listing.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '720px' }}>
              {jobs.map(job => (
                <div key={job.id} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', opacity: job.status === 'archived' ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827', margin: 0 }}>{job.title}</p>
                      <StatusBadge status={job.status} />
                      {job.is_recurring && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', color: '#6B7280' }}>
                          <RefreshCw size={11} /> Every {job.recurrence_interval} {job.recurrence_unit}(s)
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
                      {job.description.length > 100 ? job.description.slice(0, 100) + '…' : job.description}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                      {job.location && <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{job.location}</span>}
                      {job.employment_type && <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{job.employment_type.charAt(0).toUpperCase() + job.employment_type.slice(1)}</span>}
                      <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                        {new Date(job.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  <ActionMenu
                    job={job}
                    onEdit={() => { setEditingJob(job); setModalMode('edit') }}
                    onDuplicate={() => handleDuplicate(job)}
                    onClose={() => setConfirm({
                      message: `Close "${job.title}"? Applicants will no longer be able to apply.`,
                      confirmLabel: 'Close Job', danger: false,
                      onConfirm: () => { setConfirm(null); handleStatusChange(job, 'closed') },
                    })}
                    onArchive={() => setConfirm({
                      message: `Archive "${job.title}"? It will be hidden from active listings.`,
                      confirmLabel: 'Archive', danger: false,
                      onConfirm: () => { setConfirm(null); handleStatusChange(job, 'archived') },
                    })}
                    onDelete={() => setConfirm({
                      message: `Permanently delete "${job.title}"? This cannot be undone.`,
                      confirmLabel: 'Delete', danger: true,
                      onConfirm: () => { setConfirm(null); handleDelete(job) },
                    })}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {modalMode && (
        <JobModal
          mode={modalMode}
          initial={editingJob ? jobToForm(editingJob) : undefined}
          onClose={() => { setModalMode(null); setEditingJob(null); setError(null) }}
          onSubmit={modalMode === 'edit' ? handleEditJob : handlePostJob}
          submitting={submitting}
        />
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}