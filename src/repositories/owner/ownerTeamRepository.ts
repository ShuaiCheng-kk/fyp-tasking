import { supabase } from '@/lib/supabase'
import { User } from '@/types/auth.types'

export const ownerTeamRepository = {

  async findCompanyById(company_id: string): Promise<{ id: string; owner_id: string } | null> {
    const { data, error } = await supabase
      .from('companies')
      .select('id, owner_id')
      .eq('id', company_id)
      .single()
    if (error) return null
    return data
  },

  async findMembersByCompanyId(company_id: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (data || []) as User[]
  },

  async findManagersByCompany(company_id: string): Promise<{ id: string; full_name: string }[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('company_id', company_id)
      .eq('role', 'Manager')
    if (error) throw new Error(error.message)
    return data || []
  },

  async findManagersByDepartment(company_id: string, department_id: string): Promise<{ id: string; full_name: string }[]> {
    const { data, error } = await supabase
      .from('manager_departments')
      .select('manager_id, users!inner(id, full_name)')
      .eq('company_id', company_id)
      .eq('department_id', department_id)
    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => ({ id: row.users.id, full_name: row.users.full_name }))
  },

  async findNonOwnerMembersByCompanyId(company_id: string): Promise<{ user_id: string; supabase_auth_id: string | null }[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, supabase_auth_id')
      .eq('company_id', company_id)
      .neq('role', 'Owner')
    if (error) throw new Error(error.message)
    return (data || []).map((row: any) => ({
      user_id: row.id as string,
      supabase_auth_id: (row.supabase_auth_id ?? null) as string | null,
    }))
  },

  async findUserById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data
  },

  async findUserByAuthIdOrInternalId(ref: string): Promise<User | null> {
    const { data: byAuth } = await supabase
      .from('users')
      .select('*')
      .eq('supabase_auth_id', ref)
      .single()
    if (byAuth) return byAuth
    const { data: byId } = await supabase
      .from('users')
      .select('*')
      .eq('id', ref)
      .single()
    return byId ?? null
  },

  async nullifyUserCompanyId(user_id: string, company_id: string): Promise<boolean> {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('id', user_id)
      .eq('company_id', company_id)
      .single()
    if (!existing) return false
    const { error } = await supabase
      .from('users')
      .update({ company_id: null })
      .eq('id', user_id)
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return true
  },

  async deleteUserById(user_id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', user_id)
    if (error) throw new Error(error.message)
  },

  async deleteInboxByUserId(user_id: string): Promise<void> {
    const { error } = await supabase
      .from('inbox')
      .delete()
      .or(`recipient_user_id.eq.${user_id},sender_user_id.eq.${user_id}`)
    if (error) throw new Error(error.message)
  },

  async deleteMessagesByUserId(user_id: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .delete()
      .or(`from_user_id.eq.${user_id},to_user_id.eq.${user_id}`)
    if (error) throw new Error(error.message)
  },

  async deleteManagerDepartmentsByUserId(user_id: string): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .delete()
      .eq('manager_id', user_id)
    if (error) throw new Error(error.message)
  },

  async deleteEmployeeDepartmentsByUserId(user_id: string): Promise<void> {
    const { error } = await supabase
      .from('employee_departments')
      .delete()
      .eq('employee_id', user_id)
    if (error) throw new Error(error.message)
  },

  async cleanupUserOperationalReferences(user_id: string, reassigned_by: string): Promise<void> {
    const { data: assignments, error: assignmentError } = await supabase
      .from('shift_assignments')
      .select('id')
      .eq('user_id', user_id)
    if (assignmentError) throw new Error(assignmentError.message)

    const assignmentIds = (assignments ?? []).map((row: { id: string }) => row.id)

    if (assignmentIds.length > 0) {
      const { error: attendanceError } = await supabase
        .from('attendance_records')
        .delete()
        .in('shift_assignment_id', assignmentIds)
      if (attendanceError) throw new Error(attendanceError.message)

      const { error: swapByAssignmentError } = await supabase
        .from('shift_swap_requests')
        .delete()
        .in('shift_assignment_id', assignmentIds)
      if (swapByAssignmentError) throw new Error(swapByAssignmentError.message)

      const { error: timeOffByAssignmentError } = await supabase
        .from('time_off_requests')
        .delete()
        .in('shift_assignment_id', assignmentIds)
      if (timeOffByAssignmentError) throw new Error(timeOffByAssignmentError.message)
    }

    const { error: attendanceByUserError } = await supabase
      .from('attendance_records')
      .delete()
      .or(`casual_worker_id.eq.${user_id},confirmed_by_employee_id.eq.${user_id},submitted_by_employee_id.eq.${user_id}`)
    if (attendanceByUserError) throw new Error(attendanceByUserError.message)

    const { error: attendanceReviewedByError } = await supabase
      .from('attendance_records')
      .update({ owner_reviewed_by: null })
      .eq('owner_reviewed_by', user_id)
    if (attendanceReviewedByError) throw new Error(attendanceReviewedByError.message)

    const { error: swapByUserError } = await supabase
      .from('shift_swap_requests')
      .delete()
      .or(`requester_id.eq.${user_id},replacement_user_id.eq.${user_id}`)
    if (swapByUserError) throw new Error(swapByUserError.message)

    const { error: swapReviewedByError } = await supabase
      .from('shift_swap_requests')
      .update({ reviewed_by: null })
      .eq('reviewed_by', user_id)
    if (swapReviewedByError) throw new Error(swapReviewedByError.message)

    const { error: timeOffByUserError } = await supabase
      .from('time_off_requests')
      .delete()
      .eq('requester_id', user_id)
    if (timeOffByUserError) throw new Error(timeOffByUserError.message)

    const { error: timeOffReviewedByError } = await supabase
      .from('time_off_requests')
      .update({ reviewed_by: null })
      .eq('reviewed_by', user_id)
    if (timeOffReviewedByError) throw new Error(timeOffReviewedByError.message)

    const { error: fixedOffError } = await supabase
      .from('employee_fixed_off_days')
      .delete()
      .eq('user_id', user_id)
    if (fixedOffError && !/does not exist|schema cache/i.test(fixedOffError.message)) {
      throw new Error(fixedOffError.message)
    }

    const { error: tasksAssignedError } = await supabase
      .from('tasks')
      .update({ assigned_user_id: null })
      .eq('assigned_user_id', user_id)
    if (tasksAssignedError) throw new Error(tasksAssignedError.message)

    const { error: tasksCreatedError } = await supabase
      .from('tasks')
      .update({ assigned_by: reassigned_by })
      .eq('assigned_by', user_id)
    if (tasksCreatedError) throw new Error(tasksCreatedError.message)

    const { error: shiftsCreatedError } = await supabase
      .from('shifts')
      .update({ created_by: reassigned_by })
      .eq('created_by', user_id)
    if (shiftsCreatedError) throw new Error(shiftsCreatedError.message)

    const { error: postingsCreatedError } = await supabase
      .from('job_postings')
      .update({ created_by: reassigned_by })
      .eq('created_by', user_id)
    if (postingsCreatedError) throw new Error(postingsCreatedError.message)

    const { error: postingsAssignedError } = await supabase
      .from('job_postings')
      .update({ assigned_employee_id: null })
      .eq('assigned_employee_id', user_id)
    if (postingsAssignedError) throw new Error(postingsAssignedError.message)

    const { error: announcementsError } = await supabase
      .from('announcements')
      .delete()
      .eq('from_user_id', user_id)
    if (announcementsError) throw new Error(announcementsError.message)

    const { error: shiftSupervisorError } = await supabase
      .from('shift_assignments')
      .update({ supervisor_employee_id: null })
      .eq('supervisor_employee_id', user_id)
    if (shiftSupervisorError) throw new Error(shiftSupervisorError.message)

    const { error: shiftAssignedByError } = await supabase
      .from('shift_assignments')
      .update({ assigned_by: reassigned_by })
      .eq('assigned_by', user_id)
    if (shiftAssignedByError) throw new Error(shiftAssignedByError.message)

    const { error: shiftAssignmentError } = await supabase
      .from('shift_assignments')
      .delete()
      .eq('user_id', user_id)
    if (shiftAssignmentError) throw new Error(shiftAssignmentError.message)
  },

  async findManagerDepartments(manager_id: string, company_id: string): Promise<{ department_id: string; department_name: string }[]> {
    const { data, error } = await supabase
      .from('manager_departments')
      .select('department_id, departments(name)')
      .eq('manager_id', manager_id)
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => ({
      department_id: row.department_id as string,
      department_name: (Array.isArray(row.departments) ? row.departments[0]?.name : row.departments?.name) ?? '',
    }))
  },

  async findDepartmentManagers(company_id: string): Promise<{
    department_id: string
    manager_id: string
    manager_name: string
  }[]> {
    const { data, error } = await supabase
      .from('manager_departments')
      .select('department_id, manager_id')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)

    const assignments = (data ?? []) as { department_id: string; manager_id: string }[]
    const managerIds = [...new Set(assignments.map(row => row.manager_id))]
    if (managerIds.length === 0) return []

    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', managerIds)
    if (userError) throw new Error(userError.message)

    const userMap = new Map((users ?? []).map(user => [user.id as string, user.full_name as string]))
    return assignments.map(row => ({
      department_id: row.department_id,
      manager_id: row.manager_id,
      manager_name: userMap.get(row.manager_id) ?? '',
    }))
  },

  async assignManagerDepartment(manager_id: string, company_id: string, department_id: string, assigned_by: string): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .insert({ manager_id, company_id, department_id, assigned_by })
    if (error) {
      if (error.code === '23505') {
        const { error: updateError } = await supabase
          .from('manager_departments')
          .update({ company_id, department_id, assigned_by, assigned_at: new Date().toISOString() })
          .eq('manager_id', manager_id)
        if (updateError) throw new Error(updateError.message)
        return
      }
      throw new Error(error.message)
    }
  },

  async removeManagerDepartmentsByCompany(manager_id: string, company_id: string): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .delete()
      .eq('manager_id', manager_id)
      .or(`company_id.eq.${company_id},company_id.is.null`)
    if (error) throw new Error(error.message)
  },

  async removeManagersFromDepartment(company_id: string, department_id: string): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .delete()
      .eq('department_id', department_id)
    if (error) throw new Error(error.message)
  },

  async removeManagerDepartment(manager_id: string, department_id: string): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .delete()
      .eq('manager_id', manager_id)
      .eq('department_id', department_id)
    if (error) throw new Error(error.message)
  },

}
