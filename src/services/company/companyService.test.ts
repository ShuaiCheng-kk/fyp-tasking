import { describe, it, expect, vi, beforeEach } from 'vitest'

// Prevent any real Supabase client from being constructed when companyService
// transitively imports companyRepository/authRepository at module load time.
vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/department/departmentRepository', () => ({
  departmentRepository: {
    createDepartment: vi.fn(),
    updateById: vi.fn(),
    deleteById: vi.fn(),
    countMembers: vi.fn(),
    findByCompanyId: vi.fn(),
  },
}))

import { companyService } from './companyService'
import { departmentRepository } from '@/repositories/department/departmentRepository'

describe('companyService — Manage Departments (UC24-26)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createDepartment', () => {
    it('passes the department payload straight through to the repository', async () => {
      const created = { id: 'dept-1', name: 'Operations', company_id: 'company-1', color: null, created_at: '2026-01-01' }
      vi.mocked(departmentRepository.createDepartment).mockResolvedValue(created)

      const result = await companyService.createDepartment({ name: 'Operations', company_id: 'company-1' })

      expect(departmentRepository.createDepartment).toHaveBeenCalledWith({ name: 'Operations', company_id: 'company-1' })
      expect(result).toEqual(created)
    })
  })

  describe('updateDepartment', () => {
    it('renames a department by delegating to the repository', async () => {
      vi.mocked(departmentRepository.updateById).mockResolvedValue(undefined)

      await companyService.updateDepartment('dept-1', 'Logistics', '#F97316')

      expect(departmentRepository.updateById).toHaveBeenCalledWith('dept-1', 'Logistics', '#F97316')
    })
  })

  describe('deleteDepartment', () => {
    it('deletes the department when it has no members', async () => {
      vi.mocked(departmentRepository.countMembers).mockResolvedValue(0)
      vi.mocked(departmentRepository.deleteById).mockResolvedValue(undefined)

      await companyService.deleteDepartment('dept-1')

      expect(departmentRepository.countMembers).toHaveBeenCalledWith('dept-1')
      expect(departmentRepository.deleteById).toHaveBeenCalledWith('dept-1')
    })

    it('blocks deletion and never calls deleteById when the department still has members', async () => {
      vi.mocked(departmentRepository.countMembers).mockResolvedValue(2)

      await expect(companyService.deleteDepartment('dept-1')).rejects.toThrow(
        'Department still has active members. Reassign or remove all members before deleting this department.'
      )
      expect(departmentRepository.deleteById).not.toHaveBeenCalled()
    })
  })
})
