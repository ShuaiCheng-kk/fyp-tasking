import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/department/departmentRepository', () => ({
  departmentRepository: {
    findById: vi.fn(),
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
    vi.mocked(departmentRepository.findById).mockResolvedValue({
      id: 'dept-1', company_id: 'comp-1', name: 'Marketing', color: '#3B82F6',
    } as never)
    vi.mocked(departmentRepository.countMembers).mockResolvedValue(0)
    vi.mocked(departmentRepository.deleteById).mockResolvedValue(undefined as never)

    await companyService.deleteDepartment('dept-1', 'comp-1')

    expect(departmentRepository.deleteById).toHaveBeenCalledWith('dept-1')
  })

  it('UC24-A1-UT-O: Owner is blocked from deleting a department that still has a Manager or Employee assigned', async () => {
    vi.mocked(departmentRepository.findById).mockResolvedValue({
      id: 'dept-2', company_id: 'comp-1', name: 'Sales', color: '#F97316',
    } as never)
    vi.mocked(departmentRepository.countMembers).mockResolvedValue(2)

    await expect(companyService.deleteDepartment('dept-2', 'comp-1'))
      .rejects.toThrow('Department still has active members. Reassign or remove all members before deleting this department.')

    expect(departmentRepository.deleteById).not.toHaveBeenCalled()
  })

  it('UC24-BR-UT-O: Owner is blocked from deleting a department belonging to another company', async () => {
    vi.mocked(departmentRepository.findById).mockResolvedValue({
      id: 'dept-3', company_id: 'comp-2', name: 'Engineering', color: '#3B82F6',
    } as never)

    await expect(companyService.deleteDepartment('dept-3', 'comp-1'))
      .rejects.toThrow('You can only manage your own company\'s departments')

    expect(departmentRepository.deleteById).not.toHaveBeenCalled()
  })
})
