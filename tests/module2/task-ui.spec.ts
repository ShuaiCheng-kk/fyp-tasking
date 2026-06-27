import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type SeededMember = {
  authUserId: string
  userId: string
  email: string
}

let seeded: TestOwner
let departmentId: string
let shiftId: string
let createdShiftIds: string[] = []
let taskUiDate: string
let managerA: SeededMember
let managerB: SeededMember

test.describe.configure({ mode: 'serial' })

async function createManager(label: string): Promise<SeededMember> {
  const email = `test-module2-ui-manager-${label}-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: 'Test-Password-123!',
    email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create auth user: ${authError?.message}`)

  const { data: user, error: userError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      full_name: `Module 2 UI Manager ${label}`,
      email_address: email,
      phone_number: null,
      role: 'Manager',
      company_id: seeded.companyId,
      worker_status: 'active',
    })
    .select('id')
    .single()
  if (userError || !user) throw new Error(`Failed to create manager row: ${userError?.message}`)

  const { error: deptError } = await admin
    .from('manager_departments')
    .insert({ manager_id: user.id, company_id: seeded.companyId, department_id: departmentId, assigned_by: seeded.ownerId })
  if (deptError) throw new Error(`Failed to assign manager department: ${deptError.message}`)

  return { authUserId: authData.user.id, userId: user.id as string, email }
}

async function signInOwner(page: import('@playwright/test').Page) {
  const res = await page.request.post('/api/auth/signin', {
    data: {
      email_address: seeded.email,
      password: seeded.password,
    },
  })
  expect(res.status()).toBe(200)
  await page.addInitScript(({ authUserId, companyId }) => {
    localStorage.setItem('tasking_user_id', authUserId)
    localStorage.setItem('tasking_user_role', 'Owner')
    localStorage.setItem(`tasking_company_id_${authUserId}`, companyId)
  }, { authUserId: seeded.authUserId, companyId: seeded.companyId })
}

async function openAssignTaskForManagerA(page: import('@playwright/test').Page) {
  const backToDepartments = page.getByRole('button', { name: 'Back to all departments' })
  if (await backToDepartments.count() > 0) {
    await backToDepartments.click()
  }

  await page.locator('.task-dept-card').filter({ hasText: 'Operations' }).click()
  await page.locator('.member-card').filter({ hasText: 'Module 2 UI Manager A' }).getByTitle('Assign Task').click()
  await expect(page.getByRole('heading', { name: 'Assign Task to Module 2 UI Manager A' })).toBeVisible()
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('module2-ui')

  const { data: department, error: deptError } = await admin
    .from('departments')
    .insert({ company_id: seeded.companyId, name: 'Operations' })
    .select('id')
    .single()
  if (deptError || !department) throw new Error(`Failed to create department: ${deptError?.message}`)
  departmentId = department.id as string

  managerA = await createManager('A')
  managerB = await createManager('B')
  taskUiDate = formatDateKey(new Date())

  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: taskUiDate,
      start_time: '09:00',
      end_time: '17:00',
      title: 'Module 2 UI Shift',
      created_by: seeded.ownerId,
      publication_status: 'published',
    })
    .select('id')
    .single()
  if (shiftError || !shift) throw new Error(`Failed to create shift: ${shiftError?.message}`)
  shiftId = shift.id as string
  createdShiftIds.push(shiftId)

  const { error: assignmentError } = await admin
    .from('shift_assignments')
    .insert([
      { shift_id: shiftId, user_id: managerA.userId, assigned_by: seeded.ownerId },
      { shift_id: shiftId, user_id: managerB.userId, assigned_by: seeded.ownerId },
    ])
  if (assignmentError) throw new Error(`Failed to create shift assignments: ${assignmentError.message}`)

  const seedTasks = [
    ['Prep opening checklist', 'Assigned', managerA.userId, 'High', 0],
    ['Stock front desk', 'In Progress', managerA.userId, 'Medium', 45],
    ['Review VIP room', 'Review', managerB.userId, 'Urgent', 80],
  ] as const

  for (const [title, status, assignedUserId, priority, percentageComplete] of seedTasks) {
    const { error } = await admin.from('tasks').insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_id: shiftId,
      title,
      description: `${title} details`,
      assigned_user_id: assignedUserId,
      assigned_by: seeded.ownerId,
      status,
      percentage_complete: percentageComplete,
      priority,
      task_date: taskUiDate,
      due_at: `${taskUiDate}T18:00:00.000Z`,
    })
    if (error) throw new Error(`Failed to seed task: ${error.message}`)
  }
})

