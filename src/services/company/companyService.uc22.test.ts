import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/department/departmentRepository', () => ({
  departmentRepository: {
    createDepartment: vi.fn(),
    findByCompanyId: vi.fn(),
  },
}))

import { companyService } from './companyService'
import { departmentRepository } from '@/repositories/department/departmentRepository'

describe('UC22 Create Department', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC22-M-UT-O: Owner creates a new department', async () => {
    vi.mocked(departmentRepository.findByCompanyId).mockResolvedValue([
      { id: 'dept-existing', company_id: 'comp-1', name: 'Operations', color: '#F97316' } as never,
    ])
    const created = { id: 'dept-1', company_id: 'comp-1', name: 'Marketing', color: '#3B82F6' }
    vi.mocked(departmentRepository.createDepartment).mockResolvedValue(created as never)

    const result = await companyService.createDepartment({ company_id: 'comp-1', name: 'Marketing', color: '#3B82F6' })

    expect(result).toEqual(created)
    expect(departmentRepository.createDepartment).toHaveBeenCalledWith({ company_id: 'comp-1', name: 'Marketing', color: '#3B82F6' })
  })

  it('UC22-BR-UT-O: Owner is blocked from creating a department with a name that already exists in the company', async () => {
    vi.mocked(departmentRepository.findByCompanyId).mockResolvedValue([
      { id: 'dept-existing', company_id: 'comp-1', name: 'Marketing', color: '#3B82F6' } as never,
    ])

    await expect(companyService.createDepartment({ company_id: 'comp-1', name: 'marketing', color: '#3B82F6' }))
      .rejects.toThrow('A department named "marketing" already exists')

    expect(departmentRepository.createDepartment).not.toHaveBeenCalled()
  })
})
