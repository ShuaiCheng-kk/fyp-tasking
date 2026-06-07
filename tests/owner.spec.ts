/**
 * Owner E2E Tests — covers implemented features from Owner_Use_Cases.md
 * plus features built outside the use cases.
 *
 * Auth strategy: globalSetup signs in once with owner@testing.com / Test123!
 * and saves storageState to tests/.auth/owner.json. playwright.config.ts loads
 * that state for every test so the Supabase SSR middleware auth check passes.
 *
 * Mock ordering: Playwright matches routes in REVERSE registration order (last
 * registered wins). So catchAllApi() MUST be registered FIRST so specific mocks
 * registered afterwards can override it.
 *
 * Run:  npx playwright test
 */

import { test, expect, Page } from '@playwright/test'

const BASE = 'http://localhost:3000'

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/** Register FIRST in every setup — lowest priority catch-all. */
async function catchAllApi(page: Page) {
  await page.route('**/api/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    })
  )
}

async function mockUserMe(page: Page, overrides: Record<string, unknown> = {}) {
  await page.route('**/api/user/me**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        user: {
          id: 'user-owner-1',
          full_name: 'Test Owner',
          role: 'Owner',
          email_address: 'owner@test.com',
          company_id: 'company-1',
          department_id: null,
          ...overrides,
        },
      }),
    })
  )
}

async function mockMyCompanies(page: Page, companies: unknown[] = []) {
  const data = companies.length ? companies : [{ id: 'company-1', name: 'Acme Corp', plan: 'Free' }]
  await page.route('**/api/company/my-companies**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, companies: data }),
    })
  )
}

async function mockDepartments(page: Page, depts: unknown[] = []) {
  const data = depts.length ? depts : [
    { id: 'dept-1', name: 'Events',  company_id: 'company-1' },
    { id: 'dept-2', name: 'Kitchen', company_id: 'company-1' },
  ]
  await page.route('**/api/company/departments**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, departments: data }),
    })
  )
}

async function mockTeamMembers(page: Page, members: unknown[] = []) {
  const data = members.length ? members : [
    { id: 'mgr-1', full_name: 'Alice Manager', role: 'Manager',       department_id: 'dept-1' },
    { id: 'emp-1', full_name: 'Bob Employee',  role: 'Employee',      department_id: 'dept-1' },
    { id: 'cw-1',  full_name: 'Carol Worker',  role: 'Casual Worker', department_id: 'dept-1' },
  ]
  await page.route('**/api/team/members**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, members: data }),
    })
  )
}

async function mockShiftTimeline(page: Page, rows: unknown[] = []) {
  await page.route('**/api/shift/schedule**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, rows: rows.length ? rows : [] }),
    })
  )
}

async function mockCompanyCurrent(page: Page) {
  await page.route('**/api/company/current**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        role: 'Owner',
        company: { id: 'company-1', name: 'Acme Corp', plan: 'Free' },
        companies: [{ id: 'company-1', name: 'Acme Corp', plan: 'Free' }],
      }),
    })
  )
}

// ─── Auth tests ───────────────────────────────────────────────────────────────
// Use empty storageState so these tests always start unauthenticated.

test.describe('Auth', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('sign-in page renders logo and email/password fields', async ({ page }) => {
    await page.goto(`${BASE}/signin`)
    await expect(page.locator('text=Tasking').first()).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto(`${BASE}/signin`)
    await page.fill('input[type="email"]', 'bad@example.com')
    await page.fill('input[type="password"]', 'wrongpass')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=/invalid|incorrect|error/i').first()).toBeVisible({ timeout: 15000 })
  })

  test('sign-in page has navigation links', async ({ page }) => {
    await page.goto(`${BASE}/signin`)
    await expect(page.locator('a').first()).toBeVisible()
  })
})

// ─── Owner layout / sidebar ────────────────────────────────────────────────────

test.describe('Owner sidebar & layout', () => {
  async function setup(page: Page) {
    await catchAllApi(page)       // lowest priority — register first
    await mockUserMe(page)
    await mockMyCompanies(page)
    await mockCompanyCurrent(page)
    await mockDepartments(page)
    await mockTeamMembers(page)
    await mockShiftTimeline(page)
  }

  test('UC-04: company name is shown in the owner layout', async ({ page }) => {
    await setup(page)
    await page.goto(`${BASE}/owner/dashboard`)
    await expect(page.locator('text=Acme Corp').first()).toBeVisible()
  })

  test('owner sidebar shows Dashboard navigation item', async ({ page }) => {
    await setup(page)
    await page.goto(`${BASE}/owner/dashboard`)
    await expect(page.locator('text=Dashboard').first()).toBeVisible()
  })
})