test.afterAll(async () => {
  await admin.from('task_templates').delete().eq('company_id', seeded.companyId)
  await admin.from('tasks').delete().eq('company_id', seeded.companyId)
  if (createdShiftIds.length > 0) {
    await admin.from('shift_assignments').delete().in('shift_id', createdShiftIds)
    await admin.from('shifts').delete().in('id', createdShiftIds)
  }
  await admin.from('manager_departments').delete().eq('company_id', seeded.companyId)
  await admin.from('departments').delete().eq('id', departmentId)

  for (const member of [managerA, managerB]) {
    await admin.from('users').delete().eq('id', member.userId)
    await admin.auth.admin.deleteUser(member.authUserId).catch(() => undefined)
  }

  await cleanupTestOwnerAndCompany(seeded)
})

test('owner can use the Module 2 task UI end to end', async ({ page }) => {
  await signInOwner(page)

  await page.goto('/owner/tasks')
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()
  await expect(page.getByText('Prep opening checklist')).toBeVisible()
  await expect(page.getByText('Stock front desk')).toBeVisible()

  // New Task / AI Assign toolbar buttons were removed — manual assign now happens via
  // the department card's per-person "+" button, and AI Assign lives under Departments.
  await expect(page.getByRole('button', { name: 'New Task' })).toHaveCount(0)
  await openAssignTaskForManagerA(page)
  await page.getByPlaceholder('Task title...').fill('UI created task')
  await page.getByRole('button', { name: 'Select priority' }).click()
  await page.getByRole('button', { name: 'High' }).click()
  await page.getByRole('button', { name: 'Select deadline' }).click()
  await page.getByRole('button', { name: String(new Date().getDate()), exact: true }).and(page.locator('button:visible')).first().click()
  await page.getByRole('button', { name: 'PM', exact: true }).click()
  await page.getByRole('button', { name: '6:00' }).click()
  await page.getByRole('button', { name: 'Create Task' }).click()
  await expect(page.getByText('UI created task')).toBeVisible({ timeout: 15000 })

  // Duplicate/Archive/Delete live in the read-only Details panel (opened via the card body),
  // not the Edit Task form (opened via the pencil icon) — only the assigner sees those actions.
  // Exact-match the title so this locator stays unique once "UI created task (copy)" exists too.
  const createdCard = page.locator('.task-card').filter({ has: page.getByText('UI created task', { exact: true }) })
  await createdCard.click()
  await page.getByTestId('task-details-panel').getByRole('button', { name: 'Duplicate' }).click()
  await expect(page.getByText('Task duplicated.')).toBeVisible() // duplicating closes the Details panel automatically

  await createdCard.getByRole('button').first().click()
  await expect(page.getByRole('heading', { name: 'Edit Task' })).toBeVisible()
  await page.getByRole('textbox').first().fill('UI edited task')
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('UI edited task')).toBeVisible()

  const editedCard = page.locator('.task-card').filter({ hasText: 'UI edited task' }).first()
  await editedCard.click()
  await page.getByTestId('task-details-panel').getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByText('Task archived.')).toBeVisible()
  // Archiving just closes the Details panel and removes the card from the board — it does not
  // auto-open the Archived Tasks list (that's a separate, manually-opened modal).
  await expect(page.getByText('UI edited task')).toHaveCount(0)

  await page.getByRole('button', { name: 'Calendar' }).click()
  await expect(page.getByText('Module 2 UI Manager A').first()).toBeVisible()

  // Back out to the department grid, where the AI Assign button lives now.
  await page.getByRole('button', { name: 'Back to all departments' }).click()
  await page.getByRole('button', { name: 'AI Assign' }).first().click()
  await expect(page.getByRole('heading', { name: 'AI Assign' })).toBeVisible()
})

