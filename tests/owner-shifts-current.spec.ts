import { test, expect, Page, Route } from '@playwright/test'

// ─── fixtures ────────────────────────────────────────────────────────────────

const OWNER = { email: 'owner@testing.com', password: 'Test123!' }
const AUTH_USER_ID = 'auth-owner-1'
const OWNER_USER = {
  id: 'owner-internal-1',
  full_name: 'Owner Test',
  role: 'Owner',
  company_id: 'company-1',
}

const departments = [
  { id: 'dept-ops', name: 'Operations', company_id: 'company-1' },
  { id: 'dept-sales', name: 'Sales', company_id: 'company-1' },
]

const members = [
  { id: 'manager-1', full_name: 'Morgan Manager', role: 'Manager', department_id: 'dept-ops', company_id: 'company-1' },
  { id: 'employee-1', full_name: 'Alice Employee', role: 'Employee', department_id: 'dept-ops', company_id: 'company-1' },
  { id: 'employee-2', full_name: 'Bob Employee', role: 'Employee', department_id: 'dept-ops', company_id: 'company-1' },
  { id: 'employee-3', full_name: 'Cara Sales', role: 'Employee', department_id: 'dept-sales', company_id: 'company-1' },
]

function dateKey(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const TODAY = dateKey(0)
const TOMORROW = dateKey(1)

function shiftRows(forDate: string) {
  const aliceHasShift = [TODAY, TOMORROW].includes(forDate)
  return [
    {
      user_id: 'manager-1', full_name: 'Morgan Manager', role: 'Manager',
      department_id: 'dept-ops', department_name: 'Operations', shifts: [],
    },
    {
      user_id: 'employee-1', full_name: 'Alice Employee', role: 'Employee',
      department_id: 'dept-ops', department_name: 'Operations',
      shifts: aliceHasShift ? [{
        id: 'shift-alice-1', assignment_id: 'asgn-alice-1',
        shift_date: forDate, start_time: '09:00', end_time: '17:00',
        title: '', instruction: null, department_id: 'dept-ops', department_name: 'Operations',
        status: 'active', publication_status: 'published',
        acceptance_deadline_at: null, recurrence_group_id: null, recurrence_rule: null,
        assignment_status: 'assigned',
      }] : [],
    },
    {
      user_id: 'employee-2', full_name: 'Bob Employee', role: 'Employee',
      department_id: 'dept-ops', department_name: 'Operations', shifts: [],
    },
    {
      user_id: 'employee-3', full_name: 'Cara Sales', role: 'Employee',
      department_id: 'dept-sales', department_name: 'Sales', shifts: [],
    },
  ]
}

async function fulfillJson(route: Route, payload: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) })
}

async function loginAsOwner(page: Page) {
  await page.goto('/signin')
  await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first().fill(OWNER.email)
  await page.locator('input[type="password"], input[name="password"]').first().fill(OWNER.password)
  await page.locator('button[type="submit"], button:has-text("Sign In")').first().click()
  await page.waitForURL(/\/owner\/dashboard/, { timeout: 15000 })
}

