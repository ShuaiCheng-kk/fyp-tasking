'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  Archive, Briefcase, CheckCircle, ClipboardList, Copy, Crown,
  FileText, Send, Sparkles, Trash2, UserCheck, UserX,
  X, XCircle,
} from 'lucide-react'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import { CandidateRecommendation } from '@/types/AI'
import { JobApplicant, JobPostingPendingApproval, JobPostingSummary } from '@/types/Recruitment'

type Tab = 'live' | 'archived' | 'drafts' | 'review'
type Department = { id: string; name: string }

// ─── shared tiny styles ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #E5E7EB',
  borderRadius: 8,
  fontSize: '0.9rem',
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#FFFFFF',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 800,
  color: '#6B7280',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const cardShadow = '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)'

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    open:             { bg: '#ECFDF5', text: '#047857', label: 'Open' },
    active:           { bg: '#ECFDF5', text: '#047857', label: 'Active' },
    accepted:         { bg: '#ECFDF5', text: '#047857', label: 'Accepted' },
    archived:         { bg: '#F3F4F6', text: '#4B5563', label: 'Archived' },
    inactive:         { bg: '#F3F4F6', text: '#4B5563', label: 'Inactive' },
    closed:           { bg: '#F3F4F6', text: '#4B5563', label: 'Closed' },
    blocked:          { bg: '#FEF2F2', text: '#B91C1C', label: 'Blocked' },
    rejected:         { bg: '#FEF2F2', text: '#B91C1C', label: 'Rejected' },
    pending_approval: { bg: '#FFFBEB', text: '#B45309', label: 'Pending' },
    pending:          { bg: '#FFFBEB', text: '#B45309', label: 'Pending' },
    draft:            { bg: '#EFF6FF', text: '#1D4ED8', label: 'Draft' },
  }
  const c = map[status] ?? { bg: '#F3F4F6', text: '#6B7280', label: status }
  return (
    <span style={{ background: c.bg, color: c.text, borderRadius: 999, padding: '2px 9px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0, letterSpacing: '0.03em' }}>
      {c.label}
    </span>
  )
}

// ─── page component ───────────────────────────────────────────────────────────

export default function OwnerRecruitmentPage() {
  const router = useRouter()

  // auth / company
  const [internalUserId, setInternalUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [currentPlan, setCurrentPlan] = useState('Free')

  // data
  const [departments, setDepartments] = useState<Department[]>([])
  const [livePostings, setLivePostings] = useState<JobPostingSummary[]>([])
  const [drafts, setDrafts] = useState<JobPostingSummary[]>([])
  const [pendingPostings, setPendingPostings] = useState<JobPostingPendingApproval[]>([])
  const [selectedLiveId, setSelectedLiveId] = useState('')
  const [applicants, setApplicants] = useState<JobApplicant[]>([])
  const [recommendations, setRecommendations] = useState<CandidateRecommendation[]>([])

  // ui state
  const [activeTab, setActiveTab] = useState<Tab>('live')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')

  // form modal
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState('')       // empty = new, set = edit
  const [editingDraft, setEditingDraft] = useState(false)  // true when editing a draft
  const [formTitle, setFormTitle] = useState('')
  const [formDeptId, setFormDeptId] = useState('')
  const [formEmpType, setFormEmpType] = useState('Casual')
  const [formLocation, setFormLocation] = useState('')
  const [formSalaryAmt, setFormSalaryAmt] = useState('')
  const [formSalaryType, setFormSalaryType] = useState('per hour')
  const [formDescription, setFormDescription] = useState('')
  const [formRequirements, setFormRequirements] = useState('')
  const [formError, setFormError] = useState('')

  // detail / delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null)

  const selectedLive = useMemo(() => livePostings.find(p => p.id === selectedLiveId) ?? null, [livePostings, selectedLiveId])

  // ── data fetching ────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async (cid: string, uid: string) => {
    if (!cid || !uid) return
    setLoading(true)
    setError('')
    try {
      const [liveRes, pendingRes, draftsRes, deptRes] = await Promise.all([
        fetch(`/api/recruitment?company_id=${cid}`),
        fetch(`/api/recruitment?company_id=${cid}&resource=pending_approval`),
        fetch(`/api/recruitment?company_id=${cid}&resource=drafts&user_id=${uid}`),
        fetch(`/api/company/departments?company_id=${cid}`),
      ])
      const [liveData, pendingData, draftsData, deptData] = await Promise.all([
        liveRes.json(), pendingRes.json(), draftsRes.json(), deptRes.json(),
      ])
      if (!liveData.success) throw new Error(liveData.message || 'Failed to fetch jobs')
      setLivePostings(liveData.postings ?? [])
      setPendingPostings(pendingData.pendingPostings ?? [])
      setDrafts(draftsData.drafts ?? [])
      if (deptData.success) setDepartments(deptData.departments ?? [])
      // auto-select first live posting
      setSelectedLiveId(prev => {
        const list = liveData.postings ?? []
        if (prev && list.some((p: JobPostingSummary) => p.id === prev)) return prev
        return list[0]?.id ?? ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recruitment data')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchApplicants = useCallback(async (jobId: string) => {
    if (!jobId) { setApplicants([]); return }
    try {
      const res = await fetch(`/api/recruitment?resource=applicants&job_id=${jobId}`)
      const data = await res.json()
      if (data.success) setApplicants(data.applicants ?? [])
    } catch { setApplicants([]) }
  }, [])

  // initial auth + load
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let authId = localStorage.getItem('tasking_user_id')
      if (!authId) {
        const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) { authId = session.user.id; localStorage.setItem('tasking_user_id', authId) }
      }
      if (!authId) { router.replace('/signin'); return }
      if (cancelled) return

      const meRes = await fetch(`/api/user/me?user_id=${authId}`)
      const meData = await meRes.json()
      if (!meData.success) return
      const uid = meData.user.id
      setInternalUserId(uid)
      if (meData.user?.full_name) setOwnerName(meData.user.full_name)

      const storedCid = localStorage.getItem(`tasking_company_id_${authId}`) || meData.user.company_id || ''
      if (!storedCid) return
      setCompanyId(storedCid)

      const currentRes = await fetch(`/api/company/current?user_id=${authId}&company_id=${storedCid}`)
      const currentData = await currentRes.json()
      if (!cancelled && currentData.success) {
        setCompanyName(currentData.company?.name ?? '')
        setCurrentPlan(currentData.company?.plan ?? 'Free')
      }
      if (!cancelled) await fetchAll(storedCid, uid)
    }
    void run()
    return () => { cancelled = true }
  }, [router, fetchAll])

  useEffect(() => {
    void fetchApplicants(selectedLiveId)
    setRecommendations([])
  }, [selectedLiveId, fetchApplicants])

  // ── form helpers ─────────────────────────────────────────────────────────────

  const resetForm = () => {
    setEditingId(''); setEditingDraft(false)
    setFormTitle(''); setFormDeptId(''); setFormEmpType('Casual')
    setFormLocation(''); setFormSalaryAmt(''); setFormSalaryType('per hour')
    setFormDescription(''); setFormRequirements(''); setFormError('')
  }

  const openNewForm = () => { resetForm(); setFormOpen(true) }

  const openEditForm = (p: JobPostingSummary, isDraft = false) => {
    setEditingId(p.id); setEditingDraft(isDraft)
    setFormTitle(p.title); setFormDeptId(p.department_id ?? '')
    setFormEmpType(p.employment_type ?? 'Casual'); setFormLocation(p.location ?? '')
    setFormSalaryAmt(p.salary_amount?.toString() ?? ''); setFormSalaryType(p.salary_type ?? 'per hour')
    setFormDescription(p.description); setFormRequirements(p.requirements ?? '')
    setFormError(''); setFormOpen(true)
  }

  const buildBody = (status: 'open' | 'draft') => ({
    company_id: companyId,
    department_id: formDeptId || null,
    created_by: internalUserId,
    title: formTitle,
    description: formDescription,
    requirements: formRequirements || null,
    location: formLocation || null,
    employment_type: formEmpType || null,
    company_name: companyName || null,
    salary_amount: formSalaryAmt ? Number(formSalaryAmt) : null,
    salary_type: formSalaryType || 'per hour',
    status,
  })

  const saveForm = async (status: 'open' | 'draft') => {
    if (!companyId || !internalUserId) return
    if (!formTitle.trim()) { setFormError('Title is required'); return }
    if (status === 'open' && !formDescription.trim()) { setFormError('Description is required to publish'); return }
    setActionLoading(true); setFormError('')
    try {
      const body = buildBody(status)
      let res: Response
      if (editingId) {
        res = await fetch('/api/recruitment', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, action: 'edit_posting', job_id: editingId }),
        })
        // if publishing a draft, also flip its status
        if (status === 'open' && editingDraft) {
          await fetch('/api/recruitment', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'publish_draft', job_id: editingId }),
          })
        }
      } else {
        res = await fetch('/api/recruitment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save job')
      setFormOpen(false); resetForm()
      await fetchAll(companyId, internalUserId)
      if (status === 'open') setActiveTab('live')
      else setActiveTab('drafts')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save job')
    } finally { setActionLoading(false) }
  }

  const generateJobDescription = async () => {
    if (!formTitle.trim()) { setFormError('Add a title before generating.'); return }
    setAiLoading(true); setFormError('')
    try {
      const deptName = departments.find(d => d.id === formDeptId)?.name ?? null
      const res = await fetch('/api/ai/job-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle, company_name: companyName, department_name: deptName,
          location: formLocation, employment_type: formEmpType,
          pay: formSalaryAmt ? `${formSalaryAmt} ${formSalaryType}` : null,
          notes: formRequirements || formDescription || null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to generate description')
      const draft = data.draft
      setFormTitle(draft.title || formTitle)
      setFormDescription(draft.description || formDescription)
      setFormRequirements([
        ...(draft.requirements ?? []),
        ...(draft.responsibilities ?? []).map((i: string) => `Responsibility: ${i}`),
        ...(draft.screening_questions ?? []).map((i: string) => `Screening: ${i}`),
      ].join('\n'))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to generate description')
    } finally { setAiLoading(false) }
  }

  // ── posting actions ──────────────────────────────────────────────────────────

  const runPostingAction = async (action: 'archive_posting' | 'duplicate_posting', jobId?: string) => {
    const id = jobId ?? selectedLiveId
    if (!id) return
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, job_id: id, created_by: internalUserId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed')
      await fetchAll(companyId, internalUserId)
      if (data.posting?.id) setSelectedLiveId(data.posting.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update job')
    } finally { setActionLoading(false) }
  }

  const decideApplicant = async (applicantId: string, decision: 'accepted' | 'rejected') => {
    if (!internalUserId) return
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decide_applicant', applicant_id: applicantId, decision, decided_by: internalUserId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update applicant')
      await Promise.all([fetchApplicants(selectedLiveId), fetchAll(companyId, internalUserId)])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update applicant')
    } finally { setActionLoading(false) }
  }

  const decidePosting = async (jobId: string, decision: 'approve_posting' | 'reject_posting') => {
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: decision, job_id: jobId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update posting')
      await fetchAll(companyId, internalUserId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update posting')
    } finally { setActionLoading(false) }
  }

  const deleteDraft = async (id: string) => {
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_draft', job_id: id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to delete draft')
      setDeleteConfirm(null)
      await fetchAll(companyId, internalUserId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete draft')
    } finally { setActionLoading(false) }
  }

  const publishDraft = async (id: string) => {
    setActionLoading(true); setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish_draft', job_id: id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to publish draft')
      await fetchAll(companyId, internalUserId)
      setActiveTab('live')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish draft')
    } finally { setActionLoading(false) }
  }

  const recommendCandidates = async () => {
    if (!selectedLiveId) return
    setAiLoading(true); setError('')
    try {
      const res = await fetch(`/api/ai/candidates?job_id=${selectedLiveId}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to recommend candidates')
      setRecommendations(data.recommendations ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recommend candidates')
    } finally { setAiLoading(false) }
  }

  // ── derived lists ────────────────────────────────────────────────────────────

  const openPostings = useMemo(() => livePostings.filter(p => p.status === 'open'), [livePostings])
  const archivedPostings = useMemo(() => livePostings.filter(p => p.status !== 'open'), [livePostings])

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F7F8FA', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <OwnerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ── Page header (keep untouched) ── */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              {companyName ? `Recruitment for ${companyName}` : 'Recruitment'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {ownerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#0F172A', color: '#FFFFFF', flexShrink: 0 }}>
                  <Crown size={13} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ownerName}</span>
              </div>
            )}
            {companyId && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        {error && (
          <div style={{ margin: '0 28px 0', padding: '11px 14px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, fontSize: '0.84rem', fontWeight: 600 }}>{error}</div>
        )}

        {/* ── Tab bar (Communication style) ── */}
        <div style={{ padding: '12px 28px 0', flexShrink: 0 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '0 18px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {([
                { key: 'live' as Tab,     label: 'Job Posted', icon: <Briefcase size={14} />,     badge: openPostings.length },
                { key: 'archived' as Tab, label: 'Archived',   icon: <Archive size={14} />,        badge: 0 },
                { key: 'drafts' as Tab,   label: 'Drafts',     icon: <FileText size={14} />,       badge: drafts.length },
                { key: 'review' as Tab,   label: 'Review',     icon: <ClipboardList size={14} />,  badge: pendingPostings.length },
              ]).map(tab => {
                const active = activeTab === tab.key
                const badgeOrange = tab.key === 'review' && tab.badge > 0
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      height: 38, padding: '0 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                      background: active ? '#FFF7ED' : '#F8FAFC',
                      border: active ? '1.5px solid rgba(249,115,22,0.35)' : '1.5px solid #E2E8F0',
                      color: active ? '#F97316' : '#64748B',
                      display: 'flex', alignItems: 'center', gap: 7,
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.badge > 0 && (
                      <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: badgeOrange ? '#F97316' : (active ? '#F97316' : '#E2E8F0'), color: badgeOrange || active ? '#fff' : '#6B7280', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {/* AI Post Job button lives in the tab bar right side */}
            <button
              onClick={openNewForm}
              style={{ height: 36, padding: '0 16px', background: '#F97316', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13, flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#EA580C')}
              onMouseLeave={e => (e.currentTarget.style.background = '#F97316')}
            >
              <Sparkles size={14} /> AI Post Job
            </button>
          </div>
        </div>

        {/* ── Tab content ── */}
        <div style={{ padding: '16px 28px 28px', flex: 1, minHeight: 0 }}>

          {/* ══ LIVE JOBS tab ══════════════════════════════════════════════════ */}
          {activeTab === 'live' && (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>

              {/* Left: job list */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#A0AEC0', letterSpacing: '0.07em', textTransform: 'uppercase', flex: 1 }}>Open Jobs</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#CBD5E0', background: '#F7F8FA', padding: '2px 8px', borderRadius: 99 }}>{openPostings.length}</span>
                </div>
                {loading ? (
                  <div style={{ padding: '24px 18px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Spinner size={14} dark /> Loading...
                  </div>
                ) : openPostings.length === 0 ? (
                  <div style={{ padding: '28px 18px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>No open job postings yet.</div>
                ) : openPostings.map(p => {
                  const isSelected = selectedLiveId === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedLiveId(p.id)}
                      style={{
                        width: '100%', border: 'none', borderBottom: '1px solid #F0F4F8',
                        background: isSelected ? '#FFF7ED' : '#FFFFFF',
                        padding: '13px 18px', textAlign: 'left', cursor: 'pointer',
                        borderLeft: isSelected ? '3px solid #F97316' : '3px solid transparent',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#FAFBFC' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#FFFFFF' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', marginBottom: 5 }}>
                        <strong style={{ fontSize: '0.875rem', color: '#111827', lineHeight: 1.3, flex: 1 }}>{p.title}</strong>
                        {statusBadge(p.status)}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.775rem', color: '#9CA3AF' }}>
                        {p.department_name ?? 'Any dept'} · {p.applicant_count} applicant{p.applicant_count !== 1 ? 's' : ''}
                      </p>
                    </button>
                  )
                })}
              </div>

              {/* Right: posting detail + applicants */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, minHeight: 520, overflow: 'hidden' }}>
                {!selectedLive ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', color: '#CBD5E0', gap: 10 }}>
                    <ClipboardList size={32} strokeWidth={1.5} />
                    <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500 }}>Select a job posting</p>
                  </div>
                ) : (
                  <>
                    {/* Posting header */}
                    <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F0F4F8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#111827', fontWeight: 700, lineHeight: 1.3 }}>{selectedLive.title}</h2>
                          {statusBadge(selectedLive.status)}
                        </div>
                        <p style={{ margin: 0, color: '#9CA3AF', fontSize: '0.8375rem' }}>
                          {[selectedLive.department_name ?? 'Any department', selectedLive.location, selectedLive.employment_type].filter(Boolean).join(' · ')}
                          {selectedLive.salary_amount ? ` · $${selectedLive.salary_amount} ${selectedLive.salary_type ?? ''}` : ''}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => openEditForm(selectedLive)} style={{ border: '1.5px solid #E5E7EB', background: '#FFFFFF', borderRadius: 8, padding: '7px 14px', fontWeight: 600, fontSize: '0.8125rem', color: '#374151', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
                        >Edit</button>
                        <button onClick={() => runPostingAction('duplicate_posting')} disabled={actionLoading} title="Duplicate"
                          style={{ border: '1.5px solid #E5E7EB', background: '#FFFFFF', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
                        ><Copy size={14} /></button>
                        <button onClick={() => runPostingAction('archive_posting')} disabled={actionLoading || selectedLive.status === 'archived'} title="Archive"
                          style={{ border: 'none', background: '#1C1C1E', color: '#FFFFFF', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: selectedLive.status === 'archived' ? 'default' : 'pointer', opacity: selectedLive.status === 'archived' ? 0.4 : 1 }}
                        ><Archive size={14} /></button>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div style={{ padding: '16px 24px 0' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {[
                          { label: 'Pay', value: selectedLive.salary_amount ? `$${selectedLive.salary_amount} ${selectedLive.salary_type ?? ''}` : '—' },
                          { label: 'Pending', value: selectedLive.pending_count },
                          { label: 'Total Applicants', value: selectedLive.applicant_count },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ padding: '11px 14px', background: '#F7F8FA', borderRadius: 10 }}>
                            <span style={labelStyle}>{label}</span>
                            <strong style={{ fontSize: '1.1rem', color: '#111827' }}>{value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Description */}
                      <div>
                        <span style={labelStyle}>Description</span>
                        <p style={{ margin: 0, color: '#374151', lineHeight: 1.7, fontSize: '0.9rem' }}>{selectedLive.description}</p>
                      </div>
                      {selectedLive.requirements && (
                        <div>
                          <span style={labelStyle}>Requirements</span>
                          <p style={{ margin: 0, color: '#374151', lineHeight: 1.7, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{selectedLive.requirements}</p>
                        </div>
                      )}

                      {/* Applicants */}
                      <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={labelStyle}>Applicants ({applicants.length})</span>
                          <button
                            onClick={recommendCandidates}
                            disabled={aiLoading || applicants.length === 0}
                            style={{ border: 'none', borderRadius: 7, background: '#111827', color: '#FFFFFF', padding: '6px 14px', display: 'flex', gap: 6, alignItems: 'center', cursor: aiLoading || applicants.length === 0 ? 'default' : 'pointer', opacity: aiLoading || applicants.length === 0 ? 0.5 : 1, fontSize: '0.775rem', fontWeight: 700 }}
                          >
                            {aiLoading ? <Spinner size={12} /> : <Sparkles size={12} />} AI Recommend
                          </button>
                        </div>

                        {applicants.length === 0 ? (
                          <div style={{ padding: '20px 16px', color: '#9CA3AF', background: '#F7F8FA', borderRadius: 10, textAlign: 'center', fontSize: '0.875rem' }}>No applicants yet.</div>
                        ) : applicants.map(applicant => {
                          const rec = recommendations.find(r => r.applicant_id === applicant.id)
                          return (
                            <div key={applicant.id} style={{ padding: '14px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, marginBottom: 10, display: 'flex', justifyContent: 'space-between', gap: 12, background: '#FFFFFF' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1C1C1E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0 }}>
                                    {applicant.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                                  </div>
                                  <strong style={{ color: '#111827', fontSize: '0.9rem' }}>{applicant.full_name}</strong>
                                </div>
                                <p style={{ margin: '2px 0 0 36px', color: '#9CA3AF', fontSize: '0.775rem' }}>{applicant.email_address}</p>
                                {applicant.cover_letter && (
                                  <p style={{ margin: '8px 0 0', color: '#4B5563', fontSize: '0.8125rem', lineHeight: 1.5 }}>{applicant.cover_letter}</p>
                                )}
                                {rec && (
                                  <div style={{ marginTop: 10, padding: '10px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: '0.78rem', lineHeight: 1.5 }}>
                                    <strong style={{ color: '#059669' }}>AI Score: {rec.score}/100 — {rec.recommendation}</strong>
                                    <p style={{ margin: '4px 0 0', color: '#374151' }}>{rec.reasons[0] ?? rec.suggested_next_step}</p>
                                    {rec.risks[0] && <p style={{ margin: '3px 0 0', color: '#B45309' }}>{rec.risks[0]}</p>}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                                {statusBadge(applicant.status)}
                                {applicant.status === 'pending' && (
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => decideApplicant(applicant.id, 'accepted')} disabled={actionLoading}
                                      style={{ border: 'none', borderRadius: 7, background: '#059669', color: '#FFFFFF', padding: '6px 10px', display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer', fontSize: '0.775rem', fontWeight: 600 }}
                                    ><UserCheck size={13} /> Accept</button>
                                    <button onClick={() => decideApplicant(applicant.id, 'rejected')} disabled={actionLoading}
                                      style={{ border: 'none', borderRadius: 7, background: '#DC2626', color: '#FFFFFF', padding: '6px 10px', display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer', fontSize: '0.775rem', fontWeight: 600 }}
                                    ><UserX size={13} /> Reject</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══ ARCHIVED tab ══════════════════════════════════════════════════ */}
          {activeTab === 'archived' && (
            <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#A0AEC0', letterSpacing: '0.07em', textTransform: 'uppercase', flex: 1 }}>Archived &amp; Closed Postings</span>
                {archivedPostings.length > 0 && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', background: '#F3F4F6', padding: '2px 9px', borderRadius: 99 }}>{archivedPostings.length}</span>
                )}
              </div>
              {loading ? (
                <div style={{ padding: '28px 20px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Spinner size={14} dark /> Loading...
                </div>
              ) : archivedPostings.length === 0 ? (
                <div style={{ padding: '48px 20px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <Archive size={28} strokeWidth={1.5} />
                  <span>No archived postings.</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, padding: 20 }}>
                  {archivedPostings.map(p => (
                    <div key={p.id} style={{ border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '16px 18px', background: '#F9FAFB', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <strong style={{ fontSize: '0.9375rem', color: '#374151', lineHeight: 1.3, flex: 1 }}>{p.title}</strong>
                        {statusBadge(p.status)}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#9CA3AF', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {p.department_name && <span>{p.department_name}{p.employment_type ? ` · ${p.employment_type}` : ''}</span>}
                        <span>{p.applicant_count} applicant{p.applicant_count !== 1 ? 's' : ''}</span>
                        {p.salary_amount && <span>${p.salary_amount} {p.salary_type ?? ''}</span>}
                      </div>
                      {p.description && (
                        <p style={{ margin: 0, fontSize: '0.825rem', color: '#6B7280', lineHeight: 1.55, maxHeight: 60, overflow: 'hidden' }}>{p.description}</p>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                          onClick={() => runPostingAction('duplicate_posting', p.id)}
                          disabled={actionLoading}
                          style={{ flex: 1, border: '1.5px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', color: '#374151', padding: '7px 0', fontWeight: 700, fontSize: '0.825rem', cursor: actionLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: actionLoading ? 0.6 : 1 }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
                        ><Copy size={13} /> Duplicate</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ REVIEW tab ════════════════════════════════════════════════════ */}
          {activeTab === 'review' && (
            <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#A0AEC0', letterSpacing: '0.07em', textTransform: 'uppercase', flex: 1 }}>Manager Job Submissions — Pending Your Approval</span>
                {pendingPostings.length > 0 && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#B45309', background: '#FFFBEB', padding: '2px 9px', borderRadius: 99, border: '1px solid #FDE68A' }}>{pendingPostings.length} pending</span>
                )}
              </div>
              {loading ? (
                <div style={{ padding: '28px 20px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Spinner size={14} dark /> Loading...
                </div>
              ) : pendingPostings.length === 0 ? (
                <div style={{ padding: '40px 20px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <CheckCircle size={28} strokeWidth={1.5} style={{ color: '#10B981' }} />
                  <span>All caught up — no manager submissions pending.</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, padding: 20 }}>
                  {pendingPostings.map(p => (
                    <div key={p.id} style={{ border: '1.5px solid #FDE68A', borderRadius: 12, padding: '16px 18px', background: '#FFFDF7', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <strong style={{ fontSize: '0.9375rem', color: '#111827', lineHeight: 1.3, flex: 1 }}>{p.title}</strong>
                        {statusBadge('pending_approval')}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6B7280', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span>{p.department_name ?? 'Any dept'}{p.employment_type ? ` · ${p.employment_type}` : ''}</span>
                        <span>Submitted by <strong style={{ color: '#374151' }}>{p.submitter_name ?? 'Manager'}</strong> · {new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                      {p.description && (
                        <p style={{ margin: 0, fontSize: '0.825rem', color: '#4B5563', lineHeight: 1.55, maxHeight: 60, overflow: 'hidden' }}>{p.description}</p>
                      )}
                      {p.requirements && (
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#6B7280', lineHeight: 1.5, maxHeight: 44, overflow: 'hidden', whiteSpace: 'pre-wrap' }}>{p.requirements}</p>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                          onClick={() => decidePosting(p.id, 'approve_posting')}
                          disabled={actionLoading}
                          style={{ flex: 1, border: 'none', borderRadius: 8, background: '#059669', color: '#FFFFFF', padding: '8px 0', fontWeight: 700, fontSize: '0.825rem', cursor: actionLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: actionLoading ? 0.6 : 1 }}
                        ><CheckCircle size={13} /> Approve</button>
                        <button
                          onClick={() => decidePosting(p.id, 'reject_posting')}
                          disabled={actionLoading}
                          style={{ flex: 1, border: 'none', borderRadius: 8, background: '#DC2626', color: '#FFFFFF', padding: '8px 0', fontWeight: 700, fontSize: '0.825rem', cursor: actionLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: actionLoading ? 0.6 : 1 }}
                        ><XCircle size={13} /> Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ DRAFTS tab ════════════════════════════════════════════════════ */}
          {activeTab === 'drafts' && (
            <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: cardShadow, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#A0AEC0', letterSpacing: '0.07em', textTransform: 'uppercase', flex: 1 }}>My Draft Postings</span>
                {drafts.length > 0 && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', padding: '2px 9px', borderRadius: 99 }}>{drafts.length}</span>
                )}
              </div>
              {loading ? (
                <div style={{ padding: '28px 20px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Spinner size={14} dark /> Loading...
                </div>
              ) : drafts.length === 0 ? (
                <div style={{ padding: '48px 20px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <FileText size={28} strokeWidth={1.5} />
                  <span>No drafts saved. Click <strong style={{ color: '#111827' }}>AI Post Job</strong> and save as draft.</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, padding: 20 }}>
                  {drafts.map(p => (
                    <div key={p.id} style={{ border: '1.5px solid #BFDBFE', borderRadius: 12, padding: '16px 18px', background: '#F8FAFF', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <strong style={{ fontSize: '0.9375rem', color: '#111827', lineHeight: 1.3, flex: 1 }}>{p.title}</strong>
                        {statusBadge('draft')}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6B7280', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {p.department_name && <span>{p.department_name}{p.employment_type ? ` · ${p.employment_type}` : ''}</span>}
                        <span>Last updated {new Date(p.updated_at).toLocaleDateString()}</span>
                      </div>
                      {p.description && (
                        <p style={{ margin: 0, fontSize: '0.825rem', color: '#4B5563', lineHeight: 1.55, maxHeight: 60, overflow: 'hidden' }}>{p.description}</p>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                          onClick={() => openEditForm(p, true)}
                          style={{ flex: 1, border: '1.5px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', color: '#374151', padding: '7px 0', fontWeight: 700, fontSize: '0.825rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
                        >Edit</button>
                        <button
                          onClick={() => publishDraft(p.id)}
                          disabled={actionLoading || !p.description?.trim()}
                          title={!p.description?.trim() ? 'Add a description before publishing' : undefined}
                          style={{ flex: 1, border: 'none', borderRadius: 8, background: '#111827', color: '#FFFFFF', padding: '7px 0', fontWeight: 700, fontSize: '0.825rem', cursor: actionLoading || !p.description?.trim() ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: actionLoading || !p.description?.trim() ? 0.5 : 1 }}
                        ><Send size={12} /> Publish</button>
                        <button
                          onClick={() => setDeleteConfirm({ id: p.id, title: p.title })}
                          style={{ border: 'none', borderRadius: 8, background: '#FEF2F2', color: '#DC2626', padding: '7px 10px', fontWeight: 700, fontSize: '0.825rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#FEE2E2')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#FEF2F2')}
                        ><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* ══ AI Post Job / Edit modal ══════════════════════════════════════════ */}
      {formOpen && (
        <div onClick={() => { setFormOpen(false); resetForm() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 640, maxHeight: '90vh', overflowY: 'auto', background: '#FFFFFF', borderRadius: 16, boxShadow: '0 12px 48px rgba(0,0,0,0.18)' }}>

            {/* Modal header */}
            <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#FFFFFF', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={15} color="#fff" />
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827' }}>
                  {editingId ? (editingDraft ? 'Edit Draft' : 'Edit Job Posting') : 'AI Job Posting'}
                </span>
              </div>
              <button onClick={() => { setFormOpen(false); resetForm() }} style={{ border: 'none', background: '#F9FAFB', color: '#6B7280', cursor: 'pointer', display: 'flex', padding: '6px', borderRadius: 8 }}>
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px 24px', display: 'grid', gap: 13 }}>

              {/* Title + AI generate */}
              <div><label style={labelStyle}>Title <span style={{ color: '#F97316' }}>*</span></label>
                <input data-testid="job-title-input" value={formTitle} onChange={e => setFormTitle(e.target.value)} style={inputStyle} placeholder="e.g. Barista, Kitchen Hand…" />
              </div>

              <button onClick={generateJobDescription} disabled={aiLoading || !formTitle.trim()}
                style={{ border: 'none', borderRadius: 8, background: '#111827', color: '#FFFFFF', padding: '10px 0', fontWeight: 800, cursor: aiLoading || !formTitle.trim() ? 'default' : 'pointer', opacity: aiLoading || !formTitle.trim() ? 0.55 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}
              >
                {aiLoading ? <Spinner size={14} /> : <Sparkles size={14} />} Generate description, requirements & questions
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>Department</label>
                  <select value={formDeptId} onChange={e => setFormDeptId(e.target.value)} style={inputStyle}>
                    <option value="">Any department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Employment Type</label>
                  <input value={formEmpType} onChange={e => setFormEmpType(e.target.value)} style={inputStyle} placeholder="Casual" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>Location</label>
                  <input value={formLocation} onChange={e => setFormLocation(e.target.value)} style={inputStyle} />
                </div>
                <div><label style={labelStyle}>Pay</label>
                  <input type="number" min={0} value={formSalaryAmt} onChange={e => setFormSalaryAmt(e.target.value)} style={inputStyle} />
                </div>
                <div><label style={labelStyle}>Pay Type</label>
                  <input value={formSalaryType} onChange={e => setFormSalaryType(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div><label style={labelStyle}>Description {editingDraft && <span style={{ fontWeight: 400, color: '#9CA3AF', textTransform: 'none', letterSpacing: 0 }}>(required to publish)</span>}</label>
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </div>

              <div><label style={labelStyle}>Requirements</label>
                <textarea value={formRequirements} onChange={e => setFormRequirements(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </div>

              {formError && (
                <div style={{ padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, fontSize: '0.84rem', fontWeight: 700 }}>{formError}</div>
              )}

              {/* Footer buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => { setFormOpen(false); resetForm() }}
                  style={{ flex: 1, border: '1.5px solid #E5E7EB', background: '#FFFFFF', color: '#374151', borderRadius: 8, padding: 11, fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}
                >Cancel</button>
                <button onClick={() => saveForm('draft')} disabled={actionLoading}
                  style={{ flex: 1, border: '1.5px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', borderRadius: 8, padding: 11, fontWeight: 700, cursor: actionLoading ? 'default' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, fontSize: '0.875rem', opacity: actionLoading ? 0.6 : 1 }}
                >
                  {actionLoading ? <Spinner size={13} dark /> : <FileText size={14} />} Save as Draft
                </button>
                <button onClick={() => saveForm('open')} disabled={actionLoading}
                  style={{ flex: 1, border: 'none', background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFFFFF', borderRadius: 8, padding: 11, fontWeight: 700, cursor: actionLoading ? 'default' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, fontSize: '0.875rem', opacity: actionLoading ? 0.7 : 1 }}
                >
                  {actionLoading ? <Spinner size={13} /> : <Send size={14} />} Post Job
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Delete draft confirm modal ════════════════════════════════════════ */}
      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.42)', zIndex: 110, display: 'grid', placeItems: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 420, background: '#FFFFFF', borderRadius: 16, padding: '24px', boxShadow: '0 24px 70px rgba(15,23,42,0.28)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Delete Draft</h2>
              <button onClick={() => setDeleteConfirm(null)} style={{ border: 'none', background: '#F9FAFB', color: '#6B7280', cursor: 'pointer', padding: '5px', borderRadius: 7, display: 'flex' }}><X size={15} /></button>
            </div>
            <p style={{ margin: '0 0 20px', color: '#6B7280', fontSize: '0.9rem', lineHeight: 1.55 }}>
              Permanently delete the draft <strong style={{ color: '#111827' }}>"{deleteConfirm.title}"</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ border: '1.5px solid #E5E7EB', background: '#FFFFFF', color: '#374151', borderRadius: 8, padding: '8px 18px', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
              <button onClick={() => deleteDraft(deleteConfirm.id)} disabled={actionLoading}
                style={{ border: 'none', background: '#DC2626', color: '#FFFFFF', borderRadius: 8, padding: '8px 18px', fontWeight: 700, cursor: actionLoading ? 'default' : 'pointer', fontSize: '0.875rem', opacity: actionLoading ? 0.65 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {actionLoading ? <Spinner size={13} /> : <Trash2 size={13} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
