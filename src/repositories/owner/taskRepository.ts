// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { Task, TaskInput, TaskStats, TaskStatItem, DepartmentTaskStats } from '@/types/Task'
import { TaskAssignment } from '@/types/TaskAssignment'
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
    // Keeps task_assignments in sync with the primary assignee for every call site (sub-tasks,
    // duplicates, recurring occurrences) without any of them needing to know task_assignments exists.
    if (input.assigned_user_id) {
      const { error: assignError } = await supabase
        .from('task_assignments')
        .insert({ task_id: data.id, user_id: input.assigned_user_id, assigned_by: input.assigned_by ?? null })
      if (assignError) throw new Error(assignError.message)
    }
    return data as Task
  },

  // Full desired assignee set for a task — deletes the existing rows and inserts one per id.
  // Used explicitly when a caller provides assigned_user_ids (2+ assignees); the single-assignee
  // sync above/in updateTask covers everything else.
  async replaceTaskAssignees(task_id: string, user_ids: string[], assigned_by: string | null): Promise<void> {
    const { error: deleteError } = await supabase.from('task_assignments').delete().eq('task_id', task_id)
    if (deleteError) throw new Error(deleteError.message)
    if (user_ids.length === 0) return
    const { error: insertError } = await supabase
      .from('task_assignments')
      .insert(user_ids.map(user_id => ({ task_id, user_id, assigned_by })))
    if (insertError) throw new Error(insertError.message)
  },

  async getAssignmentsByTaskIds(task_ids: string[]): Promise<TaskAssignment[]> {
    if (task_ids.length === 0) return []
    const { data, error } = await supabase
      .from('task_assignments')
      .select('*')
      .in('task_id', task_ids)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as TaskAssignment[]
  },

  // department_ids is a security-scoping filter (e.g. a Manager's own departments), distinct from
  // any single department_id a caller applies afterwards as a UI-level "show just this one" filter.
  async getTasksByCompany(company_id: string, assigned_by?: string | string[], department_ids?: string[]): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select('id, shift_id, company_id, department_id, parent_task_id, sequence_order, title, description, assigned_user_id, assigned_by, status, percentage_complete, priority, due_at, task_date, recurrence_group_id, source_task_id, is_archived, rejection_reason, rejected_at, completed_at, reviewed_by, created_at, updated_at, shifts(shift_date)')
      .eq('company_id', company_id)
      .eq('is_archived', false)
    if (Array.isArray(assigned_by)) {
      if (assigned_by.length === 0) return []
      query = query.in('assigned_by', assigned_by)
    } else if (assigned_by) {
      query = query.eq('assigned_by', assigned_by)
    }
    if (department_ids) {
      if (department_ids.length === 0) return []
      query = query.in('department_id', department_ids)
    }
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    const tasks = ((data ?? []) as unknown as (Task & { shifts: { shift_date: string }[] | null })[]).map(row => ({
      ...row,
      shift_date: row.shifts && row.shifts.length > 0 ? row.shifts[0].shift_date : null,
    }))
    return this.attachAssignedByNames(await this.attachAssignedUserIds(tasks))
  },

  async getArchivedTasksByCompany(company_id: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, shift_id, company_id, department_id, parent_task_id, sequence_order, title, description, assigned_user_id, assigned_by, status, percentage_complete, priority, due_at, task_date, recurrence_group_id, source_task_id, is_archived, rejection_reason, rejected_at, completed_at, reviewed_by, created_at, updated_at, shifts(shift_date)')
      .eq('company_id', company_id)
      .eq('is_archived', true)
      // Sub-tasks and recurring sibling occurrences (source_task_id set) archive alongside their
      // parent/original but only the top-level original task is listed in the archive view.
      .is('parent_task_id', null)
      .is('source_task_id', null)
      .order('updated_at', { ascending: false })
    if (error) throw new Error(error.message)
    const tasks = ((data ?? []) as unknown as (Task & { shifts: { shift_date: string }[] | null })[]).map(row => ({
      ...row,
      shift_date: row.shifts && row.shifts.length > 0 ? row.shifts[0].shift_date : null,
    }))
    return this.attachAssignedByNames(await this.attachAssignedUserIds(tasks))
  },

  // Batch-attaches the full assignee set onto each top-level task (one extra query, not per row).
  async attachAssignedUserIds(tasks: Task[]): Promise<Task[]> {
    if (tasks.length === 0) return tasks
    const assignments = await this.getAssignmentsByTaskIds(tasks.map(t => t.id))
    const byTaskId = new Map<string, string[]>()
    for (const a of assignments) {
      const ids = byTaskId.get(a.task_id) ?? []
      ids.push(a.user_id)
      byTaskId.set(a.task_id, ids)
    }
    return tasks.map(t => ({ ...t, assigned_user_ids: byTaskId.get(t.id) ?? (t.assigned_user_id ? [t.assigned_user_id] : []) }))
  },

  // Batch-attaches the assigner's and reviewer's display names so every Task detail view (any
  // role) can show "Assigned By" / "Reviewed By" without a separate members-list fetch — needed
  // in particular by Casual Worker's task board, which never loads the full company member list.
  async attachAssignedByNames(tasks: Task[]): Promise<Task[]> {
    if (tasks.length === 0) return tasks
    const ids = [...new Set([
      ...tasks.map(t => t.assigned_by),
      ...tasks.map(t => t.reviewed_by),
    ].filter((id): id is string => !!id))]
    if (ids.length === 0) return tasks
    const { data, error } = await supabase.from('users').select('id, full_name').in('id', ids)
    if (error) throw new Error(error.message)
    const nameById = new Map((data ?? []).map(u => [u.id as string, u.full_name as string]))
    return tasks.map(t => ({
      ...t,
      assigned_by_name: t.assigned_by ? nameById.get(t.assigned_by) ?? null : null,
      reviewed_by_name: t.reviewed_by ? nameById.get(t.reviewed_by) ?? null : null,
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
    const { data, error } = await supabase
      .from('tasks')
      .update({ assigned_user_id: to_user_id })
      .eq('shift_id', shift_id)
      .eq('assigned_user_id', from_user_id)
      .in('status', ['Assigned', 'In Progress'])
      .eq('is_archived', false)
      .select('id')
    if (error) throw new Error(error.message)
    // Keep any co-assignee rows for the swapped tasks pointing at the new user too, so a
    // multi-assignee task doesn't retain a stale assignment to whoever gave up the shift.
    const affectedIds = (data ?? []).map(row => row.id as string)
    if (affectedIds.length > 0) {
      const { error: assignError } = await supabase
        .from('task_assignments')
        .update({ user_id: to_user_id })
        .eq('user_id', from_user_id)
        .in('task_id', affectedIds)
      if (assignError) throw new Error(assignError.message)
    }
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
    return this.attachAssignedByNames((data ?? []) as Task[])
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
    const [task] = await this.attachAssignedUserIds([data as Task])
    return task
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

  // Batch version of getManagersByDepartment — every manager assigned to ANY of the given
  // departments, de-duplicated. A manager assigned to two of the given departments still only
  // appears once (needed so a multi-department manager is correctly counted as a shared peer).
  async getManagersByDepartmentIds(company_id: string, department_ids: string[]): Promise<{ id: string; full_name: string }[]> {
    if (department_ids.length === 0) return []
    const { data, error } = await supabase
      .from('manager_departments')
      .select('users!manager_departments_manager_id_fkey!inner(id, full_name)')
      .eq('company_id', company_id)
      .in('department_id', department_ids)
    if (error) throw new Error(error.message)
    const byId = new Map<string, { id: string; full_name: string }>()
    for (const row of (data ?? []) as { users?: { id: string; full_name: string } | { id: string; full_name: string }[] | null }[]) {
      const user = Array.isArray(row.users) ? row.users[0] : row.users
      if (user) byId.set(user.id, user)
    }
    return [...byId.values()]
  },

  // Mirrors getManagersByDepartment for the Employee tier — the AI Workload Suggestion candidate
  // pool for a Manager's own team (Employees only, never Managers).
  async getEmployeesByDepartment(company_id: string, department_id: string): Promise<{ id: string; full_name: string }[]> {
    const { data: links, error: linksError } = await supabase
      .from('employee_departments')
      .select('employee_id')
      .eq('department_id', department_id)
    if (linksError) throw new Error(linksError.message)
    const employeeIds = [...new Set((links ?? []).map((row: { employee_id: string }) => row.employee_id))]
    if (employeeIds.length === 0) return []
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('company_id', company_id)
      .in('id', employeeIds)
    if (usersError) throw new Error(usersError.message)
    return (users ?? []) as { id: string; full_name: string }[]
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

  // assignedBy attributes any resulting task_assignments row (who performed the reassignment) —
  // it is never written to the tasks row itself, since tasks.assigned_by is the original creator
  // and stays immutable after creation.
  async updateTask(id: string, input: Partial<TaskInput>, assignedBy?: string | null): Promise<Task> {
    // assigned_user_ids is not a real column — it's consumed by replaceTaskAssignees below, never
    // written to the tasks row itself.
    const { assigned_user_ids: _assignedUserIds, ...columns } = input
    const { data, error } = await supabase
      .from('tasks')
      .update(columns)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    // Reassigning the primary (e.g. today's single-select "Assign To" edit) keeps task_assignments
    // in sync automatically, the same way createTask does on insert.
    if ('assigned_user_id' in input) {
      await this.replaceTaskAssignees(id, input.assigned_user_id ? [input.assigned_user_id] : [], assignedBy ?? null)
    }
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
    // Local calendar day, matching how due_at encodes a local wall-clock deadline — a UTC
    // todayStr would show the previous day's stats between local midnight and the UTC offset.
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
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
      if (r.due_at) {
        const due = new Date(r.due_at)
        const dueKey = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`
        return dueKey === todayStr
      }
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

  // Task Delay Alert threshold — one row per company; null means the company never customised it.
  async getTaskDelayThreshold(company_id: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('task_delay_alert_settings')
      .select('threshold_percent')
      .eq('company_id', company_id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? (data as { threshold_percent: number }).threshold_percent : null
  },

  async upsertTaskDelayThreshold(company_id: string, threshold_percent: number, updated_by: string | null): Promise<void> {
    const { error } = await supabase
      .from('task_delay_alert_settings')
      .upsert({ company_id, threshold_percent, updated_by, updated_at: new Date().toISOString() }, { onConflict: 'company_id' })
    if (error) throw new Error(error.message)
  },

  // Per-viewer acknowledgement — Owner and Partner are peer assigner roles viewing the same
  // tasks, so one of them dismissing an alert must not dismiss it for the other.
  async markDelayAlertsRead(task_ids: string[], user_id: string): Promise<void> {
    const { error } = await supabase
      .from('task_delay_alert_reads')
      .upsert(
        task_ids.map(task_id => ({ task_id, user_id, read_at: new Date().toISOString() })),
        { onConflict: 'task_id,user_id' },
      )
    if (error) throw new Error(error.message)
  },

  async getDelayAlertReadsByUser(user_id: string): Promise<Map<string, string>> {
    const { data, error } = await supabase
      .from('task_delay_alert_reads')
      .select('task_id, read_at')
      .eq('user_id', user_id)
    if (error) throw new Error(error.message)
    return new Map((data ?? []).map(row => [row.task_id as string, row.read_at as string]))
  },

  // A new deadline is a new delay window — un-dismiss for every viewer who had acknowledged it.
  async clearDelayAlertReads(task_id: string): Promise<void> {
    const { error } = await supabase
      .from('task_delay_alert_reads')
      .delete()
      .eq('task_id', task_id)
    if (error) throw new Error(error.message)
  },

}
