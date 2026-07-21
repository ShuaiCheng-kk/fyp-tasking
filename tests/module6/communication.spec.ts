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
let departments: { ops: string; marketing: string }
const members: SeededMember[] = []

let managerOps: SeededMember
let managerMarketing: SeededMember
let employeeOps: SeededMember
let employeeMarketing: SeededMember

async function createMember(role: 'Manager' | 'Employee', label: string, departmentId: string): Promise<SeededMember> {
  const email = `test-module6-${label}-${Date.now()}@tasking-tests.local`
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
      full_name: `Module 6 ${role} ${label}`,
      email_address: email,
      phone_number: null,
      role,
      company_id: seeded.companyId,
    })
    .select()
    .single()
  if (userError || !user) throw new Error(`Failed to create user row: ${userError?.message}`)

  if (role === 'Manager') {
    const { error } = await admin
      .from('manager_departments')
      .insert({ manager_id: user.id, company_id: seeded.companyId, department_id: departmentId, assigned_by: seeded.ownerId })
    if (error) throw new Error(`Failed to assign manager department: ${error.message}`)
  } else {
    const { error } = await admin
      .from('employee_departments')
      .insert({ employee_id: user.id, department_id: departmentId })
    if (error) throw new Error(`Failed to assign employee department: ${error.message}`)
  }

  const member = { authUserId: authData.user.id, userId: user.id as string, email }
  members.push(member)
  return member
}

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('module6')

  const { data, error } = await admin
    .from('departments')
    .insert([
      { company_id: seeded.companyId, name: 'Ops' },
      { company_id: seeded.companyId, name: 'Marketing' },
    ])
    .select('id, name')
  if (error || !data || data.length !== 2) throw new Error(`Failed to create departments: ${error?.message}`)

  departments = {
    ops: data.find((d) => d.name === 'Ops')!.id,
    marketing: data.find((d) => d.name === 'Marketing')!.id,
  }

  managerOps = await createMember('Manager', 'mgr-ops', departments.ops)
  managerMarketing = await createMember('Manager', 'mgr-mkt', departments.marketing)
  employeeOps = await createMember('Employee', 'emp-ops', departments.ops)
  employeeMarketing = await createMember('Employee', 'emp-mkt', departments.marketing)
})

test.afterAll(async () => {
  await admin.from('messages').delete().eq('company_id', seeded.companyId)
  await admin.from('announcements').delete().eq('company_id', seeded.companyId)
  await admin.from('manager_departments').delete().eq('company_id', seeded.companyId)
  for (const member of members) {
    await admin.from('employee_departments').delete().eq('employee_id', member.userId)
    await admin.from('users').delete().eq('id', member.userId)
    await admin.auth.admin.deleteUser(member.authUserId).catch(() => undefined)
  }
  await cleanupTestOwnerAndCompany(seeded)
})

test.describe.configure({ mode: 'serial' })

test('UC58 posts a company-wide announcement as Owner and a department announcement as Manager', async ({ request }) => {
  const ownerPost = await request.post('/api/inbox/announcements', {
    data: {
      from_user_id: seeded.ownerId,
      company_id: seeded.companyId,
      department_id: null,
      title: 'Company-wide notice',
      content: 'This applies to everyone.',
    },
  })
  expect(ownerPost.status()).toBe(200)
  const ownerBody = await ownerPost.json()
  expect(ownerBody).toMatchObject({ success: true, announcement: { department_id: null, title: 'Company-wide notice' } })

  const managerPost = await request.post('/api/inbox/announcements', {
    data: {
      from_user_id: managerOps.userId,
      company_id: seeded.companyId,
      department_id: departments.ops,
      title: 'Ops department notice',
      content: 'Ops team only.',
    },
  })
  expect(managerPost.status()).toBe(200)
  const managerBody = await managerPost.json()
  expect(managerBody).toMatchObject({ success: true, announcement: { department_id: departments.ops, title: 'Ops department notice' } })
})