async function mockShiftsPage(page: Page) {
  await page.addInitScript((uid) => {
    window.localStorage.setItem('tasking_user_id', uid)
    window.localStorage.setItem(`tasking_company_id_${uid}`, 'company-1')
  }, AUTH_USER_ID)

  await page.route('**/api/user/me**', r => fulfillJson(r, { success: true, user: OWNER_USER }))
  await page.route('**/api/company/current**', r => fulfillJson(r, {
    success: true, role: 'Owner',
    company: { id: 'company-1', name: 'Tasking Co', plan: 'Paid' },
    companies: [{ id: 'company-1', name: 'Tasking Co', plan: 'Paid' }],
  }))
  await page.route('**/api/company/departments**', r => fulfillJson(r, { success: true, departments }))
  await page.route('**/api/team/members**', r => fulfillJson(r, { success: true, members }))
  await page.route('**/api/team/department-manager**', r => fulfillJson(r, {
    success: true,
    assignments: [{ department_id: 'dept-ops', manager_id: 'manager-1', manager_name: 'Morgan Manager' }],
  }))
  await page.route('**/api/inbox/unread-count**', r => fulfillJson(r, { success: true, unread_messages: 0 }))
  await page.route('**/api/inbox/announcements**', r => fulfillJson(r, { success: true, announcements: [] }))

  // Intercept timeline GET; let mutations (POST/PATCH/DELETE) fall through to per-test handlers
  await page.route('**/api/shift**', async route => {
    if (route.request().method() === 'GET') {
      const url = route.request().url()
      const match = url.match(/date_from=(\d{4}-\d{2}-\d{2})/)
      const forDate = match ? match[1] : TODAY
      await fulfillJson(route, { success: true, rows: shiftRows(forDate) })
    } else {
      await route.continue()
    }
  })
}

// ─── Page structure ───────────────────────────────────────────────────────────

test.describe('Owner Shifts — page structure', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
    await mockShiftsPage(page)
    await page.goto('/owner/shifts')
    await expect(page.getByRole('heading', { name: /Shift Planning/ })).toBeVisible()
  })

  test('shows Departments panel and Shift Timeline side-by-side', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Departments' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Shift Timeline' })).toBeVisible()
  })

  test('department cards show manager name and employee count', async ({ page }) => {
    const opsCard = page.locator('article').filter({ hasText: 'Operations' }).first()
    await expect(opsCard).toBeVisible()
    await expect(opsCard.getByText('Morgan Manager')).toBeVisible()
    // 2 employees in dept-ops
    await expect(opsCard.getByText('2', { exact: true })).toBeVisible()
  })

  test('department ellipsis menu shows Edit, Set manager, Delete', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Operations actions' }).click()
    await expect(page.getByRole('button', { name: 'Edit department' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Set manager' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible()
    // Clicking elsewhere closes the menu
    await page.getByRole('heading', { name: 'Shift Timeline' }).click()
    await expect(page.getByRole('button', { name: 'Edit department' })).toHaveCount(0)
  })

  test('Add Department modal has Manual and Import tabs', async ({ page }) => {
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Add Department' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Manual' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Import' })).toBeVisible()
    // Import tab reveals file input
    await page.getByRole('button', { name: 'Import' }).click()
    await expect(page.locator('input[type="file"]')).toBeVisible()
  })

  test('plan badge opens popover with plan details', async ({ page }) => {
    await page.getByLabel('Pro plan').click()
    await expect(page.getByText('Current Plan')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Downgrade to Free' })).toBeVisible()
  })
})

// ─── Department drill-down ────────────────────────────────────────────────────

test.describe('Owner Shifts — department drill-down', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
    await mockShiftsPage(page)
    await page.goto('/owner/shifts')
    await expect(page.getByRole('heading', { name: 'Departments' })).toBeVisible()
    // Click card body (not the ellipsis button) to drill in
    await page.locator('article').filter({ hasText: 'Operations' }).first().click()
    await expect(page.getByRole('button', { name: /All Departments/ })).toBeVisible()
  })

  test('shows all members and Send message button for manager only', async ({ page }) => {
    await expect(page.getByText('Morgan Manager').first()).toBeVisible()
    await expect(page.getByText('Alice Employee').first()).toBeVisible()
    await expect(page.getByText('Bob Employee').first()).toBeVisible()
    // Manager row has message button; employee rows show role text instead
    await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible()
  })

  test('individual Assign button opens single-person Assign drawer', async ({ page }) => {
    // Managers are listed first; first "Assign" = Morgan Manager
    await page.getByRole('button', { name: 'Assign', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Assign — Morgan Manager' })).toBeVisible()
  })

  test('Schedule shifts (batch) drawer — people, dates, submit', async ({ page }) => {
    let bulkPayload: Record<string, unknown> | null = null
    await page.route('**/api/shift/bulk', async route => {
      bulkPayload = await route.request().postDataJSON()
      await fulfillJson(route, {
        success: true,
        result: { created: [{ id: 'new-1' }, { id: 'new-2' }], failed: [] },
      }, 201)
    })

    await page.getByRole('button', { name: 'Schedule shifts' }).click()
    // Drawer heading = department name when no single member
    await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible()

    // Step 1: select people
    await page.getByRole('button', { name: /Alice Employee/ }).click()
    await page.getByRole('button', { name: /Bob Employee/ }).click()

    // Step 2: pick two dates
    const dateBtns = page.locator('button').filter({ hasText: /^\d{1,2}$/ })
    await dateBtns.first().click()
    await dateBtns.nth(1).click()

    // Preview counter appears
    await expect(page.getByText(/\d+ shift/i)).toBeVisible()

    // Step 3: submit
    await page.getByRole('button', { name: /^Assign \d+ Shift/i }).click()
    await expect.poll(() => bulkPayload, { timeout: 5000 }).not.toBeNull()

    const p = bulkPayload as Record<string, unknown>
    expect(p.company_id).toBe('company-1')
    expect(p.department_id).toBe('dept-ops')
    expect((p.assignments as unknown[]).length).toBeGreaterThan(0)
  })

  test('back button returns to all-departments view', async ({ page }) => {
    await page.getByRole('button', { name: /All Departments/ }).click()
    await expect(page.locator('article').filter({ hasText: 'Operations' }).first()).toBeVisible()
    await expect(page.locator('article').filter({ hasText: 'Sales' }).first()).toBeVisible()
  })
})