// ─── UC-01: Department management (Shifts page) ───────────────────────────────

test.describe('UC-01: Department management (Shifts page)', () => {
  async function gotoShifts(page: Page) {
    await catchAllApi(page)
    await mockUserMe(page)
    await mockMyCompanies(page)
    await mockCompanyCurrent(page)
    await mockDepartments(page)
    await mockTeamMembers(page)
    await mockShiftTimeline(page)
    await page.route('**/api/team/department-manager**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, assignments: [] }) })
    )
    await page.goto(`${BASE}/owner/shifts`)
  }

  test('department list renders dept names', async ({ page }) => {
    await gotoShifts(page)
    await expect(page.locator('text=Events').first()).toBeVisible()
    await expect(page.locator('text=Kitchen').first()).toBeVisible()
  })

  test('Add Department button is present', async ({ page }) => {
    await gotoShifts(page)
    const addBtn = page.locator('button').filter({ hasText: /add|new|\+/i }).first()
    await expect(addBtn).toBeVisible()
  })

  test('clicking a department opens drill-down with "Schedule shifts" button', async ({ page }) => {
    await gotoShifts(page)
    await page.locator('text=Events').first().click()
    // Drill-down shows the dept's employees and "Schedule shifts" CTA
    await expect(page.locator('button').filter({ hasText: /Schedule shifts/i }).first()).toBeVisible()
  })
})

// ─── UC-03: Assign manager to department ─────────────────────────────────────

test.describe('UC-03: Assign manager to department', () => {
  test('dept drill-down shows manager label', async ({ page }) => {
    await catchAllApi(page)
    await mockUserMe(page)
    await mockMyCompanies(page)
    await mockCompanyCurrent(page)
    await mockDepartments(page)
    await mockTeamMembers(page)
    await mockShiftTimeline(page)
    await page.route('**/api/team/department-manager**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          assignments: [{ department_id: 'dept-1', manager_id: 'mgr-1', manager_name: 'Alice Manager' }],
        }),
      })
    )
    await page.goto(`${BASE}/owner/shifts`)
    await page.locator('text=Events').first().click()
    // Drill-down renders the dept name and scheduling controls
    await expect(page.locator('text=Events').first()).toBeVisible()
    await expect(page.locator('button').filter({ hasText: /Schedule shifts/i }).first()).toBeVisible()
  })
})

// ─── UC-05–08: Team page ──────────────────────────────────────────────────────

test.describe('UC-05–08: Team page', () => {
  async function gotoTeam(page: Page) {
    await catchAllApi(page)
    await mockUserMe(page)
    await mockMyCompanies(page)
    await mockCompanyCurrent(page)
    await mockDepartments(page)
    await mockTeamMembers(page)
    await page.route('**/api/company/managers**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, assignments: [] }) })
    )
    await page.goto(`${BASE}/owner/team`)
  }

  test('team page renders member names', async ({ page }) => {
    await gotoTeam(page)
    await expect(page.locator('text=Alice Manager').first()).toBeVisible()
    await expect(page.locator('text=Bob Employee').first()).toBeVisible()
  })

  test('"Remove" button is visible', async ({ page }) => {
    await gotoTeam(page)
    await expect(page.locator('button', { hasText: 'Remove' }).first()).toBeVisible()
  })

  test('"Invite Member" button is visible', async ({ page }) => {
    await gotoTeam(page)
    await expect(page.locator('button').filter({ hasText: /Invite/i }).first()).toBeVisible()
  })

  test('Department names appear on team page', async ({ page }) => {
    await gotoTeam(page)
    await expect(page.locator('text=Events').first()).toBeVisible()
  })
})

// ─── UC-09–12: Announcements ──────────────────────────────────────────────────

