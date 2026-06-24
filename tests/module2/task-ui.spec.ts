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

  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2030-05-10',
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
      task_date: '2030-05-10',
      due_at: '2030-05-10T18:00:00.000Z',
    })
    if (error) throw new Error(`Failed to seed task: ${error.message}`)
  }
})

test.afterAll(async () => {
  await admin.from('tasks').delete().eq('company_id', seeded.companyId)
  await admin.from('shift_assignments').delete().eq('shift_id', shiftId)
  await admin.from('shifts').delete().eq('id', shiftId)
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
  await expect(page.getByRole('button', { name: 'New Task' })).toBeVisible()
  await expect(page.getByText('Prep opening checklist')).toBeVisible()
  await expect(page.getByText('Stock front desk')).toBeVisible()

  await page.getByRole('button', { name: 'New Task' }).click()
  await expect(page.getByRole('heading', { name: 'New Task' })).toBeVisible()
  await page.getByPlaceholder('Task title...').fill('UI created task')
  await page.getByRole('button', { name: 'Select department' }).click()
  await page.getByRole('button', { name: 'Operations' }).last().click()
  await page.getByRole('button', { name: 'Unassigned' }).click()
  await page.getByRole('button', { name: 'Module 2 UI Manager A' }).click()
  await page.getByRole('button', { name: 'Select priority' }).click()
  await page.getByRole('button', { name: 'High' }).click()
  await page.getByRole('button', { name: 'Select deadline' }).click()
  await page.getByRole('button', { name: '10', exact: true }).click()
  await page.getByRole('button', { name: '6:00 PM' }).click()
  await page.getByRole('button', { name: 'Create Task' }).click()
  await expect(page.getByText('UI created task')).toBeVisible({ timeout: 15000 })

  const createdCard = page.locator('.task-card').filter({ hasText: 'UI created task' })
  await createdCard.getByRole('button').first().click()
  await expect(page.getByRole('heading', { name: 'Edit Task' })).toBeVisible()
  await page.getByRole('textbox').first().fill('UI edited task')
  await page.getByRole('button', { name: 'Duplicate' }).click()
  await expect(page.getByText('Task duplicated.')).toBeVisible()
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('UI edited task')).toBeVisible()

  const editedCard = page.locator('.task-card').filter({ hasText: 'UI edited task' }).first()
  await editedCard.getByRole('button').first().click()
  await page.getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByText('Task archived.')).toBeVisible()

  await page.getByRole('button', { name: 'Calendar' }).click()
  await expect(page.getByText('Module 2 UI Manager A')).toBeVisible()

  await page.getByRole('button', { name: 'AI Assign' }).first().click()
  await expect(page.getByRole('heading', { name: 'AI Assign' })).toBeVisible()
})
