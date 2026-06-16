import { supabase } from '@/lib/supabase'

const BUCKET_NAME = 'worker-documents'

export const workerApplicationRepository = {
  async checkExistingApplication(jobId: string, userId: string) {
    const { data, error } = await supabase
      .from('job_applicants')
      .select('id')
      .eq('job_id', jobId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  },

  async uploadApplicationFile(file: File, path: string) {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
      })

    if (error) throw new Error(error.message)

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path)

    return urlData.publicUrl
  },

  async createApplication(application: {
    job_id: string
    user_id: string
    resume_url: string
    cover_letter: string
  }) {
    const { data, error } = await supabase
      .from('job_applicants')
      .insert({
        job_id: application.job_id,
        user_id: application.user_id,
        resume_url: application.resume_url,
        cover_letter: application.cover_letter,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  },

  async getApplicationsByUser(userId: string) {
    const { data, error } = await supabase
      .from('job_applicants')
      .select(`
        id,
        status,
        applied_at,
        resume_url,
        cover_letter,
        job_postings (
          title,
          company_name,
          location,
          employment_type,
          salary_amount,
          salary_type,
          description,
          requirements,
          benefits,
          openings,
          job_date,
          shift_start_time,
          shift_end_time
        ),
        job_invitations (
          id,
          status,
          message
        )
      `)
      .eq('user_id', userId)
      .order('applied_at', { ascending: false })

    if (error) throw new Error(error.message)

    return data
  },

  async respondToInvitation(invitationId: string, response: 'accepted' | 'declined'): Promise<void> {
    const { error } = await supabase
      .from('job_invitations')
      .update({ status: response })
      .eq('id', invitationId)
    if (error) throw new Error(error.message)
  },

  async getUserIdFromInvitation(invitationId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('job_invitations')
      .select('applicant_id')
      .eq('id', invitationId)
      .single()
    if (error || !data) return null
    const { data: applicant, error: appErr } = await supabase
      .from('job_applicants')
      .select('user_id')
      .eq('id', data.applicant_id)
      .single()
    if (appErr || !applicant) return null
    return applicant.user_id
  },

  async promoteGuestToWorker(userId: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ role: 'Casual Worker', worker_status: 'active' })
      .eq('id', userId)
      .eq('role', 'Guest User')
    if (error) throw new Error(error.message)
  },
}