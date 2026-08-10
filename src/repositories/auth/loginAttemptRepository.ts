import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()

export interface LoginAttemptRow {
  email: string
  failed_count: number
  first_failed_at: string
  locked_until: string | null
}

export const loginAttemptRepository = {

  async get(email: string): Promise<LoginAttemptRow | null> {
    const { data } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('email', email)
      .maybeSingle()
    return data
  },

  async upsert(row: LoginAttemptRow): Promise<void> {
    await supabase.from('login_attempts').upsert(row)
  },

  async clear(email: string): Promise<void> {
    await supabase.from('login_attempts').delete().eq('email', email)
  },

}
