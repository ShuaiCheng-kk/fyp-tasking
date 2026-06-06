import { JobPosting } from '@/types/recruitment.types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiContext {
  companyId: string
  departmentId: string | null
  userId: string
}

// ─── User / Company bootstrap ─────────────────────────────────────────────────

export async function fetchCurrentUser(supabaseUserId: string) {
  const res = await fetch(`/api/user/me?user_id=${supabaseUserId}`)
  return res.json() as Promise<{ success: boolean; user: { id: string; company_id: string; department_id: string | null } }>
}

export async function fetchCompany(userId: string, companyId: string) {
  const res = await fetch(`/api/company/current?user_id=${userId}&company_id=${companyId}`)
  return res.json() as Promise<{ success: boolean; company: { name: string } }>
}

export async function fetchDepartments(companyId: string) {
  const res = await fetch(`/api/company/departments?company_id=${companyId}`)
  return res.json() as Promise<{ success: boolean; departments: { id: string; name: string }[] }>
}

// ─── Jobs CRUD ────────────────────────────────────────────────────────────────

export async function fetchJobs(companyId: string): Promise<JobPosting[]> {
  const res = await fetch(`/api/manager/recruitment/jobs?company_id=${companyId}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  return data.jobs
}

export async function createJob(body: Record<string, any>): Promise<JobPosting> {
  const res = await fetch('/api/manager/recruitment/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  return data.job
}

export async function updateJob(jobId: string, body: Record<string, any>): Promise<JobPosting> {
  const res = await fetch(`/api/manager/recruitment/jobs/${jobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  return data.job
}

export async function duplicateJob(jobId: string, requestingManagerId: string): Promise<JobPosting> {
  const res = await fetch(`/api/manager/recruitment/jobs/${jobId}/duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requesting_manager_id: requestingManagerId }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  return data.job
}

export async function deleteJob(jobId: string): Promise<void> {
  const res = await fetch(`/api/manager/recruitment/jobs/${jobId}`, { method: 'DELETE' })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
}
