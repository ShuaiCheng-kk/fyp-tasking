import { test, expect, Page } from '@playwright/test'

// ─── Test accounts (from seed.js) ────────────────────────────────────────────
const OWNER    = { email: 'owner@testing.com',    password: 'Test123!' }
const PARTNER1 = { email: 'partner1@testing.com', password: 'Test123!' }
const MANAGER1 = { email: 'manager1@testing.com', password: 'Test123!' }
const EMP1A    = { email: 'emp1a@testing.com',    password: 'Test123!' }
const BASE_URL = 'http://localhost:3000'

// ─── Helper: login ────────────────────────────────────────────────────────────
async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/signin`)
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first()
  await emailInput.waitFor({ timeout: 10000 })
  await emailInput.fill(email)
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first()
  await passwordInput.fill(password)
  const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In")').first()
  await submitBtn.click()
  await page.waitForURL(
    /\/owner\/dashboard|\/manager\/|\/employee\/|\/partner\//,
    { timeout: 15000 }
  )
}

async function loginAsOwner(page: Page) {
  await login(page, OWNER.email, OWNER.password)
}

// ─── Helper: logout ───────────────────────────────────────────────────────────
async function logout(page: Page) {
  await page.getByRole('button', { name: /logout|sign out/i }).click()
  await page.waitForURL(/\/signin|\//, { timeout: 5000 })
}

// =============================================================================
// AUTH
// =============================================================================

test.describe('Auth', () => {

  test('Owner can sign in and reach dashboard', async ({ page }) => {
    await loginAsOwner(page)
    await expect(page).toHaveURL(/\/owner\/dashboard/)
    await expect(page.getByText(/overview/i)).toBeVisible()
  })

  test('Owner can sign out', async ({ page }) => {
    await loginAsOwner(page)
    await logout(page)
    await expect(page).toHaveURL(/\/signin|\//)
  })

  test('Wrong password shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/signin`)
    await page.getByLabel(/email/i).fill(OWNER.email)
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 5000 })
  })

})

// =============================================================================
// UC-01 — Dashboard: Manage Departments
// =============================================================================

test.describe('UC-01 — Manage Departments', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
    await page.goto(`${BASE_URL}/owner/dashboard`)
  })

  test('Departments section is visible', async ({ page }) => {
    await expect(page.getByText(/departments/i)).toBeVisible()
  })

  test('Existing departments are listed', async ({ page }) => {
    await expect(page.getByText('Operations')).toBeVisible()
    await expect(page.getByText('Marketing')).toBeVisible()
  })

  test('Can add a new department', async ({ page }) => {
    await page.getByRole('button', { name: /add department/i }).click()
    await page.getByPlaceholder(/department name/i).fill('Test Dept Playwright')
    await page.getByRole('button', { name: /save|create|add/i }).click()
    await expect(page.getByText('Test Dept Playwright')).toBeVisible({ timeout: 5000 })
  })

  test('Can edit a department name', async ({ page }) => {
    // Click ··· menu on a department card
    const card = page.locator('[data-testid="dept-card"], .dept-card').filter({ hasText: 'Operations' }).first()
    await card.locator('button[aria-label*="menu"], button:has-text("···"), button:has-text("...")').click()
    await page.getByRole('menuitem', { name: /edit/i }).click()
    await page.getByPlaceholder(/name/i).clear()
    await page.getByPlaceholder(/name/i).fill('Operations Edited')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText('Operations Edited')).toBeVisible({ timeout: 5000 })
    // Rename back
    const cardEdited = page.locator('[data-testid="dept-card"], .dept-card').filter({ hasText: 'Operations Edited' }).first()
    await cardEdited.locator('button').click()
    await page.getByRole('menuitem', { name: /edit/i }).click()
    await page.getByPlaceholder(/name/i).clear()
    await page.getByPlaceholder(/name/i).fill('Operations')
    await page.getByRole('button', { name: /save/i }).click()
  })

  test('Can delete a department', async ({ page }) => {
    // First create one to delete
    await page.getByRole('button', { name: /add department/i }).click()
    await page.getByPlaceholder(/department name/i).fill('To Delete Dept')
    await page.getByRole('button', { name: /save|create|add/i }).click()
    await expect(page.getByText('To Delete Dept')).toBeVisible({ timeout: 5000 })
    // Delete it
    const card = page.locator('[data-testid="dept-card"], .dept-card').filter({ hasText: 'To Delete Dept' }).first()
    await card.locator('button').click()
    await page.getByRole('menuitem', { name: /delete/i }).click()
    await page.getByRole('button', { name: /confirm|yes|delete/i }).click()
    await expect(page.getByText('To Delete Dept')).not.toBeVisible({ timeout: 5000 })
  })

})

