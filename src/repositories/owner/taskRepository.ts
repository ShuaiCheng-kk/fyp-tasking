// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()
import { Task, TaskInput, TaskStats, TaskStatItem, DepartmentTaskStats } from '@/types/Task'
import { TaskAssignment } from '@/types/TaskAssignment'
import { User } from '@/types/auth.types'
import { Shift } from '@/types/Shift'
import { sgtTodayKey } from '@/lib/singaporeTime'

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
        priority: input.priority ?? null,
        due_at: input.due_at ?? null,
        task_date: input.task_date ?? null,
        recurrence_group_id: input.recurrence_group_id ?? null,
        source_task_id: input.source_task_id ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    // Keeps task_assignments in sync with every assignee for every call site (sub-tasks,
    // duplicates, recurring occurrences) without any of them needing to know task_assignments
    // exists. assigned_user_ids is the full set (1+); every other caller only ever sets
    // assigned_user_id, which this treats as that same set with one entry.
    const assigneeIds = input.assigned_user_ids?.length ? input.assigned_user_ids : (input.assigned_user_id ? [input.assigned_user_id] : [])
    if (assigneeIds.length > 0) {
      const { error: assignError } = await supabase
        .from('task_assignments')
        .insert(assigneeIds.map(user_id => ({ task_id: data.id, user_id, assigned_by: input.assigned_by ?? null })))
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

  // A single .in() with every id inlined into the URL breaks once a company has enough tasks
  // (the request line gets too long for the DB gateway and comes back as a bare "Bad Request",
  // found via Performance NFR testing — the Kanban board loads every one of a viewer's non-
  // archived tasks through this path, so this is a real ceiling, not just a test-data artifact).
  // Chunking keeps each request's id list bounded regardless of company size.
  async getAssignmentsByTaskIds(task_ids: string[]): Promise<TaskAssignment[]> {
    if (task_ids.length === 0) return []
    const CHUNK_SIZE = 150
    const results: TaskAssignment[] = []
    for (let i = 0; i < task_ids.length; i += CHUNK_SIZE) {
      const chunk = task_ids.slice(i, i + CHUNK_SIZE)
      const { data, error } = await supabase
        .from('task_assignments')
        .select('*')
        .in('task_id', chunk)
      if (error) throw new Error(error.message)
      results.push(...(data ?? []) as TaskAssignment[])
    }
    return results
  },

  // department_ids is a security-scoping filter (e.g. a Manager's own departments), distinct from
  // any single department_id a caller applies afterwards as a UI-level "show just this one" filter.
  // assigned_user_id is the inverse of assigned_by — "tasks assigned TO this person" (Manager Tasks
  // page's My Tasks tab, Employee's own My Tasks board) rather than "tasks assigned BY this
  // person" — the two are never combined by any current caller, but nothing here prevents it.
  async getTasksByCompany(company_id: string, assigned_by?: string | string[], department_ids?: string[], assigned_user_id?: string): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select('id, shift_id, company_id, department_id, parent_task_id, sequence_order, title, description, assigned_user_id, assigned_by, status, priority, due_at, task_date, recurrence_group_id, source_task_id, is_archived, is_completed, rejection_reason, rejected_at, completed_at, reviewed_by, created_at, updated_at, shifts(shift_date)')
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
    if (assigned_user_id) {
      // A multi-assignee task's OTHER assignees never appear in tasks.assigned_user_id (that
      // column only ever holds the first/primary one) — matching on it alone silently hid this
      // person's own "My Tasks" board entries for anything they were the 2nd/3rd assignee on.
      const { data: memberOf, error: memberErr } = await supabase
        .from('task_assignments')
        .select('task_id')
        .eq('user_id', assigned_user_id)
      if (memberErr) throw new Error(memberErr.message)
      const directTaskIds = [...new Set((memberOf ?? []).map(r => r.task_id as string))]
      if (directTaskIds.length === 0) return []
      // A sub-task inherits only its PRIMARY assignee, even when its parent has several
      // co-assignees (assignTaskWithSubTasks/editTask) — so a non-primary co-assignee would
      // otherwise never see the sub-task at all, breaking both its visibility and the parent's own
      // sub-task-completion gate (their board has no way to know there's unfinished work left,
      // since the one sub-task proving it isn't done never shows up for them). Pull in every
      // sub-task whose PARENT this user is directly assigned to as well.
      const { data: subTaskRows, error: subErr } = await supabase
        .from('tasks')
        .select('id')
        .in('parent_task_id', directTaskIds)
      if (subErr) throw new Error(subErr.message)
      const taskIds = [...new Set([...directTaskIds, ...(subTaskRows ?? []).map(r => r.id as string)])]
      if (taskIds.length === 0) return []
      query = query.in('id', taskIds)
    }
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    const tasks = ((data ?? []) as unknown as (Task & { shifts: { shift_date: string }[] | null })[]).map(row => ({
      ...row,
      shift_date: row.shifts && row.shifts.length > 0 ? row.shifts[0].shift_date : null,
    }))
    return this.attachAssignedByNames(await this.attachAssignedUserIds(tasks))
  },

  async getArchivedTasksByCompany(company_id: string, assigned_by?: string | string[], department_ids?: string[]): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select('id, shift_id, company_id, department_id, parent_task_id, sequence_order, title, description, assigned_user_id, assigned_by, status, priority, due_at, task_date, recurrence_group_id, source_task_id, is_archived, rejection_reason, rejected_at, completed_at, reviewed_by, created_at, updated_at, shifts(shift_date)')
      .eq('company_id', company_id)
      .eq('is_archived', true)
      // Sub-tasks and recurring sibling occurrences (source_task_id set) archive alongside their
      // parent/original but only the top-level original task is listed in the archive view.
      .is('parent_task_id', null)
      .is('source_task_id', null)
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
    const { data, error } = await query.order('updated_at', { ascending: false })
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

  // Casual Worker's Task Board is scoped to "today's job", not literally this one shift row: when a
  // task has several assignees, each of them normally has their OWN shift_assignments row for the
  // same job occurrence (a separate shift_id per person, even sharing the same date/time/
  // department) — matching tasks.shift_id against exactly this one shift_id only ever surfaced the
  // task for whichever assignee happened to share that exact row, leaving every other co-assignee
  // looking at an empty board. Resolve the shift's own calendar date and match on that instead, plus
  // real assignee membership (attachAssignedUserIds), not just the single primary column.
  async getTasksByShiftForCompany(company_id: string, shift_id: string, assigned_user_id?: string): Promise<Task[]> {
    const { data: shift, error: shiftError } = await supabase
      .from('shifts')
      .select('shift_date')
      .eq('id', shift_id)
      .single()
    if (shiftError) throw new Error(shiftError.message)

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('company_id', company_id)
      .eq('task_date', (shift as { shift_date: string }).shift_date)
      .eq('is_archived', false)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)

    const tasks = await this.attachAssignedByNames(await this.attachAssignedUserIds((data ?? []) as Task[]))
    if (!assigned_user_id) return tasks

    const directIds = new Set(
      tasks
        .filter(t => t.assigned_user_id === assigned_user_id || (t.assigned_user_ids ?? []).includes(assigned_user_id))
        .map(t => t.id),
    )
    // Same reasoning as getTasksByCompany above: a sub-task inherits only its PRIMARY assignee, so
    // a non-primary co-assignee needs their parent's other sub-tasks pulled in too, or their board
    // never shows the one unfinished sub-task that's actually blocking Review.
    return tasks.filter(t => directIds.has(t.id) || (!!t.parent_task_id && directIds.has(t.parent_task_id)))
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

  // Casual Workers this Employee actually supervises TODAY — i.e. the exact set an Employee is
  // allowed to assign tasks to (one level down, per the company hierarchy). Supervision is
  // recorded per shift_assignment (supervisor_employee_id), scoped to today's shift_date only:
  // a CW who worked yesterday or is booked for tomorrow isn't assignable until their own shift
  // day arrives (confirmed 2026-07-25) — matches the real-world "they're on the floor today, so I
  // can hand them work today" relationship, not a standing roster.
  async getSupervisedCasualWorkerIds(employee_id: string, company_id: string, department_id: string): Promise<string[]> {
    // Shift dates are Singapore-nominal (see src/lib/singaporeTime) — raw UTC "today" drifts up to
    // 8 hours off the real Singapore calendar day, which made this reject a perfectly valid
    // reassignment to a Casual Worker the Employee genuinely supervises today whenever the two
    // dates disagreed (2026-08-01). Matches employeeDashboardRepository.getSupervisedWorkersToday.
    const today = sgtTodayKey()
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('user_id, shifts!inner(company_id, department_id, shift_date)')
      .eq('supervisor_employee_id', employee_id)
      .eq('shifts.company_id', company_id)
      .eq('shifts.department_id', department_id)
      .eq('shifts.shift_date', today)
    if (error) throw new Error(error.message)
    return [...new Set((data ?? []).map((row: { user_id: string }) => row.user_id))]
  },

  // Named version of getSupervisedCasualWorkerIds, for the Workload Suggestion candidate pool at
  // the Employee tier. Mirrors getManagersByDepartment / getEmployeesByDepartment, except the pool
  // is not a department roster: a Casual Worker belongs to an Employee only for the day they share
  // a shift, so the supervisor + today pairing above IS the membership.
  async getSupervisedCasualWorkersByEmployee(employee_id: string, company_id: string, department_id: string): Promise<{ id: string; full_name: string }[]> {
    const workerIds = await this.getSupervisedCasualWorkerIds(employee_id, company_id, department_id)
    if (workerIds.length === 0) return []
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('company_id', company_id)
      .in('id', workerIds)
    if (error) throw new Error(error.message)
    return (data ?? []) as { id: string; full_name: string }[]
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
    // Reassigning keeps task_assignments in sync automatically, the same way createTask does on
    // insert. assigned_user_ids (the full desired set) takes priority when the caller provides
    // it — falling back to the single assigned_user_id column would silently collapse an existing
    // multi-assignee task down to just its primary on any edit that didn't explicitly re-send
    // every id, which is exactly the bug this once was.
    if (input.assigned_user_ids !== undefined) {
      await this.replaceTaskAssignees(id, input.assigned_user_ids.filter(Boolean), assignedBy ?? null)
    } else if ('assigned_user_id' in input) {
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
      .select('id, title, status, priority, assigned_user_id, created_at, shift_id, due_at, shifts(shift_date)')
      .eq('company_id', company_id)
      .eq('is_archived', false)
    if (error) throw new Error(error.message)
    const allRows = (data ?? []) as unknown as { id: string; title: string; status: string; priority: string | null; assigned_user_id: string | null; created_at: string; shift_id: string | null; due_at: string | null; shifts: { shift_date: string }[] | null }[]
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

  // Workload lookup for AI Assign's ranking. Must read task_assignments, not the single
  // assigned_user_id column: a candidate who's only a secondary assignee on a multi-assignee task
  // (assigned_user_id always mirrors just the first id) would otherwise look permanently idle and
  // keep getting re-recommended over people with a genuinely empty workload.
  async getActiveTasksByAssignees(user_ids: string[]): Promise<{ assigned_user_id: string; priority: string | null; due_at: string | null }[]> {
    if (user_ids.length === 0) return []
    const { data, error } = await supabase
      .from('task_assignments')
      .select('user_id, tasks!inner(priority, due_at, is_archived, status)')
      .in('user_id', user_ids)
      .eq('tasks.is_archived', false)
      .neq('tasks.status', 'Complete')
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: { user_id: string; tasks: { priority: string | null; due_at: string | null } | { priority: string | null; due_at: string | null }[] }) => {
      const task = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks
      return { assigned_user_id: row.user_id, priority: task?.priority ?? null, due_at: task?.due_at ?? null }
    })
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
      .upsert({ company_id, threshold_percent, updated_by }, { onConflict: 'company_id' })
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