test('New Task modal blocks past start dates and the Deadline field selects date then time', async ({ page }) => {
  await signInOwner(page)
  await page.goto('/owner/tasks')

  await openAssignTaskForManagerA(page)

  // Start Date's calendar floor must be today's month — not a week-aligned date in the past.
  // The field may prefill to a future shift date, so navigate backward and confirm the
  // prev-month chevron disables itself once today's month is reached (it must not go earlier).
  const todayMonthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayDay = String(new Date().getDate())
  await page.locator('label', { hasText: 'Start Date' }).locator('..').getByRole('button').first().click()
  const startMonthLabel = page.locator('span', { hasText: /^[A-Z][a-z]+ \d{4}$/ })
  const startPrevBtn = startMonthLabel.locator('xpath=preceding-sibling::button[1]')
  for (let i = 0; i < 60 && await startPrevBtn.isEnabled(); i++) {
    await startPrevBtn.click()
  }
  await expect(startMonthLabel).toHaveText(todayMonthLabel)
  await expect(startPrevBtn).toBeDisabled()
  await page.getByRole('button', { name: todayDay, exact: true }).and(page.locator('button:visible')).first().click()

  // Deadline is a single field: opening it shows the calendar first (floor = Start Date,
  // i.e. today here), picking a date advances to the time list within the same popover.
  await page.getByRole('button', { name: 'Select deadline' }).click()
  const deadlineMonthLabel = page.locator('span', { hasText: /^[A-Z][a-z]+ \d{4}$/ })
  await expect(deadlineMonthLabel).toHaveText(todayMonthLabel)
  const deadlinePrevBtn = deadlineMonthLabel.locator('xpath=preceding-sibling::button[1]')
  await expect(deadlinePrevBtn).toBeDisabled()
  await page.getByRole('button', { name: todayDay, exact: true }).and(page.locator('button:visible')).first().click()

  // After picking the date, the same popover now shows the time list (with a way back to the date).
  await expect(page.getByRole('button', { name: 'AM', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'PM', exact: true }).click()
  await page.getByRole('button', { name: '6:00' }).click()
  await expect(page.getByRole('button', { name: /, 6:00 PM$/ })).toBeVisible()
})

test('Template button manages task templates and the New Task modal can use one', async ({ page }) => {
  await signInOwner(page)
  await page.goto('/owner/tasks')

  await page.getByRole('button', { name: 'Template' }).click()
  await expect(page.getByRole('heading', { name: 'Task Templates' })).toBeVisible()
  await expect(page.getByText('No task templates yet')).toBeVisible()

  // Create
  await page.getByRole('button', { name: 'New Template' }).click()
  await expect(page.getByRole('heading', { name: 'New Template' })).toBeVisible()
  await page.getByPlaceholder('e.g. Daily Cleaning Checklist').fill('Daily Cleaning Checklist')
  await page.getByPlaceholder('Task title this template creates...').fill('Clean front desk')
  await page.getByPlaceholder('Add more context...').fill('Wipe down and restock')
  await page.getByRole('button', { name: 'Select priority' }).click()
  await page.getByRole('button', { name: 'Medium' }).click()
  await page.getByRole('button', { name: 'Create Template' }).click()
  await expect(page.getByRole('heading', { name: 'Task Templates' })).toBeVisible()
  await expect(page.getByText('Daily Cleaning Checklist')).toBeVisible()

  // Edit
  await page.getByTitle('Edit').click()
  await expect(page.getByRole('heading', { name: 'Edit Template' })).toBeVisible()
  await page.getByPlaceholder('e.g. Daily Cleaning Checklist').fill('Weekly Cleaning Checklist')
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('Weekly Cleaning Checklist')).toBeVisible()

  // Close, then use the template from the New Task modal via the "+" assign flow.
  await page.getByRole('heading', { name: 'Task Templates' }).locator('xpath=ancestor::div[3]').getByRole('button').first().click()
  await openAssignTaskForManagerA(page)
  await page.getByRole('button', { name: 'Use a template…' }).click()
  await page.getByRole('button', { name: 'Weekly Cleaning Checklist' }).click()
  await expect(page.getByPlaceholder('Task title...')).toHaveValue('Clean front desk')
  await page.getByRole('heading', { name: 'Assign Task to Module 2 UI Manager A' }).locator('xpath=ancestor::div[3]').getByRole('button').first().click()

  // Delete
  await page.getByRole('button', { name: 'Template' }).click()
  await page.getByTitle('Delete').click()
  const deleteConfirmHeading = page.getByRole('heading', { name: 'Delete Template' })
  await expect(deleteConfirmHeading).toBeVisible()
  await deleteConfirmHeading.locator('xpath=ancestor::div[2]').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('No task templates yet')).toBeVisible()
})

