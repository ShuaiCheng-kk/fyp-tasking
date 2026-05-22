import { supabase } from '@/lib/supabase'

export const managerAnnouncementRepository = {

  async getAnnouncements(companyId: string, departmentId?: string | null, requestingUserId?: string | null) {
    let query = supabase
      .from('announcements')
      .select('*, poster:users!announcements_from_user_id_fkey(full_name, role)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (departmentId && requestingUserId) {
      query = query.or(
        `from_user_id.eq.${requestingUserId},and(department_id.is.null),and(department_id.eq.${departmentId})`
      )
    } else if (requestingUserId) {
      query = query.or(`from_user_id.eq.${requestingUserId},department_id.is.null`)
    } else if (departmentId) {
      query = query.or(`department_id.is.null,department_id.eq.${departmentId}`)
    } else {
      query = query.is('department_id', null)
    }

    const { data, error } = await query
    if (error) throw error

    return (data ?? [])
      .filter((row: any) => {
        const posterRole = row.poster?.role
        if (posterRole === 'Manager') {
          return row.from_user_id === requestingUserId
        }
        return true
      })
      .map((row: any) => {
        const { poster, ...rest } = row
        return { ...rest, created_by_name: poster?.full_name ?? null }
      })
  },

  async insertAnnouncement(fromUserId: string, companyId: string, departmentId: string | null, title: string, content: string) {
    const { data, error } = await supabase
      .from('announcements')
      .insert({ from_user_id: fromUserId, company_id: companyId, department_id: departmentId ?? null, title, content })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async updateAnnouncement(announcementId: string, requestingUserId: string, title: string, content: string, departmentId: string | null) {
    const { data: existing, error: fetchError } = await supabase
      .from('announcements')
      .select('from_user_id')
      .eq('id', announcementId)
      .single()
    if (fetchError || !existing) throw new Error('Announcement not found')
    if (existing.from_user_id !== requestingUserId) throw new Error('You can only edit your own announcements')

    const { data, error } = await supabase
      .from('announcements')
      .update({ title, content, department_id: departmentId })
      .eq('id', announcementId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async deleteAnnouncement(announcementId: string, requestingUserId: string) {
    const { data: existing, error: fetchError } = await supabase
      .from('announcements')
      .select('from_user_id')
      .eq('id', announcementId)
      .single()
    if (fetchError || !existing) throw new Error('Announcement not found')
    if (existing.from_user_id !== requestingUserId) throw new Error('You can only delete your own announcements')

    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', announcementId)
    if (error) throw error
  },

}
