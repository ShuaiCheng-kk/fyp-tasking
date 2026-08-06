import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/userAdminRepository', () => ({
  suspendUser: vi.fn(),
  getUserById: vi.fn(),
}))

import { suspendUser } from './userAdminService'
import * as repo from '@/repositories/userAdminRepository'

describe('UC78 Suspend User Account', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repo.suspendUser).mockResolvedValue(undefined as never)
  })

  it('UC78-M-UT: User Admin suspends a user account with a reason', async () => {
    vi.mocked(repo.getUserById).mockResolvedValue({ id: 'user-1', role: 'Employee' } as never)

    await suspendUser({ user_id: 'user-1', reason: 'Reported harassment' })

    expect(repo.suspendUser).toHaveBeenCalledWith('user-1', 'Reported harassment')
  })

  it('UC78-A1-UT: User Admin is blocked from confirming the suspension without typing a reason', async () => {
    await expect(suspendUser({ user_id: 'user-1', reason: '' }))
      .rejects.toThrow('Suspension reason is required')
    expect(repo.suspendUser).not.toHaveBeenCalled()
  })

  it('UC78-A2-UT: User Admin is blocked from suspending another User Admin account', async () => {
    vi.mocked(repo.getUserById).mockResolvedValue({ id: 'uadmin-2', role: 'User Admin' } as never)

    await expect(suspendUser({ user_id: 'uadmin-2', reason: 'Testing' }))
      .rejects.toThrow('Platform admin accounts cannot be suspended')
    expect(repo.suspendUser).not.toHaveBeenCalled()
  })

  it('UC78-A2-UT-2: User Admin is blocked from suspending a Marketing Admin account', async () => {
    vi.mocked(repo.getUserById).mockResolvedValue({ id: 'madmin-1', role: 'Marketing Admin' } as never)

    await expect(suspendUser({ user_id: 'madmin-1', reason: 'Testing' }))
      .rejects.toThrow('Platform admin accounts cannot be suspended')
    expect(repo.suspendUser).not.toHaveBeenCalled()
  })
})