test('Description textarea supports Tab for bullets and digit+space for numbered list items', async ({ page }) => {
  await signInOwner(page)
  await page.goto('/owner/tasks')

  await openAssignTaskForManagerA(page)

  const description = page.getByPlaceholder('Add more context...')
  await description.click()
  await description.press('Tab')
  await description.type('First step')
  await expect(description).toHaveValue('- First step')

  await description.press('Enter')
  await description.type('1')
  await description.press(' ')
  await description.type('Second step')
  await expect(description).toHaveValue('- First step\n1. Second step')
})

test('Kanban collapses a task with sub-tasks and expands them on click', async ({ page }) => {
  await signInOwner(page)
  await page.goto('/owner/tasks')

  await openAssignTaskForManagerA(page)

  await page.getByPlaceholder('Task title...').fill('Prepare opening')
  await page.getByRole('button', { name: 'Select priority' }).click()
  await page.getByRole('button', { name: 'High' }).click()
  await page.getByRole('button', { name: 'Select deadline' }).click()
  const todayDay = String(new Date().getDate())
  await page.getByRole('button', { name: todayDay, exact: true }).and(page.locator('button:visible')).first().click()
  await page.getByRole('button', { name: 'PM', exact: true }).click()
  await page.getByRole('button', { name: '6:00' }).click()

  await page.getByText('Sub Task', { exact: true }).click()
  const subTaskDraft = page.getByPlaceholder('Sub-task title...')
  await subTaskDraft.fill('Unlock doors')
  await subTaskDraft.press('Enter')
  await subTaskDraft.fill('Turn on lights')
  await subTaskDraft.press('Enter')
  await page.getByRole('button', { name: 'Create Task' }).click()
  await expect(page.getByText('Prepare opening')).toBeVisible({ timeout: 15000 })

  const parentCard = page.locator('.task-card').filter({ hasText: 'Prepare opening' })
  await expect(parentCard).toBeVisible()
  // Sub-tasks start collapsed: not visible as their own cards yet.
  await expect(page.getByText('Unlock doors')).not.toBeVisible()
  await expect(page.getByText('Turn on lights')).not.toBeVisible()

  // The sub-task count badge (not the card body, which opens the read-only Details panel)
  // is what toggles the expand/collapse state.
  const expandToggle = parentCard.getByRole('button', { name: '2' })
  await expandToggle.click()
  await expect(page.getByText('Unlock doors')).toBeVisible()
  await expect(page.getByText('Turn on lights')).toBeVisible()

  await expandToggle.click()
  await expect(page.getByText('Unlock doors')).not.toBeVisible()
  await expect(page.getByText('Turn on lights')).not.toBeVisible()
})

