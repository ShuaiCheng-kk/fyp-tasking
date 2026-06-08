'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Archive, Copy, Crown, Plus, Send, Sparkles, UserCheck, UserX, X } from 'lucide-react'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import { CandidateRecommendation } from '@/types/AI'
import { CasualWorkerStatus, JobApplicant, JobPostingSummary } from '@/types/Recruitment'

type Department = { id: string; name: string }

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

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function statusColor(status: string): { bg: string; text: string } {
  if (status === 'open' || status === 'active' || status === 'accepted') return { bg: '#ECFDF5', text: '#047857' }
  if (status === 'archived' || status === 'inactive') return { bg: '#F3F4F6', text: '#4B5563' }
  if (status === 'blocked' || status === 'rejected') return { bg: '#FEF2F2', text: '#B91C1C' }
  return { bg: '#FFFBEB', text: '#B45309' }
}

export default function OwnerRecruitmentPage() {
  const router = useRouter()
  const [internalUserId, setInternalUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [currentPlan, setCurrentPlan] = useState('Free')
  const [departments, setDepartments] = useState<Department[]>([])
  const [postings, setPostings] = useState<JobPostingSummary[]>([])
  const [selectedPostingId, setSelectedPostingId] = useState('')
  const [applicants, setApplicants] = useState<JobApplicant[]>([])
  const [workers, setWorkers] = useState<CasualWorkerStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<CandidateRecommendation[]>([])
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState('')

  const [title, setTitle] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [employmentType, setEmploymentType] = useState('Casual')
  const [location, setLocation] = useState('')
  const [salaryAmount, setSalaryAmount] = useState('')
  const [salaryType, setSalaryType] = useState('per hour')
  const [description, setDescription] = useState('')
  const [requirements, setRequirements] = useState('')

  const selectedPosting = useMemo(
    () => postings.find(posting => posting.id === selectedPostingId) ?? null,
    [postings, selectedPostingId],
  )

  const resetForm = () => {
    setEditingId('')
    setTitle('')
    setDepartmentId('')
    setEmploymentType('Casual')
    setLocation('')
    setSalaryAmount('')
    setSalaryType('per hour')
    setDescription('')
    setRequirements('')
    setError('')
  }

  const openCreateForm = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEditForm = (posting: JobPostingSummary) => {
    setEditingId(posting.id)
    setTitle(posting.title)
    setDepartmentId(posting.department_id ?? '')
    setEmploymentType(posting.employment_type ?? 'Casual')
    setLocation(posting.location ?? '')
    setSalaryAmount(posting.salary_amount?.toString() ?? '')
    setSalaryType(posting.salary_type ?? 'per hour')
    setDescription(posting.description)
    setRequirements(posting.requirements ?? '')
    setError('')
    setFormOpen(true)
  }

  const fetchRecruitmentData = useCallback(async (cid: string) => {
    if (!cid) return
    setLoading(true)
    setError('')
    try {
      const [postingRes, workerRes, deptRes] = await Promise.all([
        fetch(`/api/recruitment?company_id=${cid}`),
        fetch(`/api/recruitment?company_id=${cid}&resource=workers`),
        fetch(`/api/company/departments?company_id=${cid}`),
      ])
      const postingData = await postingRes.json()
      const workerData = await workerRes.json()
      const deptData = await deptRes.json()
      if (!postingData.success) throw new Error(postingData.message || 'Failed to fetch jobs')
      if (!workerData.success) throw new Error(workerData.message || 'Failed to fetch workers')
      setPostings(postingData.postings ?? [])
      setWorkers(workerData.workers ?? [])
      if (deptData.success) setDepartments(deptData.departments ?? [])
      const nextSelected = selectedPostingId && (postingData.postings ?? []).some((posting: JobPostingSummary) => posting.id === selectedPostingId)
        ? selectedPostingId
        : postingData.postings?.[0]?.id ?? ''
      setSelectedPostingId(nextSelected)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recruitment data')
    } finally {
      setLoading(false)
    }
  }, [selectedPostingId])

  const fetchApplicants = useCallback(async (jobId: string) => {
    if (!jobId) { setApplicants([]); return }
    try {
      const res = await fetch(`/api/recruitment?resource=applicants&job_id=${jobId}`)
      const data = await res.json()
      if (data.success) setApplicants(data.applicants ?? [])
    } catch {
      setApplicants([])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let authId = localStorage.getItem('tasking_user_id')
      if (!authId) {
        const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          authId = session.user.id
          localStorage.setItem('tasking_user_id', authId)
        }
      }
      if (!authId) { router.replace('/signin'); return }
      if (cancelled) return

      const meRes = await fetch(`/api/user/me?user_id=${authId}`)
      const meData = await meRes.json()
      if (!meData.success) return
      setInternalUserId(meData.user.id)
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
      if (!cancelled) await fetchRecruitmentData(storedCid)
    }
    void run()
    return () => { cancelled = true }
  }, [router, fetchRecruitmentData])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchApplicants(selectedPostingId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [selectedPostingId, fetchApplicants])

  const savePosting = async () => {
    if (!companyId || !internalUserId) return
    setActionLoading(true)
    setError('')
    const salary = salaryAmount ? Number(salaryAmount) : null
    try {
      const body = {
        company_id: companyId,
        department_id: departmentId || null,
        created_by: internalUserId,
        title,
        description,
        requirements: requirements || null,
        location: location || null,
        employment_type: employmentType || null,
        company_name: companyName || null,
        salary_amount: salary,
        salary_type: salaryType || 'per hour',
      }
      const res = await fetch('/api/recruitment', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { ...body, action: 'edit_posting', job_id: editingId } : body),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save job')
      setFormOpen(false)
      resetForm()
      await fetchRecruitmentData(companyId)
      setSelectedPostingId(data.posting?.id ?? selectedPostingId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save job')
    } finally {
      setActionLoading(false)
    }
  }

  const runPostingAction = async (action: 'archive_posting' | 'duplicate_posting') => {
    if (!selectedPosting || !companyId || !internalUserId) return
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, job_id: selectedPosting.id, created_by: internalUserId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update job')
      await fetchRecruitmentData(companyId)
      if (data.posting?.id) setSelectedPostingId(data.posting.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update job')
    } finally {
      setActionLoading(false)
    }
  }

  const decideApplicant = async (applicantId: string, decision: 'accepted' | 'rejected') => {
    if (!companyId || !internalUserId) return
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decide_applicant', applicant_id: applicantId, decision, decided_by: internalUserId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update applicant')
      await Promise.all([fetchApplicants(selectedPostingId), fetchRecruitmentData(companyId)])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update applicant')
    } finally {
      setActionLoading(false)
    }
  }

  const updateWorkerStatus = async (workerId: string, workerStatus: 'active' | 'inactive' | 'blocked') => {
    if (!companyId) return
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_worker_status', user_id: workerId, worker_status: workerStatus }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update worker')
      await fetchRecruitmentData(companyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update worker')
    } finally {
      setActionLoading(false)
    }
  }

  const recommendCandidates = async () => {
    if (!selectedPostingId) return
    setAiLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/ai/candidates?job_id=${selectedPostingId}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to recommend candidates')
      setRecommendations(data.recommendations ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recommend candidates')
    } finally {
      setAiLoading(false)
    }
  }

  const generateJobDescription = async () => {
    if (!title.trim()) { setError('Add a title before generating.'); return }
    setAiLoading(true)
    setError('')
    try {
      const departmentName = departments.find(department => department.id === departmentId)?.name ?? null
      const res = await fetch('/api/ai/job-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          company_name: companyName,
          department_name: departmentName,
          location,
          employment_type: employmentType,
          pay: salaryAmount ? `${salaryAmount} ${salaryType}` : null,
          notes: requirements || description || null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to generate job description')
      const draft = data.draft
      setTitle(draft.title || title)
      setDescription(draft.description || description)
      setRequirements([
        ...(draft.requirements ?? []),
        ...(draft.responsibilities ?? []).map((item: string) => `Responsibility: ${item}`),
        ...(draft.screening_questions ?? []).map((item: string) => `Screening: ${item}`),
      ].join('\n'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate job description')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F7F8FA', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <OwnerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Page header — matches Dashboard style */}
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

        <div style={{ padding: '0 28px 8px', flexShrink: 0 }}>
          <button
            onClick={openCreateForm}
            data-testid="new-job-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 8, background: '#F97316', color: '#FFFFFF', padding: '9px 18px', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#EA6C0A')}
            onMouseLeave={e => (e.currentTarget.style.background = '#F97316')}
          >
            <Plus size={14} /> New Job
          </button>
        </div>

        <div style={{ padding: '0 28px 24px', display: 'grid', gridTemplateColumns: '300px 1fr 320px', gap: 20, alignItems: 'start' }}>

          {/* Left: Job postings list */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#A0AEC0', letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1 }}>Job Postings</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#CBD5E0', background: '#F7F8FA', padding: '2px 8px', borderRadius: 99 }}>{postings.length}</span>
            </div>
            {loading ? (
              <div style={{ padding: '24px 18px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>Loading...</div>
            ) : postings.length === 0 ? (
              <div style={{ padding: '24px 18px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>No job postings yet.</div>
            ) : postings.map(posting => {
              const colors = statusColor(posting.status)
              const isSelected = selectedPostingId === posting.id
              return (
                <button
                  key={posting.id}
                  onClick={() => setSelectedPostingId(posting.id)}
                  style={{
                    width: '100%', border: 'none', borderBottom: '1px solid #F0F4F8',
                    background: isSelected ? '#FFF7ED' : '#FFFFFF',
                    padding: '14px 18px', textAlign: 'left', cursor: 'pointer',
                    transition: 'background 0.1s',
                    borderLeft: isSelected ? '3px solid #F97316' : '3px solid transparent',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#FAFBFC' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#FFFFFF' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <strong style={{ fontSize: '0.875rem', color: '#111827', lineHeight: 1.3, flex: 1 }}>{posting.title}</strong>
                    <span style={{ background: colors.bg, color: colors.text, borderRadius: 999, padding: '2px 8px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>{posting.status}</span>
                  </div>
                  <p style={{ margin: '5px 0 0', fontSize: '0.775rem', color: '#9CA3AF' }}>
                    {posting.department_name ?? 'Any dept'} · {posting.applicant_count} applicant{posting.applicant_count !== 1 ? 's' : ''}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Center: Posting detail */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)', minHeight: 520, overflow: 'hidden' }}>
            {error && (
              <div style={{ margin: 16, padding: '11px 14px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, fontSize: '0.84rem', fontWeight: 600 }}>{error}</div>
            )}
            {!selectedPosting ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', color: '#CBD5E0', gap: 10 }}>
                <UserCheck size={32} strokeWidth={1.5} />
                <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500 }}>Select a job posting</p>
              </div>
            ) : (
              <>
                <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F0F4F8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.125rem', color: '#111827', fontWeight: 700, lineHeight: 1.3 }}>{selectedPosting.title}</h2>
                    <p style={{ margin: '6px 0 0', color: '#9CA3AF', fontSize: '0.8375rem' }}>
                      {[selectedPosting.department_name ?? 'Any department', selectedPosting.location, selectedPosting.employment_type].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => openEditForm(selectedPosting)} style={{ border: '1.5px solid #E5E7EB', background: '#FFFFFF', borderRadius: 8, padding: '7px 14px', fontWeight: 600, fontSize: '0.8125rem', color: '#374151', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
                    >Edit</button>
                    <button onClick={() => runPostingAction('duplicate_posting')} disabled={actionLoading} title="Duplicate" style={{ border: '1.5px solid #E5E7EB', background: '#FFFFFF', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
                    ><Copy size={14} /></button>
                    <button onClick={() => runPostingAction('archive_posting')} disabled={actionLoading || selectedPosting.status === 'archived'} title="Archive" style={{ border: 'none', background: '#1C1C1E', color: '#FFFFFF', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: selectedPosting.status === 'archived' ? 'default' : 'pointer', opacity: selectedPosting.status === 'archived' ? 0.4 : 1 }}><Archive size={14} /></button>
                  </div>
                </div>

                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {[
                      { label: 'Pay', value: selectedPosting.salary_amount ? `${selectedPosting.salary_amount} ${selectedPosting.salary_type ?? ''}` : '—' },
                      { label: 'Pending', value: selectedPosting.pending_count },
                      { label: 'Applicants', value: selectedPosting.applicant_count },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ padding: '12px 14px', background: '#F7F8FA', borderRadius: 10 }}>
                        <span style={labelStyle}>{label}</span>
                        <strong style={{ fontSize: '1.125rem', color: '#111827' }}>{value}</strong>
                      </div>
                    ))}
                  </div>

                  <div>
                    <span style={labelStyle}>Description</span>
                    <p style={{ margin: 0, color: '#374151', lineHeight: 1.7, fontSize: '0.9rem' }}>{selectedPosting.description}</p>
                  </div>
                  {selectedPosting.requirements && (
                    <div>
                      <span style={labelStyle}>Requirements</span>
                      <p style={{ margin: 0, color: '#374151', lineHeight: 1.7, fontSize: '0.9rem' }}>{selectedPosting.requirements}</p>
                    </div>
                  )}

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={labelStyle}>Applicants ({applicants.length})</span>
                      <button
                        onClick={recommendCandidates}
                        disabled={aiLoading || applicants.length === 0}
                        style={{ border: 'none', borderRadius: 7, background: '#111827', color: '#FFFFFF', padding: '6px 12px', display: 'flex', gap: 6, alignItems: 'center', cursor: aiLoading || applicants.length === 0 ? 'default' : 'pointer', opacity: aiLoading || applicants.length === 0 ? 0.5 : 1, fontSize: '0.775rem', fontWeight: 700 }}
                      >
                        {aiLoading ? <Spinner size={12} /> : <Sparkles size={12} />} AI Recommend
                      </button>
                    </div>
                    {applicants.length === 0 ? (
                      <div style={{ padding: '20px 16px', color: '#9CA3AF', background: '#F7F8FA', borderRadius: 10, textAlign: 'center', fontSize: '0.875rem' }}>No applicants yet.</div>
                    ) : applicants.map(applicant => {
                      const colors = statusColor(applicant.status)
                      const recommendation = recommendations.find(item => item.applicant_id === applicant.id)
                      return (
                        <div key={applicant.id} style={{ padding: '14px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, marginBottom: 10, display: 'flex', justifyContent: 'space-between', gap: 12, background: '#FFFFFF' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1C1C1E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0 }}>
                                {applicant.full_name.charAt(0).toUpperCase()}
                              </div>
                              <strong style={{ color: '#111827', fontSize: '0.9rem' }}>{applicant.full_name}</strong>
                            </div>
                            <p style={{ margin: '2px 0 0 36px', color: '#9CA3AF', fontSize: '0.775rem' }}>{applicant.email_address}</p>
                            {applicant.cover_letter && <p style={{ margin: '8px 0 0', color: '#4B5563', fontSize: '0.8125rem', lineHeight: 1.5 }}>{applicant.cover_letter}</p>}
                            {recommendation && (
                              <div style={{ marginTop: 10, padding: '10px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: '0.78rem', lineHeight: 1.5 }}>
                                <strong style={{ color: '#059669' }}>AI Score: {recommendation.score}/100 — {recommendation.recommendation}</strong>
                                <p style={{ margin: '4px 0 0', color: '#374151' }}>{recommendation.reasons[0] ?? recommendation.suggested_next_step}</p>
                                {recommendation.risks[0] && <p style={{ margin: '3px 0 0', color: '#B45309' }}>{recommendation.risks[0]}</p>}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                            <span style={{ background: colors.bg, color: colors.text, borderRadius: 999, padding: '3px 10px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>{applicant.status}</span>
                            {applicant.status === 'pending' && (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => decideApplicant(applicant.id, 'accepted')} disabled={actionLoading} style={{ border: 'none', borderRadius: 7, background: '#059669', color: '#FFFFFF', padding: '6px 10px', display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer', fontSize: '0.775rem', fontWeight: 600 }}><UserCheck size={13} /> Accept</button>
                                <button onClick={() => decideApplicant(applicant.id, 'rejected')} disabled={actionLoading} style={{ border: 'none', borderRadius: 7, background: '#DC2626', color: '#FFFFFF', padding: '6px 10px', display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer', fontSize: '0.775rem', fontWeight: 600 }}><UserX size={13} /> Reject</button>
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

          {/* Right: Casual worker access */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#A0AEC0', letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1 }}>Casual Workers</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#CBD5E0', background: '#F7F8FA', padding: '2px 8px', borderRadius: 99 }}>{workers.length}</span>
            </div>
            {workers.length === 0 ? (
              <div style={{ padding: '24px 18px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>No casual workers yet.</div>
            ) : workers.map(worker => {
              const colors = statusColor(worker.worker_status)
              return (
                <div key={worker.id} style={{ padding: '14px 18px', borderBottom: '1px solid #F0F4F8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <strong style={{ color: '#111827', fontSize: '0.875rem' }}>{worker.full_name}</strong>
                    <span style={{ background: colors.bg, color: colors.text, borderRadius: 999, padding: '2px 9px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>{worker.worker_status}</span>
                  </div>
                  <p style={{ margin: '0 0 10px', color: '#9CA3AF', fontSize: '0.775rem' }}>{worker.department_name ?? 'No department'} · {worker.email_address}</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['active', 'inactive', 'blocked'] as const).map(status => {
                      const isActive = worker.worker_status === status
                      const isBlockBtn = status === 'blocked'
                      return (
                        <button
                          key={status}
                          onClick={() => updateWorkerStatus(worker.id, status)}
                          disabled={actionLoading || isActive}
                          style={{
                            flex: 1, border: isActive ? 'none' : '1.5px solid #E5E7EB',
                            borderRadius: 7,
                            background: isActive ? (isBlockBtn ? '#FEF2F2' : '#F3F4F6') : '#FFFFFF',
                            color: isBlockBtn ? (isActive ? '#B91C1C' : '#9CA3AF') : (isActive ? '#374151' : '#9CA3AF'),
                            padding: '6px 0', fontSize: '0.75rem', fontWeight: isActive ? 700 : 500,
                            cursor: actionLoading || isActive ? 'default' : 'pointer',
                            transition: 'all 0.1s',
                            textTransform: 'capitalize',
                          }}
                        >
                          {status}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {formOpen && (
        <div onClick={() => setFormOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={event => event.stopPropagation()} style={{ width: 640, maxHeight: '88vh', overflowY: 'auto', background: '#FFFFFF', borderRadius: 14, padding: 24, boxShadow: '0 12px 48px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, color: '#111827', fontSize: '1.05rem' }}>{editingId ? 'Edit Job Posting' : 'New Job Posting'}</h2>
              <button onClick={() => setFormOpen(false)} style={{ border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 13 }}>
              <div><label style={labelStyle}>Title</label><input data-testid="job-title-input" value={title} onChange={event => setTitle(event.target.value)} style={inputStyle} /></div>
              <button onClick={generateJobDescription} disabled={aiLoading || !title.trim()} style={{ border: 'none', borderRadius: 8, background: '#111827', color: '#FFFFFF', padding: 10, fontWeight: 900, cursor: aiLoading || !title.trim() ? 'default' : 'pointer', opacity: aiLoading || !title.trim() ? 0.6 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                {aiLoading ? <Spinner size={14} /> : <Sparkles size={14} />} Generate description, requirements, and questions
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>Department</label><select value={departmentId} onChange={event => setDepartmentId(event.target.value)} style={inputStyle}><option value="">Any department</option>{departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}</select></div>
                <div><label style={labelStyle}>Employment Type</label><input value={employmentType} onChange={event => setEmploymentType(event.target.value)} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>Location</label><input value={location} onChange={event => setLocation(event.target.value)} style={inputStyle} /></div>
                <div><label style={labelStyle}>Pay</label><input type="number" min={0} value={salaryAmount} onChange={event => setSalaryAmount(event.target.value)} style={inputStyle} /></div>
                <div><label style={labelStyle}>Pay Type</label><input value={salaryType} onChange={event => setSalaryType(event.target.value)} style={inputStyle} /></div>
              </div>
              <div><label style={labelStyle}>Description</label><textarea value={description} onChange={event => setDescription(event.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} /></div>
              <div><label style={labelStyle}>Requirements</label><textarea value={requirements} onChange={event => setRequirements(event.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} /></div>
              {error && <div style={{ padding: 11, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, fontSize: '0.84rem', fontWeight: 700 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button onClick={() => setFormOpen(false)} style={{ flex: 1, border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#374151', borderRadius: 8, padding: 11, fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
                <button onClick={savePosting} disabled={actionLoading} style={{ flex: 1, border: 'none', background: '#F97316', color: '#FFFFFF', borderRadius: 8, padding: 11, fontWeight: 900, cursor: actionLoading ? 'default' : 'pointer', display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', opacity: actionLoading ? 0.7 : 1 }}>
                  {actionLoading ? <Spinner size={14} /> : <Send size={14} />} Save Job
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