// ─── Shift Timeline ───────────────────────────────────────────────────────────

test.describe('Owner Shifts — Shift Timeline', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
    await mockShiftsPage(page)
    await page.goto('/owner/shifts')
    await expect(page.getByRole('heading', { name: 'Shift Timeline' })).toBeVisible()
    await page.getByRole('button', { name: 'Today', exact: true }).click()
  })

  test('Today button is visible and clicking it refreshes the view', async ({ page }) => {
    const todayBtn = page.getByRole('button', { name: 'Today', exact: true })
    await expect(todayBtn).toBeVisible()
    await todayBtn.click()
    await expect(page.getByRole('heading', { name: 'Shift Timeline' })).toBeVisible()
  })

  test('timeline ellipsis menu shows time window presets and controls', async ({ page }) => {
    await page.getByTestId('shift-timeline-menu').click()
    await expect(page.getByText('Time window')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Auto-fit' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Full day' })).toBeVisible()
  })

  test("Alice Employee's shift block is visible today (09:00–17:00 = 9am–5pm)", async ({ page }) => {
    // title attribute = "Alice Employee 9am–5pm"; text content = "9am – 5pm"
    const shiftBlock = page.locator('button[title="Alice Employee 9am–5pm"]')
    await expect(shiftBlock).toBeVisible()
    await expect(shiftBlock.getByText('9am – 5pm')).toBeVisible()
  })

  test('clicking OFF bar opens single-person Assign drawer for that person', async ({ page }) => {
    // OFF bar button: text = "Off", title = "Assign shift to Bob Employee"
    const offBar = page.locator('button[title="Assign shift to Bob Employee"]')
    await expect(offBar).toBeVisible()
    await offBar.click()
    await expect(page.getByRole('heading', { name: 'Assign — Bob Employee' })).toBeVisible()
  })

  test('clicking a shift block opens Edit Shift modal with all fields', async ({ page }) => {
    await page.locator('button[title="Alice Employee 9am–5pm"]').click()

    await expect(page.getByRole('heading', { name: 'Edit Shift' })).toBeVisible()
    await expect(page.getByText('Reassign to')).toBeVisible()
    await expect(page.getByText('Date')).toBeVisible()
    await expect(page.getByText('Start')).toBeVisible()
    await expect(page.getByText('End')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Edit Shift' })).toHaveCount(0)
  })

  test('Edit Shift Delete fires DELETE /api/shift/:id and closes modal', async ({ page }) => {
    let deletedUrl = ''
    await page.route('**/api/shift/shift-alice-1**', async route => {
      if (route.request().method() === 'DELETE') {
        deletedUrl = route.request().url()
        await fulfillJson(route, { success: true })
      } else {
        await route.continue()
      }
    })

    await page.locator('button[title="Alice Employee 9am–5pm"]').click()
    await expect(page.getByRole('heading', { name: 'Edit Shift' })).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect.poll(() => deletedUrl, { timeout: 5000 }).toContain('/api/shift/shift-alice-1')
    await expect(page.getByRole('heading', { name: 'Edit Shift' })).toHaveCount(0)
  })
})

