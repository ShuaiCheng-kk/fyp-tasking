// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { Task, TaskInput, TaskStats, TaskStatItem, DepartmentTaskStats } from '@/types/Task'
import { User } from '@/types/auth.types'
import { Shift } from '@/types/Shift'

export const taskRepository = {

  async createTask(input: TaskInput): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        shift_id: input.shift_id ?? null,
        company_id: input.company_id,
        department_id: input.department_id,
        parent_task_id: input.parent_task_id ?? null,
        sequence_order: input.sequence_order ?? null,
        title: input.title,
        description: input.description ?? null,
        assigned_user_id: input.assigned_user_id ?? null,
        assigned_by: input.assigned_by ?? null,
        status: input.status ?? 'Assigned',
        percentage_complete: input.percentage_complete ?? 0,
        priority: input.priority ?? null,
        due_at: input.due_at ?? null,
        task_date: input.task_date ?? null,
        recurrence_group_id: input.recurrence_group_id ?? null,
        source_task_id: input.source_task_id ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Task
  },

  async getTasksByCompany(company_id: string, assigned_by?: string): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select('id, shift_id, company_id, department_id, parent_task_id, sequence_order, title, description, assigned_user_id, assigned_by, status, percentage_complete, priority, due_at, task_date, recurrence_group_id, source_task_id, is_archived, created_at, updated_at, shifts(shift_date)')
      .eq('company_id', company_id)
      .eq('is_archived', false)
    if (assigned_by) query = query.eq('assigned_by', assigned_by)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return ((data ?? []) as unknown as (Task & { shifts: { shift_date: string }[] | null })[]).map(row => ({
      ...row,
      shift_date: row.shifts && row.shifts.length > 0 ? row.shifts[0].shift_date : null,
    }))
  },

  async getArchivedTasksByCompany(company_id: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, shift_id, company_id, department_id, parent_task_id, sequence_order, title, description, assigned_user_id, assigned_by, status, percentage_complete, priority, due_at, task_date, recurrence_group_id, source_task_id, is_archived, created_at, updated_at, shifts(shift_date)')
      .eq('company_id', company_id)
      .eq('is_archived', true)
      // Sub-tasks and recurring sibling occurrences (source_task_id set) archive alongside their
      // parent/original but only the top-level original task is listed in the archive view.
      .is('parent_task_id', null)
      .is('source_task_id', null)
      .order('updated_at', { ascending: false })
    if (error) throw new Error(error.message)
    return ((data ?? []) as unknown as (Task & { shifts: { shift_date: string }[] | null })[]).map(row => ({
      ...row,
      shift_date: row.shifts && row.shifts.length > 0 ? row.shifts[0].shift_date : null,
    }))
  },

  async getTasksByShift(shift_id: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('shift_id', shift_id)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as Task[]
  },

  // Bulk-moves a user's 'Assigned'/'In Progress' tasks on a shift to another user — used when a
  // shift swap is approved so task ownership follows the assignee. 'Review' tasks are awaiting
  // sign-off on this person's work and 'Complete'/archived tasks are done, so all three stay put.
  async reassignTasksForShiftSwap(shift_id: string, from_user_id: string, to_user_id: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .update({ assigned_user_id: to_user_id })
      .eq('shift_id', shift_id)
      .eq('assigned_user_id', from_user_id)
      .in('status', ['Assigned', 'In Progress'])
      .eq('is_archived', false)
    if (error) throw new Error(error.message)
  },

  async getTasksByShiftForCompany(company_id: string, shift_id: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('company_id', company_id)
      .eq('shift_id', shift_id)
      .eq('is_archived', false)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as Task[]
  },

  async getSubTasks(parent_task_id: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_task_id', parent_task_id)
      .order('sequence_order', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as Task[]
  },

  async getTaskById(id: string): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    return data as Task
  },

  async getTasksByRecurrenceGroupId(recurrence_group_id: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('recurrence_group_id', recurrence_group_id)
      .order('task_date', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as Task[]
  },

  async getUserById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data as User
  },

  async getManagerDepartmentIds(manager_id: string, company_id: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('manager_departments')
      .select('department_id')
      .eq('manager_id', manager_id)
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: { department_id: string }) => row.department_id)
  },

  async getManagersByDepartment(company_id: string, department_id: string): Promise<{ id: string; full_name: string }[]> {
    const { data, error } = await supabase
      .from('manager_departments')
      .select('users!manager_departments_manager_id_fkey!inner(id, full_name)')
      .eq('company_id', company_id)
      .eq('department_id', department_id)
    if (error) throw new Error(error.message)
    return (data ?? [])
      .map((row: { users?: { id: string; full_name: string } | { id: string; full_name: string }[] | null }) => {
        if (!row.users) return null
        return Array.isArray(row.users) ? row.users[0] ?? null : row.users
      })
      .filter((user): user is { id: string; full_name: string } => !!user)
  },

  async getEmployeeDepartmentIds(user_id: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('employee_departments')
      .select('department_id')
      .eq('employee_id', user_id)
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: { department_id: string }) => row.department_id)
  },

  // Casual Workers this Employee actually supervises within a given department — i.e. the exact
  // set an Employee is allowed to assign tasks to (one level down, per the company hierarchy).
  // Supervision is recorded per shift_assignment (supervisor_employee_id), not company/department-
  // wide, so this only counts CWs the Employee has a real supervising shift relationship with.
  async getSupervisedCasualWorkerIds(employee_id: string, company_id: string, department_id: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('user_id, shifts!inner(company_id, department_id)')
      .eq('supervisor_employee_id', employee_id)
      .eq('shifts.company_id', company_id)
      .eq('shifts.department_id', department_id)
    if (error) throw new Error(error.message)
    return [...new Set((data ?? []).map((row: { user_id: string }) => row.user_id))]
  },

  async getShiftById(id: string): Promise<Shift | null> {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data as Shift
  },

  async hasShiftOnDate(user_id: string, company_id: string, shift_date: string): Promise<boolean> {
    // A draft shift isn't a real commitment yet, so it can't make someone eligible for a task.
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('id, shifts!inner(shift_date, company_id, publication_status)')
      .eq('user_id', user_id)
      .eq('shifts.company_id', company_id)
      .eq('shifts.shift_date', shift_date)
      .eq('shifts.publication_status', 'published')
      .limit(1)
    if (error) throw new Error(error.message)
    return (data ?? []).length > 0
  },

  async updateTask(id: string, input: Partial<TaskInput>): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Task
  },

  async updateSubTasksByParent(parent_task_id: string, input: Partial<TaskInput>): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .update(input)
      .eq('parent_task_id', parent_task_id)
    if (error) throw new Error(error.message)
  },

  async deleteTask(id: string): Promise<void> {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async deleteSubTasksByParent(parent_task_id: string): Promise<void> {
    const { error } = await supabase.from('tasks').delete().eq('parent_task_id', parent_task_id)
    if (error) throw new Error(error.message)
  },

  async getTaskStatsByCompany(company_id: string): Promise<TaskStats> {
    const todayStr = new Date().toISOString().split('T')[0]
    // Fetch tasks whose linked shift is today, or whose due_at falls today (no shift)
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status, priority, percentage_complete, assigned_user_id, created_at, shift_id, due_at, shifts(shift_date)')
      .eq('company_id', company_id)
      .eq('is_archived', false)
    if (error) throw new Error(error.message)
    const allRows = (data ?? []) as unknown as { id: string; title: string; status: string; priority: string | null; percentage_complete: number; assigned_user_id: string | null; created_at: string; shift_id: string | null; due_at: string | null; shifts: { shift_date: string }[] | null }[]
    const rows = allRows.filter(r => {
      if (r.shift_id && r.shifts && r.shifts.length > 0) return r.shifts[0].shift_date === todayStr
      if (r.due_at) return r.due_at.slice(0, 10) === todayStr
      return false
    })

    const assigneeIds = [...new Set(rows.map(r => r.assigned_user_id).filter(Boolean))] as string[]
    const userMap = new Map<string, string>()
    if (assigneeIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, full_name').in('id', assigneeIds)
      for (const u of (users ?? []) as { id: string; full_name: string }[]) userMap.set(u.id, u.full_name)
    }

    const tasks: TaskStatItem[] = rows.map(r => ({
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      percentage_complete: r.percentage_complete,
      assigned_user_id: r.assigned_user_id,
      assignee_name: r.assigned_user_id ? (userMap.get(r.assigned_user_id) ?? undefined) : undefined,
      created_at: r.created_at,
    }))

    return {
      assigned: rows.filter(r => r.status === 'Assigned').length,
      inProgress: rows.filter(r => r.status === 'In Progress').length,
      review: rows.filter(r => r.status === 'Review').length,
      complete: rows.filter(r => r.status === 'Complete').length,
      tasks,
    }
  },

  async getTaskStatsByDepartment(company_id: string): Promise<DepartmentTaskStats[]> {
    const { data: tasks, error: taskErr } = await supabase
      .from('tasks')
      .select('department_id, status')
      .eq('company_id', company_id)
      .eq('is_archived', false)
    if (taskErr) throw new Error(taskErr.message)

    const deptIds = [...new Set((tasks ?? []).map((t: { department_id: string }) => t.department_id))]
    if (deptIds.length === 0) return []

    const { data: depts, error: deptErr } = await supabase
      .from('departments')
      .select('id, name')
      .in('id', deptIds)
    if (deptErr) throw new Error(deptErr.message)

    const deptMap = new Map((depts ?? []).map((d: { id: string; name: string }) => [d.id, d.name]))

    return deptIds.map(deptId => {
      const deptTasks = (tasks ?? []).filter((t: { department_id: string }) => t.department_id === deptId)
      return {
        department_id: deptId,
        department_name: deptMap.get(deptId) ?? deptId,
        assigned: deptTasks.filter((t: { status: string }) => t.status === 'Assigned').length,
        inProgress: deptTasks.filter((t: { status: string }) => t.status === 'In Progress').length,
        review: deptTasks.filter((t: { status: string }) => t.status === 'Review').length,
        complete: deptTasks.filter((t: { status: string }) => t.status === 'Complete').length,
      }
    })
  },

  async getActivityFeedToday(company_id: string): Promise<{
    tasks: { id: string; title: string; status: string; updated_at: string; department_id: string; assigned_user_id: string | null }[]
    departments: { id: string; name: string }[]
    users: { id: string; full_name: string; role: string }[]
  }> {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status, updated_at, department_id, assigned_user_id')
      .eq('company_id', company_id)
      .eq('is_archived', false)
      .neq('status', 'Assigned')
      .gte('updated_at', todayStart.toISOString())
      .lte('updated_at', todayEnd.toISOString())
      .order('updated_at', { ascending: false })
      .limit(20)
    if (error) throw new Error(error.message)

    const tasks = (data ?? []) as { id: string; title: string; status: string; updated_at: string; department_id: string; assigned_user_id: string | null }[]

    const deptIds = [...new Set(tasks.map(t => t.department_id))]
    const userIds = tasks.map(t => t.assigned_user_id).filter(Boolean) as string[]

    const [deptsRes, usersRes] = await Promise.all([
      deptIds.length > 0
        ? supabase.from('departments').select('id, name').in('id', deptIds)
        : { data: [], error: null },
      userIds.length > 0
        ? supabase.from('users').select('id, full_name, role').in('id', userIds)
        : { data: [], error: null },
    ])

    return {
      tasks,
      departments: (deptsRes.data ?? []) as { id: string; name: string }[],
      users: (usersRes.data ?? []) as { id: string; full_name: string; role: string }[],
    }
  },

  async getTasksByCompanyWithFilters(
    company_id: string,
    filters: { status?: string; department_id?: string },
  ): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('company_id', company_id)
      .eq('is_archived', false)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.department_id) query = query.eq('department_id', filters.department_id)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as Task[]
  },

  async getActiveTasksByAssignees(user_ids: string[]): Promise<{ assigned_user_id: string; priority: string | null; due_at: string | null }[]> {
    if (user_ids.length === 0) return []
    const { data, error } = await supabase
      .from('tasks')
      .select('assigned_user_id, priority, due_at')
      .in('assigned_user_id', user_ids)
      .eq('is_archived', false)
      .neq('status', 'Complete')
    if (error) throw new Error(error.message)
    return (data ?? []) as { assigned_user_id: string; priority: string | null; due_at: string | null }[]
  },

}
