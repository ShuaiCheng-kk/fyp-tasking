import { supabase } from '@/lib/supabase'
import { User } from '@/types/auth.types'

export const ownerTeamRepository = {

  async findCompanyById(company_id: string): Promise<{ id: string; owner_id: string; name: string } | null> {
    const { data, error } = await supabase
      .from('companies')
      .select('id, owner_id, name')
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

  // BUG-084 follow-up: Partner removal generalizes the same reassignment pattern as Manager, but
  // Partner is never blocked — Owner always exists as the ultimate fallback if no other Partner does.
  async findPartnersByCompany(company_id: string): Promise<{ id: string; full_name: string }[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('company_id', company_id)
      .eq('role', 'Partner')
    if (error) throw new Error(error.message)
    return data || []
  },

  async findEmployeeDepartments(employee_id: string, company_id: string): Promise<{ department_id: string; department_name: string }[]> {
    const { data, error } = await supabase
      .from('employee_departments')
      .select('department_id, departments(name)')
      .eq('employee_id', employee_id)
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => ({
      department_id: row.department_id as string,
      department_name: (Array.isArray(row.departments) ? row.departments[0]?.name : row.departments?.name) ?? '',
    }))
  },

  async findEmployeesByDepartment(company_id: string, department_id: string): Promise<{ id: string; full_name: string }[]> {
    const { data, error } = await supabase
      .from('employee_departments')
      .select('employee_id, users!employee_departments_employee_id_fkey!inner(id, full_name)')
      .eq('company_id', company_id)
      .eq('department_id', department_id)
    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => ({ id: row.users.id, full_name: row.users.full_name }))
  },

  async findManagersByDepartment(company_id: string, department_id: string): Promise<{ id: string; full_name: string }[]> {
    const { data, error } = await supabase
      .from('manager_departments')
      .select('manager_id, users!manager_departments_manager_id_fkey!inner(id, full_name)')
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

  // BUG-050: this used to hard-delete shift_assignments/attendance_records rows to dodge their
  // NOT NULL user_id FK — that left orphan shifts behind (assignment gone, shift row still there)
  // and destroyed historical clock-in/payroll data. user_id is nullable now with a name-snapshot
  // column, so both tables are nulled + stamped with the removed user's name instead of deleted.
  // BUG-084: `reassignAssigneeTo` is only set (to a same-department replacement Manager) when the
  // person being removed is themselves a Manager — a task ASSIGNED TO them (assigned_user_id, e.g.
  // Owner tasked them directly) should transfer to whoever inherits their department, same as their
  // own assigned_by/created_by work does below. Left null for every other role (Employee/Casual
  // Worker removal keeps the existing behavior of nulling assigned_user_id — nobody asked for that
  // to change, and reassigning it to the Owner who clicked Remove would break the
  // Owner→Manager→Employee→CW one-level-down assignment convention).
  async cleanupUserOperationalReferences(user_id: string, reassigned_by: string, removed_user_full_name: string, reassignAssigneeTo: string | null = null): Promise<void> {
    const { data: assignments, error: assignmentError } = await supabase
      .from('shift_assignments')
      .select('id')
      .eq('user_id', user_id)
    if (assignmentError) throw new Error(assignmentError.message)

    const assignmentIds = (assignments ?? []).map((row: { id: string }) => row.id)

    if (assignmentIds.length > 0) {
      const { error: attendanceError } = await supabase
        .from('attendance_records')
        .update({ user_id: null, user_name_snapshot: removed_user_full_name })
        .in('shift_assignment_id', assignmentIds)
      if (attendanceError) throw new Error(attendanceError.message)

      const { error: swapByAssignmentError } = await supabase
        .from('shift_swap_requests')
        .delete()
        .or(`requester_assignment_id.in.(${assignmentIds.join(',')}),counterpart_assignment_id.in.(${assignmentIds.join(',')})`)
      if (swapByAssignmentError) throw new Error(swapByAssignmentError.message)
    }

    const { error: attendanceByUserError } = await supabase
      .from('attendance_records')
      .update({ user_id: null, user_name_snapshot: removed_user_full_name })
      .eq('user_id', user_id)
    if (attendanceByUserError) throw new Error(attendanceByUserError.message)

    const { error: attendanceModifiedByError } = await supabase
      .from('attendance_records')
      .update({ modified_by: null })
      .eq('modified_by', user_id)
    if (attendanceModifiedByError) throw new Error(attendanceModifiedByError.message)

    const { error: swapByUserError } = await supabase
      .from('shift_swap_requests')
      .delete()
      .or(`requester_id.eq.${user_id},counterpart_id.eq.${user_id}`)
    if (swapByUserError) throw new Error(swapByUserError.message)

    const { error: swapReviewedByError } = await supabase
      .from('shift_swap_requests')
      .update({ reviewed_by: null })
      .eq('reviewed_by', user_id)
    if (swapReviewedByError) throw new Error(swapReviewedByError.message)

    const { error: tasksAssignedError } = await supabase
      .from('tasks')
      .update({ assigned_user_id: reassignAssigneeTo })
      .eq('assigned_user_id', user_id)
    if (tasksAssignedError) throw new Error(tasksAssignedError.message)

    const { error: tasksCreatedError } = await supabase
      .from('tasks')
      .update({ assigned_by: reassigned_by })
      .eq('assigned_by', user_id)
    if (tasksCreatedError) throw new Error(tasksCreatedError.message)

    // task_assignments.user_id cascades on user delete, but assigned_by has no on-delete action —
    // reassign it like tasks.assigned_by above so deleting the user doesn't hit the FK.
    const { error: taskAssignmentsByError } = await supabase
      .from('task_assignments')
      .update({ assigned_by: reassigned_by })
      .eq('assigned_by', user_id)
    if (taskAssignmentsByError) throw new Error(taskAssignmentsByError.message)

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
      .update({ assigned_employee_id: reassignAssigneeTo })
      .eq('assigned_employee_id', user_id)
    if (postingsAssignedError) throw new Error(postingsAssignedError.message)

    const { error: announcementsError } = await supabase
      .from('announcements')
      .delete()
      .eq('user_id', user_id)
    if (announcementsError) throw new Error(announcementsError.message)

    const { error: shiftSupervisorError } = await supabase
      .from('shift_assignments')
      .update({ supervisor_employee_id: reassignAssigneeTo })
      .eq('supervisor_employee_id', user_id)
    if (shiftSupervisorError) throw new Error(shiftSupervisorError.message)

    const { error: shiftAssignedByError } = await supabase
      .from('shift_assignments')
      .update({ assigned_by: reassigned_by })
      .eq('assigned_by', user_id)
    if (shiftAssignedByError) throw new Error(shiftAssignedByError.message)

    // BUG-084: a removed member's shift_assignments used to all get the same null+snapshot
    // treatment regardless of whether the shift had even happened yet — so a future shift they'd
    // never worked kept sitting on the Owner/Partner Shifts page forever, snapshotted under a name
    // that no longer belongs to anyone. Split by whether an attendance_record exists (i.e. they
    // actually clocked in): if so, keep it null+snapshotted (payroll/history must survive); if not,
    // delete the assignment outright so the shift stops showing them at all. Only THEIR OWN
    // assignment row is touched — a shift with other people also assigned keeps those other rows
    // untouched, so nobody else's schedule is affected.
    if (assignmentIds.length > 0) {
      const { data: attendedRows, error: attendedRowsError } = await supabase
        .from('attendance_records')
        .select('shift_assignment_id')
        .in('shift_assignment_id', assignmentIds)
      if (attendedRowsError) throw new Error(attendedRowsError.message)
      const attendedIds = new Set((attendedRows ?? []).map((row: { shift_assignment_id: string }) => row.shift_assignment_id))
      const futureAssignmentIds = assignmentIds.filter(id => !attendedIds.has(id))
      const pastAssignmentIds = assignmentIds.filter(id => attendedIds.has(id))

      if (futureAssignmentIds.length > 0) {
        const { error: deleteFutureError } = await supabase
          .from('shift_assignments')
          .delete()
          .in('id', futureAssignmentIds)
        if (deleteFutureError) throw new Error(deleteFutureError.message)
      }
      if (pastAssignmentIds.length > 0) {
        const { error: keepPastError } = await supabase
          .from('shift_assignments')
          .update({ user_id: null, user_name_snapshot: removed_user_full_name })
          .in('id', pastAssignmentIds)
        if (keepPastError) throw new Error(keepPastError.message)
      }
    }

    // BUG-083: shift_swap_department_settings.updated_by has no ON DELETE action — removing a
    // Manager who had last touched their department's swap settings raised a raw FK violation
    // straight to the UI instead of completing the removal. Just an audit "who last touched this"
    // field, same treatment as attendance_records.modified_by / shift_swap_requests.reviewed_by
    // above — null it out rather than reassign.
    const { error: swapDeptSettingsError } = await supabase
      .from('shift_swap_department_settings')
      .update({ updated_by: null })
      .eq('updated_by', user_id)
    if (swapDeptSettingsError) throw new Error(swapDeptSettingsError.message)

    // BUG-083 follow-up: same missing-cleanup class found by auditing every FK to users(id) with
    // no ON DELETE action across all migrations — each of these would have hit the exact same raw
    // FK violation the first time someone happened to remove a user who'd touched that row.
    const { error: swapCompanySettingsError } = await supabase
      .from('shift_swap_settings')
      .update({ updated_by: null })
      .eq('updated_by', user_id)
    if (swapCompanySettingsError) throw new Error(swapCompanySettingsError.message)

    const { error: offDayReviewedError } = await supabase
      .from('off_day_requests')
      .update({ reviewed_by: null })
      .eq('reviewed_by', user_id)
    if (offDayReviewedError) throw new Error(offDayReviewedError.message)

    const { error: tasksReviewedByError } = await supabase
      .from('tasks')
      .update({ reviewed_by: null })
      .eq('reviewed_by', user_id)
    if (tasksReviewedByError) throw new Error(tasksReviewedByError.message)
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

  async assignManagerDepartment(manager_id: string, company_id: string, department_id: string): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .insert({ manager_id, company_id, department_id })
    if (error) {
      if (error.code === '23505') {
        const { error: updateError } = await supabase
          .from('manager_departments')
          .update({ company_id, department_id })
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

  async findDepartmentById(department_id: string, company_id: string): Promise<{ id: string } | null> {
    const { data, error } = await supabase
      .from('departments')
      .select('id')
      .eq('id', department_id)
      .eq('company_id', company_id)
      .single()
    if (error) return null
    return data
  },

  async assignEmployeeDepartment(employee_id: string, department_id: string): Promise<void> {
    const { error } = await supabase
      .from('employee_departments')
      .insert({ employee_id, department_id })
    if (error) throw new Error(error.message)
  },

  async moveManagerToDepartment(manager_id: string, company_id: string, department_id: string): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .insert({ manager_id, company_id, department_id })
    if (error) throw new Error(error.message)
  },

}