// ─── Timeline row checkboxes ──────────────────────────────────────────────────

test.describe('Owner Shifts — timeline row checkboxes', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
    await mockShiftsPage(page)
    await page.goto('/owner/shifts')
    await expect(page.getByRole('heading', { name: 'Shift Timeline' })).toBeVisible()
    await page.getByRole('button', { name: 'Today', exact: true }).click()
  })

  test('each row has a checkbox with labelled aria-label', async ({ page }) => {
    await expect(
      page.locator('input[type="checkbox"][aria-label="Select Bob Employee for deletion"]'),
    ).toBeVisible()
    await expect(
      page.locator('input[type="checkbox"][aria-label="Select Alice Employee for deletion"]'),
    ).toBeVisible()
  })

  test('checking a row replaces Today with Cancel + Delete buttons', async ({ page }) => {
    const todayBtn = page.getByRole('button', { name: 'Today', exact: true })
    await expect(todayBtn).toBeVisible()

    await page.locator('input[type="checkbox"][aria-label="Select Bob Employee for deletion"]').check()

    // Today button is gone; Cancel and Delete appear instead
    await expect(todayBtn).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Cancel timeline selection' })).toBeVisible()
    await expect(
      page.locator('button[aria-label^="Delete shifts for"]'),
    ).toBeVisible()
  })

  test('Cancel button restores Today button', async ({ page }) => {
    await page.locator('input[type="checkbox"][aria-label="Select Bob Employee for deletion"]').check()
    await expect(page.getByRole('button', { name: 'Cancel timeline selection' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel timeline selection' }).click()
    await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible()
  })
})

// ─── Date picker ─────────────────────────────────────────────────────────────

test.describe('Owner Shifts — date picker', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
    await mockShiftsPage(page)
    await page.goto('/owner/shifts')
    await expect(page.getByRole('heading', { name: 'Shift Timeline' })).toBeVisible()
  })

  test('date trigger shows MM/DD/YYYY label and opens calendar on click', async ({ page }) => {
    // The trigger button shows the current date in MM/DD/YYYY format
    const dateTrigger = page.locator('button').filter({ hasText: /^\d{2}\/\d{2}\/\d{4}$/ }).first()
    await expect(dateTrigger).toBeVisible()
    await dateTrigger.click()
    // Calendar cells (day numbers) become visible in the portal
    await expect(page.locator('button').filter({ hasText: /^\d{1,2}$/ }).first()).toBeVisible()
  })

  test('past dates render as blank divs, not clickable buttons', async ({ page }) => {
    const dateTrigger = page.locator('button').filter({ hasText: /^\d{2}\/\d{2}\/\d{4}$/ }).first()
    await dateTrigger.click()
    await expect(page.locator('button').filter({ hasText: /^\d{1,2}$/ }).first()).toBeVisible()
    // Past dates render as empty divs — there must be no disabled date buttons
    await expect(page.locator('button[disabled]').filter({ hasText: /^\d{1,2}$/ })).toHaveCount(0)
  })
})
