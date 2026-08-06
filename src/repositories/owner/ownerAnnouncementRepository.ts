import { supabase } from '@/lib/supabase'

export const ownerAnnouncementRepository = {

  async getAnnouncements(companyId: string, requestingUserId?: string | null, role?: string | null, departmentId?: string | null) {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, poster:users!announcements_user_id_fkey(full_name, role, profile_photo_url, manager_departments!manager_departments_manager_id_fkey(department_id, departments(name)))')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
    if (error) throw error

    const isOwnerOrPartner = role?.toLowerCase() === 'owner' || role?.toLowerCase() === 'partner'
    const isEmployee = role?.toLowerCase() === 'employee'

    return (data ?? [])
      .filter((row: any) => {
        if (isEmployee) {
          return !!departmentId && row.audience_department_id === departmentId && row.poster?.role === 'Manager'
        }
        // Owner/Partner never see Manager-posted announcements — those are scoped to that
        // Manager's own department only, visible to Managers/Employees within it.
        if (isOwnerOrPartner) {
          return row.poster?.role !== 'Manager'
        }
        // Non-owners only see company-wide or their own department's announcements
        if (departmentId) {
          return row.audience_department_id === null || row.audience_department_id === departmentId
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
      .insert({ user_id: fromUserId, company_id: companyId, audience_department_id: departmentId ?? null, title, content })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getAnnouncementOwner(announcementId: string): Promise<{ user_id: string }> {
    const { data, error } = await supabase
      .from('announcements')
      .select('user_id')
      .eq('id', announcementId)
      .single()
    if (error || !data) throw new Error('Announcement not found')
    return data
  },

  async updateAnnouncement(announcementId: string, title: string, content: string, departmentId: string | null) {
    const { data, error } = await supabase
      .from('announcements')
      .update({ title, content, audience_department_id: departmentId, updated_at: new Date().toISOString() })
      .eq('id', announcementId)
      .select()
      .single()
    if (error) throw error

    // Editing changes what everyone needs to (re-)see, so drop the read receipts — the
    // announcement goes back to unread for everyone who'd already read the old version.
    const { error: reReadError } = await supabase
      .from('announcement_reads')
      .delete()
      .eq('announcement_id', announcementId)
    if (reReadError) throw reReadError

    return data
  },

  async deleteAnnouncement(announcementId: string) {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', announcementId)
    if (error) throw error

    const { error: readsError } = await supabase
      .from('announcement_reads')
      .delete()
      .eq('announcement_id', announcementId)
    if (readsError) throw readsError
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
