import { supabase } from '@/lib/supabase'

export const workerApplicationRepository = {
  async checkExistingApplication(jobId: string, userId: string) {
    const { data, error } = await supabase
      .from('job_applications')
      .select('id')
      .eq('job_id', jobId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw new Error(error.message)

    return data
  },

  async createApplication(application: {
    job_id: string
    user_id: string
    resume_url: string
    cover_letter: string
  }) {
    const { data, error } = await supabase
      .from('job_applications')
      .insert({
        ...application,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    return data
  },
}