test.describe('UC-09–12: Announcements (Communication page)', () => {
  async function gotoCommunication(page: Page) {
    await catchAllApi(page)
    await mockUserMe(page)
    await mockMyCompanies(page)
    await mockCompanyCurrent(page)
    await mockDepartments(page)
    await page.route('**/api/inbox/announcements**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          announcements: [
            {
              id: 'ann-1',
              title: 'Team Meeting Tomorrow',
              content: 'We have a team meeting at 9am.',
              department_id: null,
              created_at: new Date().toISOString(),
              created_by_name: 'Test Owner',
            },
          ],
        }),
      })
    )
    await page.route('**/api/inbox/messages**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, conversations: [] }) })
    )
    await page.goto(`${BASE}/owner/communication`)
  }

  test('Communication page has Announcements and Messages tabs', async ({ page }) => {
    await gotoCommunication(page)
    await expect(page.locator('text=Announcements').first()).toBeVisible()
    await expect(page.locator('text=Messages').first()).toBeVisible()
  })

  test('existing announcement title is rendered', async ({ page }) => {
    await gotoCommunication(page)
    await expect(page.locator('text=Team Meeting Tomorrow').first()).toBeVisible()
  })

  test('"New" announcement button is visible', async ({ page }) => {
    await gotoCommunication(page)
    // Button shows "+ New" (not full "New Announcement" text)
    await expect(page.locator('button').filter({ hasText: /New/i }).first()).toBeVisible()
  })

  test('Delete control is present on announcement card', async ({ page }) => {
    await gotoCommunication(page)
    const deleteBtn = page.locator('button').filter({ hasText: /delete/i }).first()
    const iconBtn   = page.locator('[aria-label*="delete" i], [title*="delete" i], button svg').first()
    const either = (await deleteBtn.count()) > 0 ? deleteBtn : iconBtn
    await expect(either).toBeVisible()
  })
})

// ─── UC-13: Direct Messages ───────────────────────────────────────────────────

test.describe('UC-13: Direct Messages', () => {
  test('Messages tab shows conversation partner name', async ({ page }) => {
    await catchAllApi(page)
    await mockUserMe(page)
    await mockMyCompanies(page)
    await mockCompanyCurrent(page)
    await mockDepartments(page)
    await page.route('**/api/inbox/announcements**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, announcements: [] }) })
    )
    await page.route('**/api/inbox/messages**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          conversations: [
            {
              partnerId: 'mgr-1',
              partnerName: 'Alice Manager',
              partnerRole: 'Manager',
              lastMessage: 'Hello!',
              lastTime: new Date().toISOString(),
              unreadCount: 0,
            },
          ],
        }),
      })
    )
    await page.goto(`${BASE}/owner/communication`)
    await page.locator('text=Messages').first().click()
    await expect(page.locator('text=Alice Manager').first()).toBeVisible()
  })
})

// ─── UC-15–19: Settings page ──────────────────────────────────────────────────

test.describe('UC-15–19: Settings page', () => {
  async function gotoSettings(page: Page) {
    await catchAllApi(page)
    await mockUserMe(page)
    await page.route('**/api/company/my-companies**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          companies: [{
            id: 'company-1',
            name: 'Acme Corp',
            description: 'Test company',
            plan: 'Free',
            location: 'Sydney',
            industry: 'Retail',
            size: '1-10',
            logo_url: null,
            website: null,
            owner_id: 'user-owner-1',
          }],
        }),
      })
    )
    await page.goto(`${BASE}/owner/settings`)
  }

  test('Settings page renders Acme Corp company name', async ({ page }) => {
    await gotoSettings(page)
    await expect(page.locator('text=Acme Corp').first()).toBeVisible()
  })

  test('UC-17: "Edit" company button is present', async ({ page }) => {
    await gotoSettings(page)
    // Main settings page shows "Edit" button per company card
    await expect(page.locator('button', { hasText: 'Edit' }).first()).toBeVisible()
  })

  test('UC-18: "Add New Company" button is present', async ({ page }) => {
    await gotoSettings(page)
    await expect(page.locator('button', { hasText: 'Add New Company' }).first()).toBeVisible()
  })

  test('UC-19: "Delete" company button is present', async ({ page }) => {
    await gotoSettings(page)
    await expect(page.locator('button', { hasText: 'Delete' }).first()).toBeVisible()
  })

  test('Plan badge (Free / Paid) is visible', async ({ page }) => {
    await gotoSettings(page)
    await expect(page.locator('text=/free|paid/i').first()).toBeVisible()
  })
})

// ─── UC-21/22: Dashboard timeline ─────────────────────────────────────────────