test('UC58 rejects an Employee attempting to post an announcement', async ({ request }) => {
  const res = await request.post('/api/inbox/announcements', {
    data: {
      from_user_id: employeeOps.userId,
      company_id: seeded.companyId,
      department_id: null,
      title: 'Should not be allowed',
      content: 'Employees cannot post.',
    },
  })
  expect(res.status()).toBe(403)
  const body = await res.json()
  expect(body).toMatchObject({ success: false, error: 'Employees cannot post announcements' })
})

test('Manager cannot post a company-wide announcement or target another department', async ({ request }) => {
  const companyWideAttempt = await request.post('/api/inbox/announcements', {
    data: {
      from_user_id: managerOps.userId,
      company_id: seeded.companyId,
      department_id: null,
      title: 'Should not be allowed',
      content: 'Managers cannot go company-wide.',
    },
  })
  expect(companyWideAttempt.status()).toBe(403)
  expect(await companyWideAttempt.json()).toMatchObject({ success: false, error: 'Managers can only post announcements to their own department' })

  const crossDeptAttempt = await request.post('/api/inbox/announcements', {
    data: {
      from_user_id: managerOps.userId,
      company_id: seeded.companyId,
      department_id: departments.marketing,
      title: 'Should not be allowed',
      content: 'Managers cannot target another department.',
    },
  })
  expect(crossDeptAttempt.status()).toBe(403)
  expect(await crossDeptAttempt.json()).toMatchObject({ success: false, error: 'Managers can only post announcements to their own department' })
})

test('Manager-posted announcement is scoped to its own department only', async ({ request }) => {
  const opsView = await request.get(`/api/employee/announcements?user_id=${employeeOps.userId}`)
  expect(opsView.status()).toBe(200)
  const opsBody = await opsView.json()
  expect(opsBody.announcements.map((a: { title: string }) => a.title)).toContain('Ops department notice')

  const mktView = await request.get(`/api/employee/announcements?user_id=${employeeMarketing.userId}`)
  expect(mktView.status()).toBe(200)
  const mktBody = await mktView.json()
  expect(mktBody.announcements.map((a: { title: string }) => a.title)).not.toContain('Ops department notice')
})

test('UC59 edits own announcement but rejects editing someone else\'s', async ({ request }) => {
  const list = await request.get(`/api/inbox/announcements?company_id=${seeded.companyId}&role=owner`)
  expect(list.status()).toBe(200)
  const listBody = await list.json()
  const ownerAnnouncement = listBody.announcements.find((a: { title: string }) => a.title === 'Company-wide notice')
  expect(ownerAnnouncement).toBeTruthy()

  const edit = await request.patch('/api/inbox/announcements', {
    data: {
      announcement_id: ownerAnnouncement.id,
      requesting_user_id: seeded.ownerId,
      title: 'Company-wide notice EDITED',
      content: 'Updated content.',
    },
  })
  expect(edit.status()).toBe(200)
  const editBody = await edit.json()
  expect(editBody).toMatchObject({ success: true, announcement: { title: 'Company-wide notice EDITED' } })

  const hijackAttempt = await request.patch('/api/inbox/announcements', {
    data: {
      announcement_id: ownerAnnouncement.id,
      requesting_user_id: managerOps.userId,
      title: 'Hijacked',
      content: 'Should not succeed.',
    },
  })
  expect(hijackAttempt.status()).toBe(400)
  const hijackBody = await hijackAttempt.json()
  expect(hijackBody.success).toBe(false)
})

