import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/ownerInboxRepository', () => ({
  ownerInboxRepository: {
    findUserById: vi.fn(),
    insertMessage: vi.fn(),
  },
}))

vi.mock('@/repositories/manager/managerInboxRepository', () => ({
  managerInboxRepository: {
    getManagerContacts: vi.fn(),
  },
}))

import { ownerInboxService } from './ownerInboxService'
import { ownerInboxRepository } from '@/repositories/owner/ownerInboxRepository'
import { managerInboxRepository } from '@/repositories/manager/managerInboxRepository'

// findUserById is looked up twice per send (sender, then recipient) — a per-id map lets each test
// give the sender and recipient different roles/companies instead of one shared mock value.
function mockUsers(users: Record<string, { id: string; full_name: string; role: string; company_id: string }>) {
  vi.mocked(ownerInboxRepository.findUserById).mockImplementation(async (id: string) => (users[id] ?? null) as never)
}

describe('UC65 Send Direct Message (Owner/Partner/Manager/Employee)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ownerInboxRepository.insertMessage).mockImplementation(async (fromUserId, toUserId, companyId, content) =>
      ({ id: 'msg-1', from_user_id: fromUserId, to_user_id: toUserId, content } as never))
  })

  it('UC65-M-UT-O: Owner sends a direct message to an Employee', async () => {
    mockUsers({
      'owner-1': { id: 'owner-1', full_name: 'Owner', role: 'Owner', company_id: 'comp-1' },
      'emp-1': { id: 'emp-1', full_name: 'Emp', role: 'Employee', company_id: 'comp-1' },
    })

    const result = await ownerInboxService.sendMessage('owner-1', 'emp-1', 'comp-1', 'Quick question for you.')

    expect(result).toMatchObject({ from_user_id: 'owner-1', to_user_id: 'emp-1', content: 'Quick question for you.' })
  })

  it('UC65-M-UT-P: Partner sends a direct message to a Manager', async () => {
    mockUsers({
      'partner-1': { id: 'partner-1', full_name: 'Partner', role: 'Partner', company_id: 'comp-1' },
      'mgr-1': { id: 'mgr-1', full_name: 'Mgr', role: 'Manager', company_id: 'comp-1' },
    })

    const result = await ownerInboxService.sendMessage('partner-1', 'mgr-1', 'comp-1', 'Please review this.')

    expect(result).toMatchObject({ from_user_id: 'partner-1', to_user_id: 'mgr-1' })
  })

  it('UC65-M-UT-M: Manager sends a direct message to an Employee in their own department', async () => {
    mockUsers({
      'mgr-1': { id: 'mgr-1', full_name: 'Mgr', role: 'Manager', company_id: 'comp-1' },
      'emp-1': { id: 'emp-1', full_name: 'Emp', role: 'Employee', company_id: 'comp-1' },
    })
    vi.mocked(managerInboxRepository.getManagerContacts).mockResolvedValue([{ id: 'emp-1' }, { id: 'owner-1' }] as never)

    const result = await ownerInboxService.sendMessage('mgr-1', 'emp-1', 'comp-1', 'Team update.')

    expect(result).toMatchObject({ from_user_id: 'mgr-1', to_user_id: 'emp-1' })
  })

  it('UC65-M-UT-E: Employee sends a direct message to their department Manager', async () => {
    mockUsers({
      'emp-1': { id: 'emp-1', full_name: 'Emp', role: 'Employee', company_id: 'comp-1' },
      'mgr-1': { id: 'mgr-1', full_name: 'Mgr', role: 'Manager', company_id: 'comp-1' },
    })

    const result = await ownerInboxService.sendMessage('emp-1', 'mgr-1', 'comp-1', 'Can you cover my shift?')

    expect(result).toMatchObject({ from_user_id: 'emp-1', to_user_id: 'mgr-1' })
  })

  it('UC65-BR-UT-M: Manager is blocked from messaging someone outside their contact scope', async () => {
    mockUsers({
      'mgr-1': { id: 'mgr-1', full_name: 'Mgr', role: 'Manager', company_id: 'comp-1' },
      'emp-other-dept': { id: 'emp-other-dept', full_name: 'Other Dept Emp', role: 'Employee', company_id: 'comp-1' },
    })
    vi.mocked(managerInboxRepository.getManagerContacts).mockResolvedValue([{ id: 'owner-1' }] as never)

    await expect(ownerInboxService.sendMessage('mgr-1', 'emp-other-dept', 'comp-1', 'Hello'))
      .rejects.toThrow('Managers can only message the Owner, Partner, or members of their own department')
    expect(ownerInboxRepository.insertMessage).not.toHaveBeenCalled()
  })

  it('UC65-SEC-UT-1: An Employee is blocked from messaging a user in a different company, even tagging their own real company_id', async () => {
    mockUsers({
      'emp-1': { id: 'emp-1', full_name: 'Emp', role: 'Employee', company_id: 'comp-1' },
      'owner-2': { id: 'owner-2', full_name: 'Other Owner', role: 'Owner', company_id: 'comp-2' },
    })

    await expect(ownerInboxService.sendMessage('emp-1', 'owner-2', 'comp-1', 'Cross-tenant message'))
      .rejects.toThrow('You can only message members of your own company')
    expect(ownerInboxRepository.insertMessage).not.toHaveBeenCalled()
  })
})
