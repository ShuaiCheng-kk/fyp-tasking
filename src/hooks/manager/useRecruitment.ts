'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { JobPosting } from '@/types/recruitment.types'
import { PostJobForm } from '@/types/recruitment.form.types'
import { buildJobBody } from '@/app/manager/recruitment/utils/recruitment.utils'
import {
  fetchCurrentUser,
  fetchCompany,
  fetchDepartments,
  fetchJobs,
  createJob,
  updateJob,
  duplicateJob,
  deleteJob,
} from '@/repositories/manager/recruitment.repository'

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseRecruitmentReturn {
  // Context
  companyName: string
  deptName: string
  companyId: string
  userId: string
  departmentId: string | null
  // Job state
  jobs: JobPosting[]
  loadingJobs: boolean
  error: string | null
  submitting: boolean
  setError: (e: string | null) => void
  // Handlers
  handlePostJob: (form: PostJobForm) => Promise<void>
  handleEditJob: (form: PostJobForm, jobId: string) => Promise<void>
  handleDuplicate: (job: JobPosting) => Promise<void>
  handleStatusChange: (job: JobPosting, status: 'closed' | 'archived') => Promise<void>
  handleDelete: (job: JobPosting) => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRecruitment(): UseRecruitmentReturn {
  const [companyName, setCompanyName]     = useState('')
  const [deptName, setDeptName]           = useState('')
  const [companyId, setCompanyId]         = useState('')
  const [userId, setUserId]               = useState('')
  const [departmentId, setDepartmentId]   = useState<string | null>(null)

  const [jobs, setJobs]                   = useState<JobPosting[]>([])
  const [loadingJobs, setLoadingJobs]     = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  const [submitting, setSubmitting]       = useState(false)

  // ── Bootstrap: resolve Supabase user → internal user → company / department
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return

      const userData = await fetchCurrentUser(user.id)
      if (!userData.success) return

      const { id: internalId, company_id, department_id } = userData.user
      setUserId(internalId)
      if (department_id) setDepartmentId(department_id)

      if (company_id) {
        setCompanyId(company_id)
        const [compData, deptData] = await Promise.all([
          fetchCompany(internalId, company_id),
          fetchDepartments(company_id),
        ])
        if (compData.success && compData.company?.name) setCompanyName(compData.company.name)
        if (deptData.success && department_id) {
          const match = deptData.departments.find(d => d.id === department_id)
          if (match) setDeptName(match.name)
        }
      }
    })
  }, [])

  // ── Fetch jobs whenever company resolves
  useEffect(() => {
    if (!companyId) return
    setLoadingJobs(true)
    fetchJobs(companyId)
      .then(setJobs)
      .catch(() => {})
      .finally(() => setLoadingJobs(false))
  }, [companyId])

  // ── Shared context passed to body builder
  const apiCtx = { companyId, departmentId, userId }

  // ── Handlers
  const handlePostJob = async (form: PostJobForm) => {
    setError(null)
    setSubmitting(true)
    try {
      const job = await createJob(buildJobBody(form, apiCtx))
      setJobs(prev => [job, ...prev])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditJob = async (form: PostJobForm, jobId: string) => {
    setError(null)
    setSubmitting(true)
    try {
      const updated = await updateJob(jobId, buildJobBody(form, apiCtx))
      setJobs(prev => prev.map(j => j.id === jobId ? updated : j))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDuplicate = async (job: JobPosting) => {
    setError(null)
    try {
      const duped = await duplicateJob(job.id, userId)
      setJobs(prev => [duped, ...prev])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleStatusChange = async (job: JobPosting, status: 'closed' | 'archived') => {
    setError(null)
    try {
      await updateJob(job.id, { status })
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status } : j))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async (job: JobPosting) => {
    setError(null)
    try {
      await deleteJob(job.id)
      setJobs(prev => prev.filter(j => j.id !== job.id))
    } catch (err: any) {
      setError(err.message)
    }
  }

  return {
    companyName, deptName, companyId, userId, departmentId,
    jobs, loadingJobs, error, submitting, setError,
    handlePostJob, handleEditJob, handleDuplicate, handleStatusChange, handleDelete,
  }
}
