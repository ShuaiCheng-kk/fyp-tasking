import { supabase } from '@/lib/supabase'
import { InvitationCode } from '@/types/invitation.types'

export const invitationRepository = {

  async createCode(data: {
    code: string
    company_id: string
    department_id: string | null
    role: InvitationCode['role']
    generated_by: string
    expired_at: string
    reporting_manager_id?: string | null
  }): Promise<InvitationCode> {
    const { reporting_manager_id, ...baseData } = data
    const insertData = reporting_manager_id
      ? { ...baseData, reporting_manager_id }
      : baseData
    const { data: invitation, error } = await supabase
      .from('invitation_code')
      .insert(insertData)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return invitation
  },

  async findByCode(code: string): Promise<InvitationCode | null> {
    const { data, error } = await supabase
      .from('invitation_code')
      .select('*')
      .eq('code', code)
      .eq('status', 'Active')
      .single()
    if (error) return null
    return data
  },

  async markAsUsed(code: string, used_by: string): Promise<void> {
    const { error } = await supabase
      .from('invitation_code')
      .update({ status: 'Expired', used_by })
      .eq('code', code)
    if (error) throw new Error(error.message)
  },

  async insertInboxInvite(data: {
    recipient_user_id: string
    sender_user_id: string
    company_id: string
    role: string
    department_id: string | null
  }): Promise<void> {
    const { error } = await supabase
      .from('inbox')
      .insert({ ...data, type: 'company_invite', status: 'pending' })
    if (error) throw new Error(error.message)
  },

  async insertEmployeeDepartment(employee_id: string, department_id: string): Promise<void> {
    const { error } = await supabase
      .from('employee_departments')
      .insert({ employee_id, department_id })
    if (error) throw new Error(error.message)
  },

  async insertManagerDepartment(manager_id: string, department_id: string, company_id: string): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .insert({ manager_id, department_id, company_id })
    if (error) throw new Error(error.message)
  },

}