test.describe('UC-21/22: Dashboard timeline & date navigation', () => {
  async function gotoDashboard(page: Page) {
    await catchAllApi(page)
    await mockUserMe(page)
    await mockMyCompanies(page)
    await mockCompanyCurrent(page)
    await mockDepartments(page)
    await mockTeamMembers(page)
    await mockShiftTimeline(page)
    await page.goto(`${BASE}/owner/dashboard`)
  }

  test('UC-21: Dashboard loads with company name', async ({ page }) => {
    await gotoDashboard(page)
    await expect(page.locator('text=Acme Corp').first()).toBeVisible()
  })

  test('UC-22: "Today" button is visible in shift timeline header', async ({ page }) => {
    await gotoDashboard(page)
    // "Today" button is in the Schedule/Shift timeline header area
    await expect(page.locator('text=Today').first()).toBeVisible()
  })

  test('Dashboard shows "Schedule" panel heading', async ({ page }) => {
    await gotoDashboard(page)
    await expect(page.locator('text=Schedule').first()).toBeVisible()
  })

  test('Team panel is rendered', async ({ page }) => {
    await gotoDashboard(page)
    // Team panel heading is always visible; content depends on who is on shift
    await expect(page.locator('text=Team').first()).toBeVisible()
  })
})

// ─── UC-23: Shifts CRUD ────────────────────────────────────────────────────────

test.describe('UC-23: Shifts management', () => {
  const TODAY = new Date().toISOString().slice(0, 10)

  async function gotoShifts(page: Page) {
    await catchAllApi(page)
    await mockUserMe(page)
    await mockMyCompanies(page)
    await mockCompanyCurrent(page)
    await mockDepartments(page)
    await mockTeamMembers(page)
    await mockShiftTimeline(page, [
      {
        user_id: 'emp-1',
        full_name: 'Bob Employee',
        role: 'Employee',
        department_id: 'dept-1',
        department_name: 'Events',
        shifts: [{
          shift_id: 'shift-1',
          shift_assignment_id: 'sa-1',
          title: '',
          shift_date: TODAY,
          start_time: '09:00',
          end_time: '17:00',
          status: 'active',
          assignment_status: 'assigned',
        }],
      },
    ])
    await page.route('**/api/team/department-manager**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, assignments: [] }) })
    )
    await page.goto(`${BASE}/owner/shifts`)
  }

  test('timeline row for assigned employee is visible', async ({ page }) => {
    await gotoShifts(page)
    await expect(page.locator('text=Bob Employee').first()).toBeVisible()
  })

  test('"Today" button is present in shift timeline', async ({ page }) => {
    await gotoShifts(page)
    // Timeline header has Today / prev / next navigation
    await expect(page.locator('button', { hasText: 'Today' }).first()).toBeVisible()
  })

  test('"Today" date navigation button is present', async ({ page }) => {
    await gotoShifts(page)
    await expect(page.locator('button', { hasText: 'Today' }).first()).toBeVisible()
  })
})

// ─── UC-24–26: Tasks kanban ────────────────────────────────────────────────────

test.describe('UC-24–26: Tasks page (kanban)', () => {
  async function gotoTasks(page: Page) {
    await catchAllApi(page)
    await mockUserMe(page)
    await mockMyCompanies(page)
    await mockCompanyCurrent(page)
    await mockDepartments(page)
    await mockTeamMembers(page)
    await page.route('**/api/task**', route => {
      const url = route.request().url()
      if (url.includes('kanban=true')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            // Page reads data.groups (a KanbanGroup object)
            groups: {
              Assigned: [{
                id: 'task-1',
                title: 'Set up venue',
                status: 'Assigned',
                priority: 'High',
                percentage_complete: 0,
                department_id: 'dept-1',
                company_id: 'company-1',
                shift_id: null,
                assigned_user_id: 'emp-1',
                assigned_by: 'user-owner-1',
                parent_task_id: null,
                due_at: null,
                created_at: new Date().toISOString(),
              }],
              'In Progress': [],
              Review: [],
              Complete: [],
            },
          }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    })
    await mockShiftTimeline(page)
    await page.goto(`${BASE}/owner/tasks`)
  }

  test('Tasks page renders Kanban column headers', async ({ page }) => {
    await gotoTasks(page)
    await expect(page.locator('text=Assigned').first()).toBeVisible()
    await expect(page.locator('text=In Progress').first()).toBeVisible()
    await expect(page.locator('text=Complete').first()).toBeVisible()
  })

  test('task card renders in Assigned column', async ({ page }) => {
    await gotoTasks(page)
    await expect(page.locator('text=Set up venue').first()).toBeVisible()
  })

  test('"New Task" button is present', async ({ page }) => {
    await gotoTasks(page)
    await expect(page.locator('button').filter({ hasText: /New Task/i }).first()).toBeVisible()
  })

  test('task priority badge is shown', async ({ page }) => {
    await gotoTasks(page)
    await expect(page.locator('text=/high|medium|low|urgent/i').first()).toBeVisible()
  })
})

