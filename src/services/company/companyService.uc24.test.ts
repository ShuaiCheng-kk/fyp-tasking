import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/department/departmentRepository', () => ({
  departmentRepository: {
    countMembers: vi.fn(),
    deleteById: vi.fn(),
  },
}))

import { companyService } from './companyService'
import { departmentRepository } from '@/repositories/department/departmentRepository'

describe('UC24 Delete Department', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC24-M-UT-O: Owner deletes a department that has no Manager or Employee members', async () => {
    vi.mocked(departmentRepository.countMembers).mockResolvedValue(0)
    vi.mocked(departmentRepository.deleteById).mockResolvedValue(undefined as never)

    await companyService.deleteDepartment('dept-1')

    expect(departmentRepository.deleteById).toHaveBeenCalledWith('dept-1')
  })

  it('UC24-A1-UT-O: Owner is blocked from deleting a department that still has a Manager or Employee assigned', async () => {
    vi.mocked(departmentRepository.countMembers).mockResolvedValue(2)

    await expect(companyService.deleteDepartment('dept-2'))
      .rejects.toThrow('Department still has active members. Reassign or remove all members before deleting this department.')

    expect(departmentRepository.deleteById).not.toHaveBeenCalled()
  })
})
