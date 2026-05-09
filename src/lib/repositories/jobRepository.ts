/**
 * JobRepository — data access layer for job postings and applications.
 *
 * Supabase tables touched:
 *   - job_postings    (id, title, description, department_id, slots, status,
 *                      required_skills, created_by, created_at, closes_at)
 *   - job_applications (id, job_id, applicant_id, status, ai_score,
 *                       cover_note, applied_at, reviewed_at)
 *
 * Posting status values:  'draft' | 'open' | 'closed' | 'cancelled'
 * Application status values: 'pending' | 'shortlisted' | 'rejected' | 'hired'
 */

import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PostingStatus = 'draft' | 'open' | 'closed' | 'cancelled'
export type ApplicationStatus = 'pending' | 'shortlisted' | 'rejected' | 'hired'

export interface JobPosting {
  id: string
  title: string
  description: string
  department_id: string
  slots: number
  status: PostingStatus
  required_skills: string[]
  created_by: string
  created_at: string
  closes_at: string | null
}

export interface JobApplication {
  id: string
  job_id: string
  applicant_id: string
  status: ApplicationStatus
  ai_score: number | null      // 0–100, assigned by AI matching service
  cover_note: string | null
  applied_at: string
  reviewed_at: string | null
}

export interface CreatePostingData {
  title: string
  description: string
  department_id: string
  slots: number
  required_skills: string[]
  created_by: string
  closes_at?: string
}

// ---------------------------------------------------------------------------
// Job Postings — read
// ---------------------------------------------------------------------------

export async function findAllPostings(status?: PostingStatus): Promise<JobPosting[]> {
  let query = supabase.from('job_postings').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function findPostingById(id: string): Promise<JobPosting | null> {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function findPostingsByDepartment(departmentId: string): Promise<JobPosting[]> {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('department_id', departmentId)
    .eq('status', 'open')

  if (error) throw new Error(error.message)
  return data ?? []
}

// ---------------------------------------------------------------------------
// Job Postings — write
// ---------------------------------------------------------------------------

export async function createPosting(data: CreatePostingData): Promise<JobPosting> {
  const { data: created, error } = await supabase
    .from('job_postings')
    .insert({ ...data, status: 'draft' })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return created
}

export async function updatePostingStatus(
  id: string,
  status: PostingStatus,
): Promise<void> {
  const { error } = await supabase
    .from('job_postings')
    .update({ status })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Applications — read
// ---------------------------------------------------------------------------

/** All applications for a given job posting, newest first. */
export async function findApplicationsByJob(jobId: string): Promise<JobApplication[]> {
  const { data, error } = await supabase
    .from('job_applications')
    .select('*')
    .eq('job_id', jobId)
    .order('ai_score', { ascending: false })  // highest AI score first

  if (error) throw new Error(error.message)
  return data ?? []
}

/** All applications submitted by a specific worker. */
export async function findApplicationsByWorker(workerId: string): Promise<JobApplication[]> {
  const { data, error } = await supabase
    .from('job_applications')
    .select('*, job_postings(*)')
    .eq('applicant_id', workerId)
    .order('applied_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

// ---------------------------------------------------------------------------
// Applications — write
// ---------------------------------------------------------------------------

export async function createApplication(
  jobId: string,
  applicantId: string,
  coverNote?: string,
): Promise<JobApplication> {
  const { data, error } = await supabase
    .from('job_applications')
    .insert({ job_id: jobId, applicant_id: applicantId, cover_note: coverNote ?? null, status: 'pending' })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  aiScore?: number,
): Promise<void> {
  const { error } = await supabase
    .from('job_applications')
    .update({ status, ...(aiScore !== undefined && { ai_score: aiScore }), reviewed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}