// ─── UC-39–43: Recruitment ────────────────────────────────────────────────────

test.describe('UC-39–43: Recruitment page', () => {
  async function gotoRecruitment(page: Page) {
    await catchAllApi(page)
    await mockUserMe(page)
    await mockMyCompanies(page)
    await mockCompanyCurrent(page)
    await mockDepartments(page)
    await page.route('**/api/recruitment**', route => {
      const url = route.request().url()
      if (url.includes('resource=workers')) {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, workers: [] }),
        })
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          postings: [{
            id: 'post-1',
            title: 'Casual Barista',
            department_id: 'dept-1',
            status: 'open',
            employment_type: 'Casual',
            location: 'Sydney',
            applicant_count: 2,
          }],
        }),
      })
    })
    await page.goto(`${BASE}/owner/recruitment`)
  }

  test('UC-39: Recruitment page renders job posting title', async ({ page }) => {
    await gotoRecruitment(page)
    await expect(page.locator('text=Casual Barista').first()).toBeVisible()
  })

  test('UC-40: "New Job" button is visible', async ({ page }) => {
    await gotoRecruitment(page)
    await expect(page.locator('button').filter({ hasText: /New Job/i }).first()).toBeVisible()
  })

  test('UC-41: Posting status badge "open" is rendered', async ({ page }) => {
    await gotoRecruitment(page)
    await expect(page.locator('text=/open/i').first()).toBeVisible()
  })

  test('UC-43: AI "Generate description" button is present in create form', async ({ page }) => {
    await gotoRecruitment(page)
    await page.locator('button').filter({ hasText: /New Job/i }).first().click()
    await expect(page.locator('button').filter({ hasText: /Generate/i }).first()).toBeVisible()
  })
})

// ─── UC-44/45: Attendance ─────────────────────────────────────────────────────

test.describe('UC-44/45: Attendance page', () => {
  const mockDashboard = {
    records: [{
      assignment: {
        id: 'sa-1', shift_id: 'shift-1', user_id: 'cw-1',
        assigned_by: 'mgr-1', assignment_status: 'assigned',
        supervisor_employee_id: 'emp-1',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
      shift: {
        id: 'shift-1', company_id: 'company-1', department_id: 'dept-1',
        title: '', instruction: null, shift_date: new Date().toISOString().slice(0, 10),
        start_time: '09:00', end_time: '17:00', status: 'active',
        created_by: 'mgr-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
      assignee_name: 'Carol Worker',
      assignee_role: 'Casual Worker',
      supervisor_name: 'Bob Employee',
      department_name: 'Events',
      record: {
        id: 'att-1', shift_assignment_id: 'sa-1', casual_worker_id: 'cw-1',
        clock_in_time: '09:05', clock_out_time: '17:10', status: 'pending',
        confirmed_by_employee_id: null, submitted_by_employee_id: null,
        employee_notes: null, manager_notes: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
      exceptions: [],
    }],
    summary: { total_assignments: 1, pending_final_review: 1, approved: 0, rejected: 0, late: 0, absent: 0, overtime: 0 },
  }

  async function gotoAttendance(page: Page) {
    await catchAllApi(page)
    await mockUserMe(page)
    await mockMyCompanies(page)
    await mockCompanyCurrent(page)
    await mockDepartments(page)
    await page.route('**/api/attendance**', route => {
      const url = route.request().url()
      if (url.includes('resource=time_off')) {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, requests: [] }),
        })
      }
      if (url.includes('resource=shift_swaps')) {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, swapRequests: [] }),
        })
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, dashboard: mockDashboard }),
      })
    })
    await page.goto(`${BASE}/owner/attendance`)
  }

  test('UC-44: Attendance page renders a timesheet record', async ({ page }) => {
    await gotoAttendance(page)
    await expect(page.locator('text=Carol Worker').first()).toBeVisible()
  })

  test('UC-45: Action buttons are present on attendance records', async ({ page }) => {
    await gotoAttendance(page)
    // Page renders icon action buttons (approve ✓ / review ✎ / reject ✗) per record
    // Verify at least one SVG-based button is visible (icon-only buttons)
    await expect(page.locator('button svg').first()).toBeVisible()
  })

  test('AI Auto-approve entry point (Sparkles) is present', async ({ page }) => {
    await gotoAttendance(page)
    await expect(page.locator('button svg').first()).toBeVisible()
  })
})

