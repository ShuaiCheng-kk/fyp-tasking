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
}