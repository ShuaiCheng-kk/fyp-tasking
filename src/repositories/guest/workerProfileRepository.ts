// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { WorkerCertificate } from '@/types/WorkerProfile'

const BUCKET_NAME = 'worker-documents'

const PROFILE_COLUMNS =
  'id, full_name, email_address, phone_number, date_of_birth, profile_photo_url, role, supabase_auth_id, casual_worker_profiles(skills, resume_url)'

function flattenProfile(row: any) {
  if (!row) return row
  const { casual_worker_profiles, ...rest } = row
  const profile = Array.isArray(casual_worker_profiles) ? casual_worker_profiles[0] : casual_worker_profiles
  return { ...rest, skills: profile?.skills ?? null, resume_url: profile?.resume_url ?? null }
}

export const workerProfileRepository = {
  async getByAuthId(authId: string) {
    const { data, error } = await supabase
      .from('users')
      .select(PROFILE_COLUMNS)
      .eq('supabase_auth_id', authId)
      .maybeSingle()

    if (error) throw error
    return flattenProfile(data)
  },

  async updateByAuthId(authId: string, values: {
    full_name: string
    phone_number: string | null
    date_of_birth: string | null
    profile_photo_url: string | null
  }) {
    const { data, error } = await supabase
      .from('users')
      .update({
        full_name: values.full_name,
        phone_number: values.phone_number,
        date_of_birth: values.date_of_birth,
        profile_photo_url: values.profile_photo_url,
      })
      .eq('supabase_auth_id', authId)
      .select(PROFILE_COLUMNS)
      .single()

    if (error) throw error
    return flattenProfile(data)
  },

  async updateSkillsByAuthId(authId: string, skills: string | null) {
    const userId = await this.getUserIdByAuthId(authId)
    const { error } = await supabase
      .from('casual_worker_profiles')
      .upsert({ user_id: userId, skills }, { onConflict: 'user_id' })
    if (error) throw error
    const { data, error: readError } = await supabase
      .from('users')
      .select(PROFILE_COLUMNS)
      .eq('supabase_auth_id', authId)
      .single()
    if (readError) throw readError
    return flattenProfile(data)
  },

  async updateResumeUrlByAuthId(authId: string, resume_url: string | null) {
    const userId = await this.getUserIdByAuthId(authId)
    const { error } = await supabase
      .from('casual_worker_profiles')
      .upsert({ user_id: userId, resume_url }, { onConflict: 'user_id' })
    if (error) throw error
    const { data, error: readError } = await supabase
      .from('users')
      .select(PROFILE_COLUMNS)
      .eq('supabase_auth_id', authId)
      .single()
    if (readError) throw readError
    return flattenProfile(data)
  },

  async getUserIdByAuthId(authId: string): Promise<string> {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('supabase_auth_id', authId)
      .single()
    if (error) throw error
    return (data as { id: string }).id
  },

  async getCertificatesByUserId(userId: string): Promise<WorkerCertificate[]> {
    const { data, error } = await supabase
      .from('user_certificates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)
    return (data ?? []) as WorkerCertificate[]
  },

  async addCertificate(input: { user_id: string; name: string; certificate_url: string | null }): Promise<WorkerCertificate> {
    const { data, error } = await supabase
      .from('user_certificates')
      .insert(input)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as WorkerCertificate
  },

  // user_id is part of the filter so a worker can only ever update their own certificate.
  async updateCertificateFileUrl(certificateId: string, userId: string, certificateUrl: string): Promise<WorkerCertificate> {
    const { data, error } = await supabase
      .from('user_certificates')
      .update({ certificate_url: certificateUrl })
      .eq('id', certificateId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as WorkerCertificate
  },

  // user_id is part of the filter so a worker can only ever delete their own certificate.
  async deleteCertificate(certificateId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_certificates')
      .delete()
      .eq('id', certificateId)
      .eq('user_id', userId)

    if (error) throw new Error(error.message)
  },

  async uploadProfileFile(file: File, path: string): Promise<string> {
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
}
