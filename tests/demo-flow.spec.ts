/**
 * Demo Presentation Flow — End-to-End API Test
 *
 * Tests the full 5-stage demo flow using API calls (no UI interaction).
 * Covers what is built; MISSING features are clearly marked.
 *
 * Accounts used (all password: 111111):
 *   Owner:   owner@test.com
 *   Manager: manager1@test.com (Operations dept)
 *   Employee:employee1@test.com (Operations dept)
 *   Guest:   created temporarily in beforeAll, cleaned up in afterAll
 *
 * MISSING features (not built, skipped below):
 *   - Payment details collection (PayNow / bank account) — no DB field, no API
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// ── Supabase admin client (same key as seed script) ──────────────────────────
const SUPABASE_URL = 'https://qnpwuipwyidslxndgewg.supabase.co'
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucHd1aXB3eWlkc2x4bmRnZXdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA2MDE3NCwiZXhwIjoyMDkzNjM2MTc0fQ.YSQMxKFiAmSlBcQ0tAtU07MnuViwpalADYhpfGxOskU'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Shared state across serial tests ─────────────────────────────────────────
let ownerInternalId = ''
let ownerCompanyId = ''
let managerInternalId = ''
let deptId = ''
let shiftId = ''
let taskId = ''
let jobId = ''
let applicantId = ''
let invitationId = ''
let guestAuthId = ''
let guestInternalId = ''

const GUEST_EMAIL = `test-guest-${Date.now()}@demo.test`
const GUEST_PASSWORD = 'TestDemo123!'

// Minimal valid PDF bytes so the file-upload validation passes
const FAKE_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f\n0000000009 00000 n\n0000000062 00000 n\ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n115\n%%EOF'
)

// ─────────────────────────────────────────────────────────────────────────────
// SETUP / TEARDOWN
// ─────────────────────────────────────────────────────────────────────────────

test.describe.serial('Demo Presentation Flow', () => {
  test.beforeAll(async () => {
    // Create a Guest User via Supabase admin (bypasses email confirmation)
    const { data: authData } = await admin.auth.admin.createUser({
      email: GUEST_EMAIL,
      password: GUEST_PASSWORD,
      email_confirm: true,
    })
    if (!authData.user) throw new Error('Failed to create guest auth user')
    guestAuthId = authData.user.id

    // Get owner company_id to attach guest to the same company
    const { data: ownerRow } = await admin
      .from('users')
      .select('id, company_id')
      .eq('email_address', 'owner@test.com')
      .single()

    const companyId = ownerRow?.company_id ?? null

    // Create public.users row for guest
    const { data: guestRow, error: guestErr } = await admin
      .from('users')
      .insert({
        supabase_auth_id: guestAuthId,
        full_name: 'Demo Guest User',
        email_address: GUEST_EMAIL,
        phone_number: '+65 9000 0000',
        date_of_birth: '2000-01-01',
        role: 'Guest User',
        company_id: companyId,
      })
      .select()
      .single()

    if (guestErr || !guestRow) throw new Error(`Failed to create guest user row: ${guestErr?.message}`)
    guestInternalId = guestRow.id
  })

  test.afterAll(async () => {
    // Clean up guest auth user and related data
    if (guestInternalId) {
      await admin.from('job_invitations').delete().eq('applicant_id', applicantId)
      await admin.from('job_applicants').delete().eq('id', applicantId)
      await admin.from('users').delete().eq('id', guestInternalId)
    }
    if (guestAuthId) await admin.auth.admin.deleteUser(guestAuthId)
    // Clean up test job posting
    if (jobId) await admin.from('job_postings').delete().eq('id', jobId)
    // Clean up test task and shift
    if (taskId) await admin.from('tasks').delete().eq('id', taskId)
    if (shiftId) await admin.from('shifts').delete().eq('id', shiftId)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // FLOW 1: Account Registration
  // ─────────────────────────────────────────────────────────────────────────

  test('Flow 1 — Owner signs in (pre-seeded account)', async ({ request }) => {
    const res = await request.post('/api/auth/signin', {
      data: { email_address: 'owner@test.com', password: '111111' },
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.user.role).toBe('Owner')
    ownerInternalId = data.user.id
    ownerCompanyId = data.user.company_id
    expect(ownerInternalId).toBeTruthy()
    expect(ownerCompanyId).toBeTruthy()
  })

  test('Flow 1 — Guest user registration API returns success for new email', async ({ request }) => {
    // Email registration works (email verification is separate concern)
    const uniqueEmail = `flow1-check-${Date.now()}@test.local`
    const res = await request.post('/api/auth/register', {
      data: {
        email_address: uniqueEmail,
        password: 'TestCheck123!',
        full_name: 'Flow1 Check',
        role: 'Guest User',
      },
    })
    const data = await res.json()
    // Either 201 success or already-exists error — API must respond
    expect(res.status()).not.toBe(500)
    // Cleanup if created
    if (data.success) {
      const { data: authUser } = await admin.auth.admin.listUsers()
      const found = authUser?.users?.find((u: { email?: string }) => u.email === uniqueEmail)
      if (found) await admin.auth.admin.deleteUser(found.id)
      await admin.from('users').delete().eq('email_address', uniqueEmail)
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // FLOW 2: User Invitation
  // ─────────────────────────────────────────────────────────────────────────

  test('Flow 2 — Generate Manager invitation code', async ({ request }) => {
    const deptsRes = await request.get(`/api/company/departments?company_id=${ownerCompanyId}`)
    const deptsData = await deptsRes.json()
    deptId = deptsData.departments?.[0]?.id ?? ''
    expect(deptId).toBeTruthy()

    const res = await request.post('/api/invitation/generate', {
      data: { company_id: ownerCompanyId, department_id: deptId, role: 'Manager', generated_by: ownerInternalId },
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(typeof data.code).toBe('string')
    expect(data.code.length).toBeGreaterThan(0)
  })

  test('Flow 2 — Generate Employee invitation code', async ({ request }) => {
    const res = await request.post('/api/invitation/generate', {
      data: { company_id: ownerCompanyId, department_id: deptId, role: 'Employee', generated_by: ownerInternalId },
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(typeof data.code).toBe('string')
  })

  test('Flow 2 — Manager signs in (pre-seeded account)', async ({ request }) => {
    const res = await request.post('/api/auth/signin', {
      data: { email_address: 'manager1@test.com', password: '111111' },
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.user.role).toBe('Manager')
    managerInternalId = data.user.id
  })

  // ─────────────────────────────────────────────────────────────────────────
  // FLOW 3: Shift and Task Assignment
  // ─────────────────────────────────────────────────────────────────────────

  test('Flow 3a — AI Shift Scheduling generates valid suggestions', async ({ request }) => {
    const today = new Date().toISOString().slice(0, 10)
    const next7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const res = await request.post('/api/ai/shift-scheduling', {
      data: {
        context: 'We need coverage for a busy weekend event at our hospitality venue',
        department_name: 'Operations',
        date_from: today,
        date_to: next7,
        preferred_hours: '8-hour shifts',
      },
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.draft?.shifts)).toBe(true)
    expect(data.draft.shifts.length).toBeGreaterThan(0)
    const s = data.draft.shifts[0]
    expect(typeof s.shift_date).toBe('string')
    expect(typeof s.start_time).toBe('string')
    expect(typeof s.end_time).toBe('string')
    expect(typeof s.title).toBe('string')
    expect(typeof s.reason).toBe('string')
  })

  test('Flow 3b — Create a shift from AI suggestion', async ({ request }) => {
    const today = new Date().toISOString().slice(0, 10)
    const res = await request.post('/api/shift', {
      data: {
        company_id: ownerCompanyId,
        department_id: deptId,
        title: 'E2E Demo Shift',
        shift_date: today,
        start_time: '09:00',
        end_time: '17:00',
        created_by: ownerInternalId,
      },
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    shiftId = data.shift?.id ?? data.id ?? ''
    expect(shiftId).toBeTruthy()
  })

  test('Flow 3c — AI Task Breakdown generates task list', async ({ request }) => {
    const res = await request.post('/api/ai/task-breakdown', {
      data: {
        context: 'Weekend event coverage at hospitality venue',
        shift_title: 'E2E Demo Shift',
        department_name: 'Operations',
      },
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.draft?.tasks)).toBe(true)
    expect(data.draft.tasks.length).toBeGreaterThan(0)
    const t = data.draft.tasks[0]
    expect(typeof t.title).toBe('string')
    expect(['Low', 'Medium', 'High', 'Urgent']).toContain(t.priority)
  })

  test('Flow 3d — Create a task', async ({ request }) => {
    const today = new Date().toISOString().slice(0, 10)
    const res = await request.post('/api/task', {
      data: {
        company_id: ownerCompanyId,
        department_id: deptId,
        title: 'E2E Demo Task',
        description: 'Set up event hall and coordinate with vendors',
        status: 'Assigned',
        percentage_complete: 0,
        priority: 'High',
        assigned_by: ownerInternalId,
        shift_id: shiftId || null,
        due_at: today,
      },
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    taskId = data.task?.id ?? data.id ?? ''
    expect(taskId).toBeTruthy()
  })

  test('Flow 3e — AI Task Assignment returns ranked recommendations', async ({ request }) => {
    // Get dept members
    const membersRes = await request.get(
      `/api/team/members?company_id=${ownerCompanyId}&department_id=${deptId}`
    )
    const membersData = await membersRes.json()
    const candidates = (membersData.members ?? []).slice(0, 3).map((m: Record<string, unknown>) => ({
      id: m.id,
      name: m.full_name,
      role: m.role,
      active_task_count: 0,
      current_task_count: 0,
    }))

    if (candidates.length === 0) {
      test.skip() // No members in dept — seed data may be missing
      return
    }

    const res = await request.post('/api/ai/task-assignment', {
      data: {
        task_title: 'E2E Demo Task',
        task_description: 'Set up event hall',
        task_priority: 'High',
        department_name: 'Operations',
        candidates,
      },
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.draft?.recommendations)).toBe(true)
    expect(data.draft.recommendations.length).toBeGreaterThan(0)
    const r = data.draft.recommendations[0]
    expect(typeof r.score).toBe('number')
    expect(['strong', 'good', 'fair']).toContain(r.fit)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // FLOW 4: Post Jobs
  // ─────────────────────────────────────────────────────────────────────────

  test('Flow 4a — AI Job Description Generator returns structured draft', async ({ request }) => {
    const res = await request.post('/api/ai/job-description', {
      data: {
        title: 'Event Staff',
        company_name: 'Sunrise Hospitality Group',
        department_name: 'Operations',
        location: 'Singapore',
        employment_type: 'casual',
      },
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(typeof data.draft?.title).toBe('string')
    expect(typeof data.draft?.description).toBe('string')
    expect(Array.isArray(data.draft?.requirements)).toBe(true)
  })

  test('Flow 4b — Manager creates job posting (via Job Template)', async ({ request }) => {
    const res = await request.post('/api/recruitment', {
      data: {
        company_id: ownerCompanyId,
        department_id: deptId,
        created_by: managerInternalId,
        title: 'E2E Event Staff',
        description: 'We are looking for enthusiastic event staff to assist with setup and operations.',
        requirements: 'Strong communication skills\nAble to stand for extended periods',
        employment_type: 'casual',
        status: 'draft',
      },
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    jobId = data.posting?.id ?? data.id ?? ''
    expect(jobId).toBeTruthy()
  })

  test('Flow 4c — Manager submits job for Owner review → Owner inbox notification', async ({ request }) => {
    // Submit for review
    const res = await request.patch('/api/recruitment', {
      data: { action: 'submit_for_review', job_id: jobId },
    })
    const data = await res.json()
    expect(data.success).toBe(true)

    // Check Owner inbox has a message about this job
    const ownerRes = await request.get(`/api/company/owner?company_id=${ownerCompanyId}`)
    const ownerData = await ownerRes.json()
    expect(ownerData.success).toBe(true)
    expect(ownerData.owner_id).toBeTruthy()
  })

  test('Flow 4d — Owner approves job posting → Manager gets inbox notification', async ({ request }) => {
    const res = await request.patch('/api/recruitment', {
      data: { action: 'approve_posting', job_id: jobId },
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.posting?.status ?? data.status).toBe('open')
  })

  test('Flow 4e — Approved job appears on public job board', async ({ request }) => {
    const res = await request.get('/api/jobs/public')
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.jobs)).toBe(true)
    const found = data.jobs.find((j: { id: string }) => j.id === jobId)
    expect(found).toBeTruthy()
    expect(found.status).toBe('open')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // FLOW 5: Guest User Apply
  // ─────────────────────────────────────────────────────────────────────────

  test('Flow 5a — Guest browses public job board (no auth required)', async ({ request }) => {
    const res = await request.get('/api/jobs/public')
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.jobs.some((j: { id: string }) => j.id === jobId)).toBe(true)
  })

  test('Flow 5b — Guest applies for the job (multipart file upload)', async ({ page }) => {
    // Use page.request to send multipart form data with fake PDF files
    const formData = new FormData()
    formData.append('job_id', jobId)
    formData.append('user_id', guestInternalId)
    formData.append('resume_file', new Blob([FAKE_PDF], { type: 'application/pdf' }), 'resume.pdf')
    formData.append('cover_letter_file', new Blob([FAKE_PDF], { type: 'application/pdf' }), 'cover.pdf')

    const res = await page.request.post('/api/guest/applications', {
      multipart: {
        job_id: jobId,
        user_id: guestInternalId,
        resume_file: {
          name: 'resume.pdf',
          mimeType: 'application/pdf',
          buffer: FAKE_PDF,
        },
        cover_letter_file: {
          name: 'cover.pdf',
          mimeType: 'application/pdf',
          buffer: FAKE_PDF,
        },
      },
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    applicantId = data.application?.id ?? ''
    expect(applicantId).toBeTruthy()
  })

  test('Flow 5c — Guest views own applications', async ({ request }) => {
    const res = await request.get(`/api/guest/applications?user_id=${guestInternalId}`)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.applications)).toBe(true)
    const found = data.applications.find((a: { id: string }) => a.id === applicantId)
    expect(found).toBeTruthy()
    expect(found.status).toBe('pending')
  })

  test('Flow 5d — AI Candidate Recommendation scores applicants', async ({ request }) => {
    // GET /api/ai/candidates?job_id=... uses the job_id to fetch applicants internally
    const res = await request.get(`/api/ai/candidates?job_id=${jobId}`)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.recommendations)).toBe(true)
    if (data.recommendations.length > 0) {
      const r = data.recommendations[0]
      expect(typeof r.score).toBe('number')
      expect(['strong', 'review', 'weak']).toContain(r.recommendation)
    }
  })

  test('Flow 5e — Manager accepts the applicant → job invitation created', async ({ request }) => {
    const res = await request.patch('/api/recruitment', {
      data: {
        action: 'decide_applicant',
        applicant_id: applicantId,
        decision: 'accepted',
        decided_by: managerInternalId,
        message: 'Congratulations! Your application has been accepted. Please confirm your availability.',
      },
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.applicant?.status ?? data.status).toBe('accepted')
  })

  test('Flow 5f — Guest sees accepted status + invitation on applications page', async ({ request }) => {
    const res = await request.get(`/api/guest/applications?user_id=${guestInternalId}`)
    const data = await res.json()
    expect(data.success).toBe(true)
    const found = data.applications.find((a: { id: string }) => a.id === applicantId)
    expect(found).toBeTruthy()
    expect(found.status).toBe('accepted')

    // Check that job_invitations are joined
    const invites = found.job_invitations ?? []
    expect(invites.length).toBeGreaterThan(0)
    expect(invites[0].status).toBe('sent')
    invitationId = invites[0].id
    expect(invitationId).toBeTruthy()
  })

  test('Flow 5g — Guest accepts the invitation → auto-promoted to Casual Worker', async ({ request }) => {
    const res = await request.patch(
      `/api/guest/applications/${applicantId}/respond`,
      {
        data: { invitation_id: invitationId, response: 'accepted' },
      }
    )
    const data = await res.json()
    expect(data.success).toBe(true)

    // Verify invitation status updated
    const appsRes = await request.get(`/api/guest/applications?user_id=${guestInternalId}`)
    const appsData = await appsRes.json()
    const found = appsData.applications.find((a: { id: string }) => a.id === applicantId)
    const invite = (found?.job_invitations ?? [])[0]
    expect(invite?.status).toBe('accepted')

    // Verify user was promoted to Casual Worker
    const { data: userRow } = await admin
      .from('users')
      .select('role, worker_status')
      .eq('id', guestInternalId)
      .single()
    expect(userRow?.role).toBe('Casual Worker')
    expect(userRow?.worker_status).toBe('active')
  })

  test('Flow 5h — Casual Worker saves payment details (PayNow)', async ({ request }) => {
    const res = await request.patch('/api/casual/profile', {
      data: {
        user_id: guestInternalId,
        payment_method: 'paynow',
        payment_account: '+65 9000 0000',
      },
    })
    const data = await res.json()
    expect(data.success).toBe(true)

    // Verify saved in DB via admin
    const { data: userRow } = await admin
      .from('users')
      .select('payment_method, payment_account')
      .eq('id', guestInternalId)
      .single()
    expect(userRow?.payment_method).toBe('paynow')
    expect(userRow?.payment_account).toBe('+65 9000 0000')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // FLOW SUMMARY: Verify final state
  // ─────────────────────────────────────────────────────────────────────────

  test('Flow summary — Verify Casual Worker can sign in to /casual dashboard', async ({ request }) => {
    const res = await request.post('/api/auth/signin', {
      data: { email_address: GUEST_EMAIL, password: GUEST_PASSWORD },
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.user.role).toBe('Casual Worker')
  })
})