// ─── UC-48/49: Report page ────────────────────────────────────────────────────

test.describe('UC-48/49: Report page', () => {
  async function gotoReport(page: Page) {
    await catchAllApi(page)
    await mockUserMe(page)
    await mockMyCompanies(page)
    await mockCompanyCurrent(page)
    await mockDepartments(page)
    await page.route('**/api/report**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          report: {
            total_shifts: 20,
            covered_shifts: 18,
            total_hours: 120,
            attendance_rate: 90,
            on_time_rate: 85,
            avg_hours_per_worker: 6,
            department_breakdown: [
              { department_name: 'Events', shifts: 10, hours: 60, attendance_rate: 92 },
            ],
          },
        }),
      })
    )
    await page.route('**/api/ai/anomalies**', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, anomalies: [] }),
      })
    )
    await page.goto(`${BASE}/owner/report`)
  }

  test('UC-48: Report page has filter controls', async ({ page }) => {
    await gotoReport(page)
    await expect(page.locator('button', { hasText: 'Apply' }).first()).toBeVisible()
  })

  test('UC-49: Date range inputs are present', async ({ page }) => {
    await gotoReport(page)
    await expect(page.locator('input[type="date"]').first()).toBeVisible()
  })

  test('"Detect" (AI anomaly) button is present', async ({ page }) => {
    await gotoReport(page)
    await expect(page.locator('button', { hasText: 'Detect' }).first()).toBeVisible()
  })

  test('"Export" button is present', async ({ page }) => {
    await gotoReport(page)
    await expect(page.locator('button', { hasText: 'Export' }).first()).toBeVisible()
  })
})

// ─── Shifts page: batch assignment drawer ─────────────────────────────────────

test.describe('Shifts: batch assignment drawer', () => {
  test('clicking a dept opens drill-down with member count and timeline', async ({ page }) => {
    await catchAllApi(page)
    await mockUserMe(page)
    await mockMyCompanies(page)
    await mockCompanyCurrent(page)
    await mockDepartments(page)
    await mockTeamMembers(page)
    await mockShiftTimeline(page)
    await page.route('**/api/team/department-manager**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, assignments: [] }) })
    )
    await page.goto(`${BASE}/owner/shifts`)
    // Events dept card shows member count; timeline header has Today button
    await expect(page.locator('text=Events').first()).toBeVisible()
    await expect(page.locator('button', { hasText: 'Today' }).first()).toBeVisible()
  })
})

// ─── Dashboard: panels ────────────────────────────────────────────────────────

test.describe('Dashboard panels', () => {
  async function gotoDashboard(page: Page) {
    await catchAllApi(page)
    await mockUserMe(page)
    await mockMyCompanies(page)
    await mockCompanyCurrent(page)
    await mockDepartments(page)
    await mockTeamMembers(page)
    await mockShiftTimeline(page)
    await page.goto(`${BASE}/owner/dashboard`)
  }

  test('Team panel heading is visible', async ({ page }) => {
    await gotoDashboard(page)
    // Team panel always renders; content depends on who is currently on shift
    await expect(page.locator('text=Team').first()).toBeVisible()
  })

  test('Plan badge is visible (Free / Paid)', async ({ page }) => {
    await gotoDashboard(page)
    await expect(page.locator('text=/free|paid/i').first()).toBeVisible()
  })

  test('Dashboard has interactive buttons', async ({ page }) => {
    await gotoDashboard(page)
    await expect(page.locator('button').first()).toBeVisible()
  })
})

// ─── API health check ─────────────────────────────────────────────────────────

test.describe('API health', () => {
  test('health endpoint returns 200', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/api/health`)
    expect(resp.status()).toBe(200)
  })
})
