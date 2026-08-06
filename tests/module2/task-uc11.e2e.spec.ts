import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'
import { createDepartment, createCompanyMember, cleanupCompanyMember, signInAs, memberCreds, SeededMember } from '../module1/shift-e2e-helpers'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function todayDateKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

let seeded: TestOwner
let employee: SeededMember
let casualWorker: SeededMember
let departmentId: string

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('uc11e2e')
  await admin.from('companies').update({ plan: 'Paid' }).eq('id', seeded.companyId)
  departmentId = await createDepartment(seeded.companyId, 'UC11 E2E Department')
  employee = await createCompanyMember({ companyId: seeded.companyId, departmentId, role: 'Employee', label: 'employee-uc11' })
  casualWorker = await createCompanyMember({ companyId: seeded.companyId, role: 'Casual Worker', label: 'cw-uc11' })

  // The Employee's Tasks page only lists a Casual Worker as "supervised today" when a shift
  // today links them via supervisor_employee_id (see taskRepository.getSupervisedCasualWorkerIds).
  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: todayDateKey(),
      start_time: '09:00',
      end_time: '17:00',
      publication_status: 'published',
      created_by: employee.userId,
    })
    .select('id')
    .single()
  if (shiftError || !shift) throw new Error(`Failed to create shift: ${shiftError?.message}`)

  const { error: assignError } = await admin.from('shift_assignments').insert({
    shift_id: shift.id,
    user_id: casualWorker.userId,
    assigned_by: employee.userId,
    supervisor_employee_id: employee.userId,
  })
  if (assignError) throw new Error(`Failed to create shift assignment: ${assignError.message}`)
})

test.afterAll(async () => {
  await cleanupCompanyMember(employee)
  await cleanupCompanyMember(casualWorker)
  await cleanupTestOwnerAndCompany(seeded)
})

test('UC11-A1-E2E-E: Assign Task window is simplified for an Employee, with no Recurring option', async ({ page }) => {
  await signInAs(page, 'Employee', memberCreds(employee, seeded.companyId))
  await page.goto('/employee/tasks')
  await page.locator('.assign-task-btn, [title="Assign Task"]').first().click()

  await expect(page.getByText('Sub Task')).toBeVisible()
  await expect(page.getByText('Recurring')).not.toBeVisible()
})