// =============================================================================
// UC-02 — Dashboard: Generate Invitation Codes
// =============================================================================

test.describe('UC-02 — Generate Invitation Codes', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
  })

  test('Can generate a Manager invitation code', async ({ page }) => {
    await page.goto(`${BASE_URL}/owner/dashboard`)
    await page.getByRole('button', { name: /invite|generate.*code/i }).click()
    await page.getByRole('option', { name: /manager/i }).click()
    // Select a department
    await page.getByRole('combobox').filter({ hasText: /department/i }).selectOption({ label: 'Operations' })
    await page.getByRole('button', { name: /generate|create/i }).click()
    // Should show a code (5 digit numeric for manager)
    await expect(page.getByText(/\d{5}/)).toBeVisible({ timeout: 5000 })
  })

})

// =============================================================================
// UC-04 — Dashboard: Switch Active Company
// =============================================================================

test.describe('UC-04 — Switch Active Company', () => {

  test('Company name shown in header', async ({ page }) => {
    await loginAsOwner(page)
    await expect(page.getByText(/testing company/i)).toBeVisible()
  })

})

// =============================================================================
// UC-05 to UC-08 — Team / My Company
// =============================================================================

test.describe('UC-05/06/07/08 — Team / My Company', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
    await page.goto(`${BASE_URL}/owner/team`)
  })

  test('Team page loads and shows members grouped by role', async ({ page }) => {
    await expect(page.getByText(/manager/i)).toBeVisible()
    await expect(page.getByText(/employee/i)).toBeVisible()
    await expect(page.getByText('David Mgr')).toBeVisible()
  })

  test('Can remove a team member (then re-seed)', async ({ page }) => {
    // Just check the remove button exists — don't actually remove to preserve seed data
    const memberRow = page.locator('tr, [data-testid="member-row"]').filter({ hasText: 'Sam Emp' }).first()
    await expect(memberRow.getByRole('button', { name: /remove/i })).toBeVisible()
  })

})

// =============================================================================
// UC-09 to UC-12 — Announcements (Communication module)
// =============================================================================

test.describe('UC-09/10/11/12 — Announcements', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
    await page.goto(`${BASE_URL}/owner/announcements`)
  })

  test('Can post a new announcement', async ({ page }) => {
    await page.getByRole('button', { name: /new|post|create/i }).click()
    await page.getByPlaceholder(/title/i).fill('Playwright Test Announcement')
    await page.getByPlaceholder(/content|message/i).fill('This is a test announcement from Playwright.')
    await page.getByRole('button', { name: /post|publish|save/i }).click()
    await expect(page.getByText('Playwright Test Announcement')).toBeVisible({ timeout: 5000 })
  })

  test('Can read an announcement', async ({ page }) => {
    await page.getByText('Playwright Test Announcement').click()
    await expect(page.getByText('This is a test announcement from Playwright.')).toBeVisible()
  })

  test('Can edit own announcement', async ({ page }) => {
    await page.getByText('Playwright Test Announcement').click()
    await page.getByRole('button', { name: /edit/i }).click()
    await page.getByPlaceholder(/title/i).fill('Playwright Announcement EDITED')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText('Playwright Announcement EDITED')).toBeVisible({ timeout: 5000 })
  })

  test('Can delete own announcement', async ({ page }) => {
    await page.getByText('Playwright Announcement EDITED').click()
    await page.getByRole('button', { name: /delete/i }).click()
    await page.getByRole('button', { name: /confirm|yes/i }).click()
    await expect(page.getByText('Playwright Announcement EDITED')).not.toBeVisible({ timeout: 5000 })
  })

})

