import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/importRepository', () => ({
  importRepository: {
    getDepartmentsByCompany: vi.fn(),
    createDepartment: vi.fn(),
  },
}))

// importService.ts also imports invitationService (for importMembers) — mocked here purely to
// keep its real module chain (which constructs a Resend client at import time) from loading.
vi.mock('@/services/invitation/invitationService', () => ({
  invitationService: {
    sendInvite: vi.fn(),
  },
}))

import { importService } from './importService'
import { importRepository } from '@/repositories/owner/importRepository'

describe('UC32 Import Departments by CSV', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(importRepository.createDepartment).mockResolvedValue({} as never)
  })

  it('UC32-M-UT-O: Owner bulk-creates departments from a CSV of new names', async () => {
    vi.mocked(importRepository.getDepartmentsByCompany).mockResolvedValue([])

    const result = await importService.importDepartments('comp-1', ['Marketing', 'Finance'])

    expect(result).toEqual({ created: ['Marketing', 'Finance'], skipped: [] })
    expect(importRepository.createDepartment).toHaveBeenCalledTimes(2)
  })

  it('UC32-BR-UT-O: Owner\'s CSV name matching an existing department (case-insensitive) is silently skipped', async () => {
    vi.mocked(importRepository.getDepartmentsByCompany).mockResolvedValue([
      { id: 'dept-1', company_id: 'comp-1', name: 'Marketing', color: '#3B82F6' } as never,
    ])

    const result = await importService.importDepartments('comp-1', ['marketing', 'Sales'])

    expect(result).toEqual({ created: ['Sales'], skipped: ['marketing'] })
    expect(importRepository.createDepartment).toHaveBeenCalledTimes(1)
    expect(importRepository.createDepartment).toHaveBeenCalledWith('comp-1', 'Sales', expect.any(String))
  })
})
