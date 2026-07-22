import { supabase } from '@/lib/supabase'

export const ownerAnnouncementRepository = {

  async getAnnouncements(companyId: string, requestingUserId?: string | null, role?: string | null, departmentId?: string | null) {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, poster:users!announcements_from_user_id_fkey(full_name, role, profile_photo_url, manager_departments!manager_departments_manager_id_fkey(department_id, departments(name)))')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
    if (error) throw error

    const isOwnerOrPartner = role?.toLowerCase() === 'owner' || role?.toLowerCase() === 'partner'
    const isEmployee = role?.toLowerCase() === 'employee'

    return (data ?? [])
      .filter((row: any) => {
        if (isEmployee) {
          return !!departmentId && row.department_id === departmentId && row.poster?.role === 'Manager'
        }
        // Owner/Partner never see Manager-posted announcements — those are scoped to that
        // Manager's own department only, visible to Managers/Employees within it.
        if (isOwnerOrPartner) {
          return row.poster?.role !== 'Manager'
        }
        // Non-owners only see company-wide or their own department's announcements
        if (departmentId) {
          return row.department_id === null || row.department_id === departmentId
        }
        return true
      })
      .map((row: any) => {
        const { poster, ...rest } = row
        const posterDept = poster?.manager_departments?.[0]
        return { ...rest, created_by_name: poster?.full_name ?? null, created_by_photo_url: poster?.profile_photo_url ?? null, poster_role: poster?.role ?? null, poster_department_id: posterDept?.department_id ?? null, poster_department_name: posterDept?.departments?.name ?? null }
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

  async getAnnouncementOwner(announcementId: string): Promise<{ from_user_id: string }> {
    const { data, error } = await supabase
      .from('announcements')
      .select('from_user_id')
      .eq('id', announcementId)
      .single()
    if (error || !data) throw new Error('Announcement not found')
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
      .update({ title, content, department_id: departmentId, updated_at: new Date().toISOString() })
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

  async markAnnouncementsRead(userId: string, announcementIds: string[]) {
    if (announcementIds.length === 0) return
    const rows = announcementIds.map(id => ({ user_id: userId, announcement_id: id }))
    const { error } = await supabase
      .from('announcement_reads')
      .upsert(rows, { onConflict: 'user_id,announcement_id', ignoreDuplicates: true })
    if (error) throw error
  },

  async getReadAnnouncementIds(userId: string, companyId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', userId)
    if (error) throw error
    return (data ?? []).map((r: any) => r.announcement_id)
  },

}