test('UC60 deletes own announcement and rejects deleting it twice', async ({ request }) => {
  const list = await request.get(`/api/inbox/announcements?company_id=${seeded.companyId}&role=manager&department_id=${departments.ops}`)
  expect(list.status()).toBe(200)
  const listBody = await list.json()
  const managerAnnouncement = listBody.announcements.find((a: { title: string }) => a.title === 'Ops department notice')
  expect(managerAnnouncement).toBeTruthy()

  const deleteRes = await request.delete('/api/inbox/announcements', {
    data: { announcement_id: managerAnnouncement.id, requesting_user_id: managerOps.userId },
  })
  expect(deleteRes.status()).toBe(200)
  expect(await deleteRes.json()).toMatchObject({ success: true })

  const deleteAgain = await request.delete('/api/inbox/announcements', {
    data: { announcement_id: managerAnnouncement.id, requesting_user_id: managerOps.userId },
  })
  expect(deleteAgain.status()).toBe(400)
  const deleteAgainBody = await deleteAgain.json()
  expect(deleteAgainBody.success).toBe(false)
})

test('UC61 sends a direct message and the recipient can read the conversation', async ({ request }) => {
  const send = await request.post('/api/inbox/messages', {
    data: {
      from_user_id: employeeOps.userId,
      to_user_id: managerOps.userId,
      company_id: seeded.companyId,
      content: 'Hi manager, quick question.',
    },
  })
  expect(send.status()).toBe(200)
  const sendBody = await send.json()
  expect(sendBody).toMatchObject({ success: true, message: { content: 'Hi manager, quick question.' } })

  const conversations = await request.get(`/api/inbox/messages?user_id=${managerOps.userId}`)
  expect(conversations.status()).toBe(200)
  const conversationsBody = await conversations.json()
  expect(conversationsBody.conversations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ partnerId: employeeOps.userId, lastMessage: 'Hi manager, quick question.' }),
    ]),
  )

  const reply = await request.post('/api/inbox/messages', {
    data: {
      from_user_id: managerOps.userId,
      to_user_id: employeeOps.userId,
      company_id: seeded.companyId,
      content: 'Sure, go ahead.',
    },
  })
  expect(reply.status()).toBe(200)

  const history = await request.get(`/api/inbox/messages/${managerOps.userId}?user_id=${employeeOps.userId}`)
  expect(history.status()).toBe(200)
  const historyBody = await history.json()
  expect(historyBody.messages.map((m: { content: string }) => m.content)).toEqual([
    'Hi manager, quick question.',
    'Sure, go ahead.',
  ])
})

test('Employee contact list is scoped to own department only', async ({ request }) => {
  const contacts = await request.get(`/api/employee/contacts?user_id=${employeeOps.userId}`)
  expect(contacts.status()).toBe(200)
  const body = await contacts.json()
  const ids = body.contacts.map((c: { id: string }) => c.id)
  expect(ids).toContain(managerOps.userId)
  expect(ids).not.toContain(managerMarketing.userId)
  expect(ids).not.toContain(employeeMarketing.userId)
})

test('Manager contact list includes Owner and own department only, excluding self', async ({ request }) => {
  const contacts = await request.get(`/api/manager/contacts?user_id=${managerOps.userId}`)
  expect(contacts.status()).toBe(200)
  const body = await contacts.json()
  const ids = body.contacts.map((c: { id: string }) => c.id)
  expect(ids).toContain(seeded.ownerId)
  expect(ids).toContain(employeeOps.userId)
  expect(ids).not.toContain(managerOps.userId)
  expect(ids).not.toContain(managerMarketing.userId)
  expect(ids).not.toContain(employeeMarketing.userId)
})

test('Manager cannot send a direct message to a user outside their department scope', async ({ request }) => {
  const res = await request.post('/api/inbox/messages', {
    data: {
      from_user_id: managerOps.userId,
      to_user_id: employeeMarketing.userId,
      company_id: seeded.companyId,
      content: 'This should not be allowed.',
    },
  })
  expect(res.status()).toBe(403)
  const body = await res.json()
  expect(body).toMatchObject({ success: false, error: 'Managers can only message the Owner, Partner, or members of their own department' })
})
