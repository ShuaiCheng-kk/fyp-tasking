import { test, expect } from '@playwright/test'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'
import {
  createDepartment, createCompanyMember, cleanupCompanyMember, createShiftRow, signInAs, ownerCreds, memberCreds, setCompanyPlan, SeededMember,
} from './shift-e2e-helpers'

test.describe.configure({ mode: 'serial' })

function todayDateKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

test('UC6-A1-E2E-O: for the Owner, the Duplicate Shift window shows everyone is already busy when the sole staff member already has a shift that day', async ({ page }) => {
  const seeded = await seedTestOwnerAndCompany('uc6e2eO')
  await setCompanyPlan(seeded.companyId, 'Paid')
  const departmentId = await createDepartment(seeded.companyId, 'UC6 E2E Department O')
  const employee = await createCompanyMember({ companyId: seeded.companyId, departmentId, role: 'Employee', label: 'employee-uc6o' })
  await createShiftRow({
    companyId: seeded.companyId, departmentId, userId: employee.userId,
    shift_date: todayDateKey(), start_time: '09:00', end_time: '17:00',
  })

  await signInAs(page, 'Owner', ownerCreds(seeded))
  await page.goto('/owner/shifts')
  await page.locator('.shift-dept-card').filter({ hasText: 'UC6 E2E Department O' }).click()
  await page.locator('.shift-bar').first().click()
  await page.getByRole('button', { name: 'Duplicate' }).click()

  await expect(page.getByText('Everyone already has a shift or an approved day off on this date.')).toBeVisible()

  await cleanupCompanyMember(employee)
  await cleanupTestOwnerAndCompany(seeded)
})

test('UC6-A1-E2E-P: for the Partner, the Duplicate Shift window shows everyone is already busy when the sole staff member already has a shift that day', async ({ page }) => {
  const seeded = await seedTestOwnerAndCompany('uc6e2eP')
  await setCompanyPlan(seeded.companyId, 'Paid')
  const departmentId = await createDepartment(seeded.companyId, 'UC6 E2E Department P')
  const partner = await createCompanyMember({ companyId: seeded.companyId, role: 'Partner', label: 'partner-uc6p' })
  const employee = await createCompanyMember({ companyId: seeded.companyId, departmentId, role: 'Employee', label: 'employee-uc6p' })
  await createShiftRow({
    companyId: seeded.companyId, departmentId, userId: employee.userId,
    shift_date: todayDateKey(), start_time: '09:00', end_time: '17:00',
  })

  await signInAs(page, 'Partner', memberCreds(partner, seeded.companyId))
  await page.goto('/partner/shifts')
  await page.locator('.shift-dept-card').filter({ hasText: 'UC6 E2E Department P' }).click()
  await page.locator('.shift-bar').first().click()
  await page.getByRole('button', { name: 'Duplicate' }).click()

  await expect(page.getByText('Everyone already has a shift or an approved day off on this date.')).toBeVisible()

  await cleanupCompanyMember(partner)
  await cleanupCompanyMember(employee)
  await cleanupTestOwnerAndCompany(seeded)
})