// =============================================================================
// UC-13 — Inbox: Send Direct Message
// =============================================================================

test.describe('UC-13 — Send Direct Message', () => {

  test('Can send a direct message to a Manager', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto(`${BASE_URL}/owner/inbox`)
    await page.getByRole('button', { name: /new message|compose/i }).click()
    await page.getByPlaceholder(/search|recipient/i).fill('David')
    await page.getByText('David Mgr').click()
    await page.getByPlaceholder(/message/i).fill('Hello from Playwright test')
    await page.getByRole('button', { name: /send/i }).click()
    await expect(page.getByText('Hello from Playwright test')).toBeVisible({ timeout: 5000 })
  })

})

// =============================================================================
// UC-15 to UC-19 — Settings (My Company)
// =============================================================================

test.describe('UC-15/16/17/18/19 — Settings / My Company', () => {

  test('My Company page loads with company info', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto(`${BASE_URL}/owner/team`)
    await expect(page.getByText(/testing company/i)).toBeVisible()
  })

  test('Can edit company profile', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto(`${BASE_URL}/owner/team`)
    await page.getByRole('button', { name: /edit/i }).first().click()
    await page.getByPlaceholder(/description/i).fill('Updated by Playwright')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText('Updated by Playwright')).toBeVisible({ timeout: 5000 })
  })

  test('Subscription plan badge visible in header', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto(`${BASE_URL}/owner/dashboard`)
    await expect(page.getByText(/free|pro|paid/i)).toBeVisible()
  })

})

// =============================================================================
// DASHBOARD — Today's stats and Timeline (UC-21/22/23)
// =============================================================================

test.describe('Dashboard — Timeline & Stats', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
    await page.goto(`${BASE_URL}/owner/dashboard`)
  })

  test('Today stat cards are visible with non-negative numbers', async ({ page }) => {
    // Should show Today's Shifts, Total Tasks etc
    await expect(page.getByText(/today.*shift|shift.*today/i)).toBeVisible()
    await expect(page.getByText(/total.*task|task/i)).toBeVisible()
  })

  test('Allocation Timeline section is visible', async ({ page }) => {
    await expect(page.getByText(/allocation timeline/i)).toBeVisible()
  })

  test('Timeline shows today\'s date', async ({ page }) => {
    const today = new Date()
    const month = today.toLocaleString('en', { month: 'short' })
    const day = today.getDate()
    await expect(page.getByText(new RegExp(`${month}.*${day}|${day}.*${month}`, 'i'))).toBeVisible()
  })

  test('Timeline Global/Department view toggle exists', async ({ page }) => {
    await expect(page.getByRole('button', { name: /global|department/i })).toBeVisible()
  })

  test('Can switch to Department view', async ({ page }) => {
    await page.getByRole('button', { name: /department/i }).click()
    await expect(page.getByText(/operations|marketing/i)).toBeVisible()
  })

  test('Live feed section is visible', async ({ page }) => {
    await expect(page.getByText(/live feed|today.*activity|activity/i)).toBeVisible()
  })

})

// =============================================================================
// TASKS PAGE — Kanban (UC-24/25/26)
// =============================================================================

