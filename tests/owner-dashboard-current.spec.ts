import { test, expect, Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const OWNER = { email: 'owner@testing.com', password: 'Test123!' }

type TaskStats = {
  assigned: number
  inProgress: number
  review: number
  complete: number
  tasks?: Array<{
    id: string
    title: string
    status: string
    priority?: string | null
    assignee_name?: string
    assigned_user_id?: string | null
  }>
}

type TimelineRow = {
  role: string
  full_name: string
  department_id: string
  department_name: string
  shifts: unknown[]
}

type DashboardContext = {
  authUserId: string
  companyId: string
  stats: TaskStats
  timelineRows: TimelineRow[]
  activityFeed: unknown[]
}

async function loginAsOwner(page: Page) {
  await page.goto('/signin')
  await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first().fill(OWNER.email)
  await page.locator('input[type="password"], input[name="password"]').first().fill(OWNER.password)
  await page.locator('button[type="submit"], button:has-text("Sign In")').first().click()
  await page.waitForURL(/\/owner\/dashboard/, { timeout: 15000 })
}

function todayKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function successfulJson(response: Awaited<ReturnType<Page['request']['get']>>) {
  expect(response.ok()).toBeTruthy()
  const data = await response.json()
  expect(data.success).toBeTruthy()
  return data
}

async function loadDashboardContext(page: Page): Promise<DashboardContext> {
  const authUserId = await page.evaluate(() => localStorage.getItem('tasking_user_id'))
  expect(authUserId).toBeTruthy()

  const me = await successfulJson(await page.request.get(`/api/user/me?user_id=${authUserId}`))
  const companyId = await page.evaluate((uid) => {
    return localStorage.getItem(`tasking_company_id_${uid}`) || localStorage.getItem('tasking_company_id')
  }, authUserId)
  const resolvedCompanyId = companyId || me.user.company_id
  expect(resolvedCompanyId).toBeTruthy()

  const today = todayKey()
  const [statsData, timelineData, feedData] = await Promise.all([
    successfulJson(await page.request.get(`/api/task?company_id=${resolvedCompanyId}&stats=true`)),
    successfulJson(await page.request.get(`/api/shift?company_id=${resolvedCompanyId}&date_from=${today}&date_to=${today}`)),
    successfulJson(await page.request.get(`/api/task?company_id=${resolvedCompanyId}&activity_feed=true`)),
  ])

  return {
    authUserId: authUserId!,
    companyId: resolvedCompanyId,
    stats: statsData.stats,
    timelineRows: timelineData.rows ?? [],
    activityFeed: feedData.feed ?? [],
  }
}

async function expectStatCard(page: Page, label: string, expectedValue: number) {
  const card = page.locator('main article').filter({ hasText: label }).first()
  await expect(card).toBeVisible()
  await expect.poll(async () => {
    const text = await card.textContent()
    return Number((text ?? '').match(/\d[\d,]*/)?.[0]?.replace(/,/g, '') ?? Number.NaN)
  }, { timeout: 3000 }).toBe(expectedValue)
}

test.describe('Owner Dashboard current UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
    await expect(page.getByText(/overview/i)).toBeVisible()
  })

  test('shows the current dashboard shell and summary data from live APIs', async ({ page }) => {
    const ctx = await loadDashboardContext(page)
    const todayActiveStaff = ctx.timelineRows.filter(row => !['Owner', 'Partner'].includes(row.role) && row.shifts.length > 0)
    const todayCasualWorkers = todayActiveStaff.filter(row => row.role === 'Casual Worker').length
    const totalTasks = ctx.stats.assigned + ctx.stats.inProgress + ctx.stats.review + ctx.stats.complete

    await expectStatCard(page, 'Staff on Shift', todayActiveStaff.length)
    await expectStatCard(page, 'Casual Workers', todayCasualWorkers)
    await expectStatCard(page, 'Total Tasks', totalTasks)
    await expectStatCard(page, 'Tasks In Progress', ctx.stats.inProgress)
    await expectStatCard(page, 'Tasks In Review', ctx.stats.review)
    await expectStatCard(page, 'Tasks Complete', ctx.stats.complete)

    await expect(page.getByText('Schedule', { exact: true })).toBeVisible()
    await expect(page.getByText('Focus', { exact: true })).toBeVisible()
    await expect(page.getByRole('main').getByText('Team', { exact: true })).toBeVisible()
    await expect(page.getByTestId('live-feed')).toBeVisible()
    await expect(page.getByRole('main').getByText('Tasks', { exact: true })).toBeVisible()
  })

  test('schedule menu works with the current all-departments and by-department views', async ({ page }) => {
    const ctx = await loadDashboardContext(page)
    const departmentIds = [...new Set(ctx.timelineRows.filter(row => row.shifts.length > 0).map(row => row.department_id))]

    await page.getByTestId('timeline-menu').click()
    await expect(page.getByText('Timeline view')).toBeVisible()
    await expect(page.getByText('All departments', { exact: true })).toBeVisible()
    await expect(page.getByText('By department', { exact: true })).toBeVisible()
    await expect(page.getByText('Time window')).toBeVisible()

    await page.getByText('By department', { exact: true }).click()
    if (departmentIds.length > 0) {
      await expect(page.getByTestId('dept-timeline-card').first()).toBeVisible()
    } else {
      await expect(page.getByText('No departments with shifts today')).toBeVisible()
    }
  })

  test('focus, team, feed, and task panels match available dashboard data', async ({ page }) => {
    const ctx = await loadDashboardContext(page)
    const mediumLowTasks = (ctx.stats.tasks ?? []).filter(task => task.priority === 'Medium' || task.priority === 'Low')
    const activeRows = ctx.timelineRows.filter(row => row.shifts.length > 0)

    const focusPanel = page.getByRole('main').locator('div').filter({ hasText: /^Focus/ }).first()
    await expect(focusPanel).toBeVisible()
    await expect(focusPanel.getByText(/tasks|No urgent or high priority tasks/).first()).toBeVisible()

    if (activeRows.length === 0) {
      await expect(page.getByText('No one is on shift today')).toBeVisible()
    } else {
      await expect(page.getByTestId('team-member-row').first()).toBeVisible()
    }

    if (ctx.activityFeed.length === 0) {
      await expect(page.getByText('No activity yet today')).toBeVisible()
    } else {
      await expect(page.getByRole('button', { name: 'Mark all read' })).toBeVisible()
    }

    if (mediumLowTasks.length === 0) {
      await expect(page.getByText(/No medium or low priority tasks|No tasks assigned today/)).toBeVisible()
    } else {
      await expect(page.getByTestId('task-list-item').first()).toBeVisible()
    }
  })
})

test.describe('Owner Dashboard refresh contract', () => {
  test('does not contain the old 30 second polling refresh', () => {
    const sourcePath = path.join(process.cwd(), 'src', 'app', 'owner', 'dashboard', 'page.tsx')
    const source = fs.readFileSync(sourcePath, 'utf8')

    expect(source).not.toContain('setInterval')
    expect(source).not.toContain('30_000')
    expect(source).toContain('silent')
    expect(source).toContain('dashboardRefreshTimer')
    expect(source).toContain('timelineRefreshTimer')
  })
})
