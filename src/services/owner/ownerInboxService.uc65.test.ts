import { describe, it, expect, vi, beforeEach } from 'vitest'

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

describe('UC65 Send Direct Message (Owner/Partner/Manager/Employee)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ownerInboxRepository.insertMessage).mockImplementation(async (fromUserId, toUserId, companyId, content) =>
      ({ id: 'msg-1', from_user_id: fromUserId, to_user_id: toUserId, content } as never))
  })

  it('UC65-M-UT-O: Owner sends a direct message to an Employee', async () => {
    vi.mocked(ownerInboxRepository.findUserById).mockResolvedValue({ id: 'owner-1', full_name: 'Owner', role: 'Owner' } as never)

    const result = await ownerInboxService.sendMessage('owner-1', 'emp-1', 'comp-1', 'Quick question for you.')

    expect(result).toMatchObject({ from_user_id: 'owner-1', to_user_id: 'emp-1', content: 'Quick question for you.' })
  })

  it('UC65-M-UT-P: Partner sends a direct message to a Manager', async () => {
    vi.mocked(ownerInboxRepository.findUserById).mockResolvedValue({ id: 'partner-1', full_name: 'Partner', role: 'Partner' } as never)

    const result = await ownerInboxService.sendMessage('partner-1', 'mgr-1', 'comp-1', 'Please review this.')

    expect(result).toMatchObject({ from_user_id: 'partner-1', to_user_id: 'mgr-1' })
  })

  it('UC65-M-UT-M: Manager sends a direct message to an Employee in their own department', async () => {
    vi.mocked(ownerInboxRepository.findUserById).mockResolvedValue({ id: 'mgr-1', full_name: 'Mgr', role: 'Manager' } as never)
    vi.mocked(managerInboxRepository.getManagerContacts).mockResolvedValue([{ id: 'emp-1' }, { id: 'owner-1' }] as never)

    const result = await ownerInboxService.sendMessage('mgr-1', 'emp-1', 'comp-1', 'Team update.')

    expect(result).toMatchObject({ from_user_id: 'mgr-1', to_user_id: 'emp-1' })
  })

  it('UC65-M-UT-E: Employee sends a direct message to their department Manager', async () => {
    vi.mocked(ownerInboxRepository.findUserById).mockResolvedValue({ id: 'emp-1', full_name: 'Emp', role: 'Employee' } as never)

    const result = await ownerInboxService.sendMessage('emp-1', 'mgr-1', 'comp-1', 'Can you cover my shift?')

    expect(result).toMatchObject({ from_user_id: 'emp-1', to_user_id: 'mgr-1' })
  })

  it('UC65-BR-UT-M: Manager is blocked from messaging someone outside their contact scope', async () => {
    vi.mocked(ownerInboxRepository.findUserById).mockResolvedValue({ id: 'mgr-1', full_name: 'Mgr', role: 'Manager' } as never)
    vi.mocked(managerInboxRepository.getManagerContacts).mockResolvedValue([{ id: 'owner-1' }] as never)

    await expect(ownerInboxService.sendMessage('mgr-1', 'emp-other-dept', 'comp-1', 'Hello'))
      .rejects.toThrow('Managers can only message the Owner, Partner, or members of their own department')
    expect(ownerInboxRepository.insertMessage).not.toHaveBeenCalled()
  })

  it('UC65-BR-UT-E: An Employee can actually message the Owner directly through the backend, since only the Manager restriction is server-enforced', async () => {
    vi.mocked(ownerInboxRepository.findUserById).mockResolvedValue({ id: 'emp-1', full_name: 'Emp', role: 'Employee' } as never)

    const result = await ownerInboxService.sendMessage('emp-1', 'owner-1', 'comp-1', 'Not normally reachable through the compose screen.')

    expect(result).toMatchObject({ from_user_id: 'emp-1', to_user_id: 'owner-1' })
    expect(managerInboxRepository.getManagerContacts).not.toHaveBeenCalled()
  })
})