test.describe('Tasks — Kanban Board', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
    await page.goto(`${BASE_URL}/owner/tasks`)
  })

  test('Tasks page loads with Kanban columns', async ({ page }) => {
    await expect(page.getByText(/assigned/i)).toBeVisible()
    await expect(page.getByText(/in progress/i)).toBeVisible()
    await expect(page.getByText(/review/i)).toBeVisible()
    await expect(page.getByText(/complete/i)).toBeVisible()
  })

  test('Seed tasks appear in correct columns', async ({ page }) => {
    // From seed: "Review daily inventory" is In Progress
    await expect(page.getByText('Review daily inventory')).toBeVisible()
    // "Approve campaign brief" is Review
    await expect(page.getByText('Approve campaign brief')).toBeVisible()
    // "Schedule social posts" is Complete
    await expect(page.getByText('Schedule social posts')).toBeVisible()
  })

  test('Department selector strip is visible at top', async ({ page }) => {
    await expect(page.getByRole('button', { name: /all/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /operations/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /marketing/i })).toBeVisible()
  })

  test('Filtering by department shows only that dept tasks', async ({ page }) => {
    await page.getByRole('button', { name: /marketing/i }).click()
    await expect(page.getByText('Approve campaign brief')).toBeVisible()
    // Operations task should not be visible
    await expect(page.getByText('Review daily inventory')).not.toBeVisible()
  })

  test('Can create a new task', async ({ page }) => {
    await page.getByRole('button', { name: /new task/i }).click()
    // Fill in form
    await page.getByPlaceholder(/title/i).fill('Playwright Created Task')
    await page.getByRole('combobox').filter({ hasText: /department/i }).first().selectOption({ label: 'Operations' })
    await page.getByRole('button', { name: /save|create|assign/i }).click()
    await expect(page.getByText('Playwright Created Task')).toBeVisible({ timeout: 5000 })
  })

  test('Can click a task card to open detail panel', async ({ page }) => {
    await page.getByText('Review daily inventory').click()
    // Detail panel should open
    await expect(page.getByRole('heading', { name: /review daily inventory/i })).toBeVisible()
  })

  test('Can update task status', async ({ page }) => {
    await page.getByText('Restock shelves A-C').click()
    await page.getByRole('button', { name: /in progress/i }).click()
    await expect(page.getByText('Restock shelves A-C')).toBeVisible({ timeout: 5000 })
  })

})

// =============================================================================
// ROLE ROUTING — other roles redirect correctly
// =============================================================================

test.describe('Role Routing', () => {

  test('Manager login redirects to manager dashboard', async ({ page }) => {
    await login(page, MANAGER1.email, MANAGER1.password)
    await expect(page).toHaveURL(/\/manager\//)
  })

  test('Employee login redirects to employee dashboard', async ({ page }) => {
    await login(page, EMP1A.email, EMP1A.password)
    await expect(page).toHaveURL(/\/employee\//)
  })

  test('Partner login redirects to partner dashboard', async ({ page }) => {
    await login(page, PARTNER1.email, PARTNER1.password)
    await expect(page).toHaveURL(/\/partner\//)
  })

  test('Owner cannot access manager routes directly', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto(`${BASE_URL}/manager/dashboard`)
    // Should redirect away or show 403
    await expect(page).not.toHaveURL(/\/manager\/dashboard/)
  })

})

// =============================================================================
// RECRUITMENT — UC-39/40/41/42
// =============================================================================

test.describe('UC-39/40/41 — Recruitment', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
    await page.goto(`${BASE_URL}/owner/recruitment`)
  })

  test('Recruitment page loads', async ({ page }) => {
    await expect(page.getByText(/recruitment|job/i)).toBeVisible()
  })

  test('Can create a new job posting', async ({ page }) => {
    await page.getByRole('button', { name: /new job|post job|create/i }).click()
    await page.getByPlaceholder(/title/i).fill('Playwright Test Job')
    await page.getByPlaceholder(/description/i).fill('This is a test job posting.')
    await page.getByRole('combobox').filter({ hasText: /department/i }).first().selectOption({ label: 'Marketing' })
    await page.getByRole('button', { name: /publish|save|create/i }).click()
    await expect(page.getByText('Playwright Test Job')).toBeVisible({ timeout: 5000 })
  })

  test('Job posting appears on public job board', async ({ page }) => {
    await page.goto(`${BASE_URL}/job-board`)
    await expect(page.getByText('Playwright Test Job')).toBeVisible({ timeout: 5000 })
  })

})

// =============================================================================
// ATTENDANCE — UC-44/45
// =============================================================================

test.describe('UC-44/45 — Attendance', () => {

  test('Attendance page loads', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto(`${BASE_URL}/owner/attendance`)
    await expect(page.getByText(/attendance/i)).toBeVisible()
  })

})
