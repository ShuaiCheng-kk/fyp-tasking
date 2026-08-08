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
    findByCompanyId: vi.fn(),
    updateById: vi.fn(),
  },
}))

import { companyService } from './companyService'
import { departmentRepository } from '@/repositories/department/departmentRepository'

describe('UC23 Edit Department', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC23-M-UT-O: Owner edits a department\'s name and color', async () => {
    vi.mocked(departmentRepository.findById).mockResolvedValue({
      id: 'dept-1', company_id: 'comp-1', name: 'Marketing', color: '#3B82F6',
    } as never)
    vi.mocked(departmentRepository.findByCompanyId).mockResolvedValue([
      { id: 'dept-1', company_id: 'comp-1', name: 'Marketing', color: '#3B82F6' } as never,
      { id: 'dept-2', company_id: 'comp-1', name: 'Sales', color: '#F97316' } as never,
    ])
    vi.mocked(departmentRepository.updateById).mockResolvedValue(undefined as never)

    await companyService.updateDepartment('dept-1', 'Growth Marketing', '#22C55E', 'comp-1')

    expect(departmentRepository.updateById).toHaveBeenCalledWith('dept-1', 'Growth Marketing', '#22C55E')
  })

  it('UC23-BR-UT-O: Owner is blocked from renaming a department to a name that clashes with another department', async () => {
    vi.mocked(departmentRepository.findById).mockResolvedValue({
      id: 'dept-1', company_id: 'comp-1', name: 'Marketing', color: '#3B82F6',
    } as never)
    vi.mocked(departmentRepository.findByCompanyId).mockResolvedValue([
      { id: 'dept-1', company_id: 'comp-1', name: 'Marketing', color: '#3B82F6' } as never,
      { id: 'dept-2', company_id: 'comp-1', name: 'Sales', color: '#F97316' } as never,
    ])

    await expect(companyService.updateDepartment('dept-1', 'sales', '#3B82F6', 'comp-1'))
      .rejects.toThrow('A department named "sales" already exists')

    expect(departmentRepository.updateById).not.toHaveBeenCalled()
  })
})