test('Recurring replaces the top Deadline field with a Deadline rule picker', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 2000 })
  await signInOwner(page)
  await page.goto('/owner/tasks')

  await openAssignTaskForManagerA(page)

  await expect(page.getByRole('button', { name: 'Select deadline' })).toBeVisible()
  await page.getByText('Recurring', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'Select deadline' })).toHaveCount(0)

  await page.locator('label', { hasText: 'Repeats' }).getByRole('button').click()
  await page.getByRole('button', { name: 'Daily', exact: true }).click()
  await expect(page.getByText('Repeat until')).toBeVisible()
  await page.locator('label', { hasText: 'Repeat until' }).getByRole('button').click()
  const repeatUntilDate = new Date()
  repeatUntilDate.setDate(repeatUntilDate.getDate() + 1)
  await page.getByRole('button', { name: String(repeatUntilDate.getDate()), exact: true }).and(page.locator('button:visible')).first().click()

  // Deadline rule: Fixed day is only offered for weekly recurrence.
  await page.locator('label', { hasText: 'Deadline rule' }).getByRole('button').click()
  await expect(page.getByRole('button', { name: 'Fixed day' })).toHaveCount(0)

  // Same day rule
  await page.getByRole('button', { name: 'Same day', exact: true }).click()
  await page.locator('label', { hasText: 'Due at' }).getByRole('button').click()
  await page.getByRole('button', { name: '9:00 PM', exact: true }).click()

  await page.getByPlaceholder('Task title...').fill('Daily cleaning checklist')
  await page.getByRole('button', { name: 'Select priority' }).click()
  await page.getByRole('button', { name: 'High' }).click()

  await page.getByRole('button', { name: 'Create Task' }).click()
  await expect(page.getByText('Daily cleaning checklist')).toBeVisible({ timeout: 15000 })
})

test('Edit Task defers sub-task changes until Save Changes and Recurring starts unselected', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 2000 })
  await signInOwner(page)
  await page.goto('/owner/tasks')

  await openAssignTaskForManagerA(page)
  await page.getByPlaceholder('Task title...').fill('Edit panel sub-task test')
  await page.getByRole('button', { name: 'Select priority' }).click()
  await page.getByRole('button', { name: 'High' }).click()
  await page.getByRole('button', { name: 'Select deadline' }).click()
  const todayDay = String(new Date().getDate())
  await page.getByRole('button', { name: todayDay, exact: true }).and(page.locator('button:visible')).first().click()
  await page.getByRole('button', { name: 'PM', exact: true }).click()
  await page.getByRole('button', { name: '6:00' }).click()
  await page.getByRole('button', { name: 'Create Task' }).click()
  await expect(page.getByText('Edit panel sub-task test')).toBeVisible({ timeout: 15000 })

  // Open the pencil-icon Edit Task form (not the read-only Details panel).
  const card = page.locator('.task-card').filter({ has: page.getByText('Edit panel sub-task test', { exact: true }) })
  await card.getByRole('button').first().click()
  await expect(page.getByRole('heading', { name: 'Edit Task' })).toBeVisible()

  // Recurring must start unchecked/unselected — not defaulted to Weekly + an end date.
  const recurringToggle = page.getByText('Recurring', { exact: true }).locator('..').getByRole('checkbox')
  await expect(recurringToggle).not.toBeChecked()

  // Adding a sub-task here must not hit the server immediately (no success toast, no
  // immediate persistence) — it should stay a local draft until Save Changes is clicked.
  await page.getByText('Sub Task', { exact: true }).click()
  const subTaskDraft = page.getByPlaceholder('Sub-task title...')
  await subTaskDraft.fill('Draft sub-task')
  await subTaskDraft.press('Enter')
  await page.locator('label', { hasText: 'Sub Task' }).locator('xpath=..').getByRole('button').click()
  await expect(page.getByText('Draft sub-task')).toBeVisible()
  await expect(page.getByText('Sub-task created successfully.')).toHaveCount(0)

  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('Task updated successfully.')).toBeVisible()

  // Confirm the sub-task was actually persisted: the parent card now shows a sub-task
  // count badge, and expanding it reveals the sub-task as its own card.
  await card.getByRole('button', { name: '1' }).click()
  await expect(page.getByText('Draft sub-task')).toBeVisible()
})
