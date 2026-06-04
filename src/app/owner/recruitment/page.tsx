'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Archive, Copy, Plus, Send, Sparkles, UserCheck, UserX, X } from 'lucide-react'
import OwnerSidebar from '@/components/OwnerSidebar'
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

      const storedCid = localStorage.getItem(`tasking_company_id_${authId}`) || meData.user.company_id || ''
      if (!storedCid) return
      setCompanyId(storedCid)

      const currentRes = await fetch(`/api/company/current?user_id=${authId}&company_id=${storedCid}`)
      const currentData = await currentRes.json()
      if (!cancelled && currentData.success) setCompanyName(currentData.company?.name ?? '')
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
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <OwnerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 32px', background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#111827', margin: 0 }}>
            {companyName ? `${companyName} - Recruitment` : 'Recruitment'}
          </h1>
          <button onClick={openCreateForm} style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 8, background: '#F97316', color: '#FFFFFF', padding: '9px 13px', fontWeight: 800, cursor: 'pointer' }}>
            <Plus size={15} /> New Job
          </button>
        </div>

        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '320px 1fr 360px', gap: 18, alignItems: 'start' }}>
          <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: 14, borderBottom: '1px solid #F1F5F9', fontSize: '0.78rem', fontWeight: 900, color: '#6B7280', textTransform: 'uppercase' }}>Job Postings</div>
            {loading ? (
              <div style={{ padding: 18, color: '#9CA3AF', fontSize: '0.9rem' }}>Loading...</div>
            ) : postings.length === 0 ? (
              <div style={{ padding: 18, color: '#9CA3AF', fontSize: '0.9rem' }}>No job postings yet.</div>
            ) : postings.map(posting => {
              const colors = statusColor(posting.status)
              return (
                <button key={posting.id} onClick={() => setSelectedPostingId(posting.id)} style={{ width: '100%', border: 'none', borderBottom: '1px solid #F1F5F9', background: selectedPostingId === posting.id ? '#FFF7ED' : '#FFFFFF', padding: 14, textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: '0.9rem', color: '#111827' }}>{posting.title}</strong>
                    <span style={{ background: colors.bg, color: colors.text, borderRadius: 999, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 900 }}>{posting.status}</span>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#6B7280' }}>{posting.department_name ?? 'Any department'} · {posting.applicant_count} applicants</p>
                </button>
              )
            })}
          </section>

          <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, minHeight: 520 }}>
            {error && <div style={{ margin: 14, padding: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, fontSize: '0.84rem', fontWeight: 700 }}>{error}</div>}
            {!selectedPosting ? (
              <div style={{ padding: 24, color: '#9CA3AF' }}>Select a job posting.</div>
            ) : (
              <div>
                <div style={{ padding: 18, borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#111827' }}>{selectedPosting.title}</h2>
                    <p style={{ margin: '6px 0 0', color: '#6B7280', fontSize: '0.86rem' }}>{selectedPosting.department_name ?? 'Any department'} · {selectedPosting.location ?? 'No location'} · {selectedPosting.employment_type ?? 'Role'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => openEditForm(selectedPosting)} style={{ border: '1px solid #E5E7EB', background: '#FFFFFF', borderRadius: 8, padding: '8px 10px', fontWeight: 800, cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => runPostingAction('duplicate_posting')} disabled={actionLoading} title="Duplicate" style={{ border: '1px solid #E5E7EB', background: '#FFFFFF', borderRadius: 8, width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Copy size={15} /></button>
                    <button onClick={() => runPostingAction('archive_posting')} disabled={actionLoading || selectedPosting.status === 'archived'} title="Archive" style={{ border: 'none', background: '#111827', color: '#FFFFFF', borderRadius: 8, width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: selectedPosting.status === 'archived' ? 'default' : 'pointer', opacity: selectedPosting.status === 'archived' ? 0.45 : 1 }}><Archive size={15} /></button>
                  </div>
                </div>
                <div style={{ padding: 18, display: 'grid', gap: 14 }}>
                  <div><span style={labelStyle}>Description</span><p style={{ margin: 0, color: '#374151', lineHeight: 1.6 }}>{selectedPosting.description}</p></div>
                  <div><span style={labelStyle}>Requirements</span><p style={{ margin: 0, color: '#374151', lineHeight: 1.6 }}>{selectedPosting.requirements || 'No requirements listed.'}</p></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 8 }}><span style={labelStyle}>Pay</span><strong>{selectedPosting.salary_amount ?? '-'} {selectedPosting.salary_type ?? ''}</strong></div>
                    <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 8 }}><span style={labelStyle}>Pending</span><strong>{selectedPosting.pending_count}</strong></div>
                    <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 8 }}><span style={labelStyle}>Total Applicants</span><strong>{selectedPosting.applicant_count}</strong></div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 10px' }}>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#111827' }}>Applicants</h3>
                      <button onClick={recommendCandidates} disabled={aiLoading || applicants.length === 0} style={{ border: 'none', borderRadius: 7, background: '#111827', color: '#FFFFFF', padding: '7px 10px', display: 'flex', gap: 6, alignItems: 'center', cursor: aiLoading || applicants.length === 0 ? 'default' : 'pointer', opacity: aiLoading || applicants.length === 0 ? 0.6 : 1, fontSize: '0.76rem', fontWeight: 900 }}>
                        {aiLoading ? <Spinner size={13} /> : <Sparkles size={13} />} Recommend
                      </button>
                    </div>
                    {applicants.length === 0 ? (
                      <div style={{ padding: 14, color: '#9CA3AF', background: '#F8FAFC', borderRadius: 8 }}>No applicants yet.</div>
                    ) : applicants.map(applicant => {
                      const colors = statusColor(applicant.status)
                      const recommendation = recommendations.find(item => item.applicant_id === applicant.id)
                      return (
                        <div key={applicant.id} style={{ padding: 12, border: '1px solid #E5E7EB', borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <strong style={{ color: '#111827' }}>{applicant.full_name}</strong>
                            <p style={{ margin: '3px 0 0', color: '#6B7280', fontSize: '0.8rem' }}>{applicant.email_address}</p>
                            {applicant.cover_letter && <p style={{ margin: '7px 0 0', color: '#4B5563', fontSize: '0.82rem' }}>{applicant.cover_letter}</p>}
                            {recommendation && (
                              <div style={{ marginTop: 8, padding: 9, background: '#F8FAFC', borderRadius: 8, color: '#374151', fontSize: '0.78rem', lineHeight: 1.45 }}>
                                <strong>AI {recommendation.score}/100 · {recommendation.recommendation}</strong>
                                <p style={{ margin: '4px 0 0' }}>{recommendation.reasons[0] ?? recommendation.suggested_next_step}</p>
                                {recommendation.risks[0] && <p style={{ margin: '3px 0 0', color: '#B45309' }}>{recommendation.risks[0]}</p>}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                            <span style={{ background: colors.bg, color: colors.text, borderRadius: 999, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 900 }}>{applicant.status}</span>
                            {applicant.status === 'pending' && (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => decideApplicant(applicant.id, 'accepted')} disabled={actionLoading} style={{ border: 'none', borderRadius: 7, background: '#059669', color: '#FFFFFF', padding: '7px 9px', display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}><UserCheck size={14} /> Accept</button>
                                <button onClick={() => decideApplicant(applicant.id, 'rejected')} disabled={actionLoading} style={{ border: 'none', borderRadius: 7, background: '#DC2626', color: '#FFFFFF', padding: '7px 9px', display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}><UserX size={14} /> Reject</button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: 14, borderBottom: '1px solid #F1F5F9', fontSize: '0.78rem', fontWeight: 900, color: '#6B7280', textTransform: 'uppercase' }}>Casual Worker Access</div>
            {workers.length === 0 ? (
              <div style={{ padding: 18, color: '#9CA3AF', fontSize: '0.9rem' }}>No casual workers yet.</div>
            ) : workers.map(worker => {
              const colors = statusColor(worker.worker_status)
              return (
                <div key={worker.id} style={{ padding: 14, borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ color: '#111827', fontSize: '0.9rem' }}>{worker.full_name}</strong>
                    <span style={{ background: colors.bg, color: colors.text, borderRadius: 999, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 900 }}>{worker.worker_status}</span>
                  </div>
                  <p style={{ margin: '4px 0 9px', color: '#6B7280', fontSize: '0.78rem' }}>{worker.department_name ?? 'No department'} · {worker.email_address}</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['active', 'inactive', 'blocked'] as const).map(status => (
                      <button key={status} onClick={() => updateWorkerStatus(worker.id, status)} disabled={actionLoading || worker.worker_status === status} style={{ flex: 1, border: '1px solid #E5E7EB', borderRadius: 7, background: worker.worker_status === status ? '#F3F4F6' : '#FFFFFF', color: status === 'blocked' ? '#B91C1C' : '#374151', padding: '7px 0', fontSize: '0.74rem', fontWeight: 800, cursor: actionLoading || worker.worker_status === status ? 'default' : 'pointer' }}>
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </section>
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
              <div><label style={labelStyle}>Title</label><input value={title} onChange={event => setTitle(event.target.value)} style={inputStyle} /></div>
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
