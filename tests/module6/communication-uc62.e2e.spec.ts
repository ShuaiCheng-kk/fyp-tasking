import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'
import { createDepartment, createCompanyMember, cleanupCompanyMember, signInAs, memberCreds, SeededMember } from '../module1/shift-e2e-helpers'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

test.describe.configure({ mode: 'serial' })

let seeded: TestOwner
let departmentId: string
let manager: SeededMember

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('uc62e2e')
  departmentId = await createDepartment(seeded.companyId, 'UC62 E2E Department')
  manager = await createCompanyMember({ companyId: seeded.companyId, departmentId, role: 'Manager', label: 'manager-uc62' })

  // Give the Manager a shift yesterday and clock them fully in-and-out of it, so
  // useEmployeeClockedOut's "most recently-started shift already clocked out" rule locks them.
  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId, department_id: departmentId,
      shift_date: '2026-08-01', start_time: '09:00', end_time: '17:00',
      publication_status: 'published', created_by: manager.userId,
    })
    .select('id')
    .single()
  if (shiftError || !shift) throw new Error(`Failed to create shift: ${shiftError?.message}`)

  const { data: assignment, error: assignError } = await admin
    .from('shift_assignments')
    .insert({ shift_id: shift.id, user_id: manager.userId, assigned_by: manager.userId })
    .select('id')
    .single()
  if (assignError || !assignment) throw new Error(`Failed to create shift assignment: ${assignError?.message}`)

  const { error: attendanceError } = await admin.from('attendance_records').insert({
    shift_assignment_id: assignment.id, user_id: manager.userId,
    clock_in_time: '2026-08-01T01:00:00.000Z', clock_out_time: '2026-08-01T09:00:00.000Z',
  })
  if (attendanceError) throw new Error(`Failed to create attendance record: ${attendanceError.message}`)
})

test.afterAll(async () => {
  await cleanupCompanyMember(manager)
  await cleanupTestOwnerAndCompany(seeded)
})

test('UC62-A1-E2E-M: A Manager who is currently clocked out has the Post announcement button disabled', async ({ page }) => {
  await signInAs(page, 'Manager', memberCreds(manager, seeded.companyId))
  await page.goto('/manager/communication')
  await page.getByRole('button', { name: 'Announcements' }).click()

  const postButton = page.getByTitle("You've clocked out — posting is locked")
  await expect(postButton).toBeVisible()
  await expect(postButton).toBeDisabled()
})
