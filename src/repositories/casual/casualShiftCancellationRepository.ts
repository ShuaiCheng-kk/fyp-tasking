// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'

export const casualShiftCancellationRepository = {
  async getWorkerByAuthId(authId: string): Promise<{ id: string; full_name: string; email_address: string } | null> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email_address')
      .eq('supabase_auth_id', authId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },

  async getAssignedShift(shiftId: string, userId: string): Promise<{
    id: string
    shift_date: string
    start_time: string
    status: string
    source_job_posting_id: string | null
  } | null> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('shifts!inner(id, shift_date, start_time, status, source_job_posting_id)')
      .eq('user_id', userId)
      .eq('shift_id', shiftId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? (data as unknown as { shifts: never }).shifts : null
  },

  async cancelShift(shiftId: string): Promise<void> {
    const { error } = await supabase
      .from('shifts')
      .update({ status: 'cancelled' })
      .eq('id', shiftId)
    if (error) throw new Error(error.message)
  },

  async getJobPosting(jobId: string): Promise<{
    id: string
    title: string
    company_id: string
    created_by: string
    status: string
    expires_at: string | null
    openings: number | null
  } | null> {
    const { data, error } = await supabase
      .from('job_postings')
      .select('id, title, company_id, created_by, status, expires_at, openings')
      .eq('id', jobId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },

  async findApplicant(jobId: string, userId: string): Promise<{ id: string } | null> {
    const { data, error } = await supabase
      .from('job_applicants')
      .select('id')
      .eq('job_id', jobId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },

  async cancelAcceptedInvitation(applicantId: string): Promise<void> {
    const { error } = await supabase
      .from('job_invitations')
      .update({ status: 'cancelled' })
      .eq('applicant_id', applicantId)
      .eq('status', 'accepted')
    if (error) throw new Error(error.message)
  },

  async setApplicantStatus(applicantId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('job_applicants')
      .update({ status })
      .eq('id', applicantId)
    if (error) throw new Error(error.message)
  },

  async insertCancellation(input: {
    job_id: string
    applicant_id: string | null
    cancelled_by: string
    cancelled_role: 'worker' | 'employer'
    scope: 'worker' | 'job'
    reason: string | null
  }): Promise<void> {
    const { error } = await supabase.from('recruitment_cancellations').insert(input)
    if (error) throw new Error(error.message)
  },

  async reopenJobPosting(jobId: string): Promise<void> {
    const { error } = await supabase
      .from('job_postings')
      .update({ status: 'open', archived_at: null })
      .eq('id', jobId)
    if (error) throw new Error(error.message)
  },

  async getUserContact(userId: string): Promise<{ full_name: string; email_address: string } | null> {
    const { data, error } = await supabase
      .from('users')
      .select('full_name, email_address')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },

  // In-app notification to the employer via the existing Communication module.
  async insertMessage(fromUserId: string, toUserId: string, companyId: string, content: string, senderName: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .insert({ from_user_id: fromUserId, to_user_id: toUserId, company_id: companyId, content, is_read: false, sender_name: senderName })
    if (error) throw new Error(error.message)
  },
}
