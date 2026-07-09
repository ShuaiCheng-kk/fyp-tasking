import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {}, createClient: () => ({}) }))

vi.mock('@/repositories/userAdminRepository', () => ({
  getAllCompanies: vi.fn(),
  getCompanyDetail: vi.fn(),
  getAllUsers: vi.fn(),
  suspendCompany: vi.fn(),
  unsuspendCompany: vi.fn(),
  suspendUser: vi.fn(),
  unsuspendUser: vi.fn(),
  getUserById: vi.fn(),
}))

import * as repo from '@/repositories/userAdminRepository'
import {
  listCompanies,
  getCompanyDetail,
  listUsers,
  suspendCompany,
  unsuspendCompany,
  suspendUser,
  unsuspendUser,
} from './userAdminService'

beforeEach(() => vi.clearAllMocks())

describe('listCompanies', () => {
  it('returns companies from repository', async () => {
    const mock = [{ id: '1', name: 'Acme' }]
    vi.mocked(repo.getAllCompanies).mockResolvedValue(mock as never)
    const result = await listCompanies()
    expect(result).toEqual(mock)
  })

  it('passes search term to repository', async () => {
    vi.mocked(repo.getAllCompanies).mockResolvedValue([])
    await listCompanies('acme')
    expect(repo.getAllCompanies).toHaveBeenCalledWith('acme')
  })
})

describe('getCompanyDetail', () => {
  it('throws if company_id is empty', async () => {
    await expect(getCompanyDetail('')).rejects.toThrow('Company ID is required')
  })

  it('returns company detail from repository', async () => {
    const mock = { id: '1', name: 'Acme', member_count: 5, owner_name: 'Alice', owner_email: 'alice@acme.com' }
    vi.mocked(repo.getCompanyDetail).mockResolvedValue(mock as never)
    const result = await getCompanyDetail('1')
    expect(result).toEqual(mock)
  })
})

describe('listUsers', () => {
  it('returns users from repository', async () => {
    const mock = [{ id: 'u1', full_name: 'Alice' }]
    vi.mocked(repo.getAllUsers).mockResolvedValue(mock as never)
    const result = await listUsers()
    expect(result).toEqual(mock)
  })
})

describe('suspendCompany', () => {
  it('throws if company_id is missing', async () => {
    await expect(suspendCompany({ company_id: '', reason: 'test' })).rejects.toThrow('Company ID is required')
  })

  it('throws if reason is empty', async () => {
    await expect(suspendCompany({ company_id: '1', reason: '  ' })).rejects.toThrow('Suspension reason is required')
  })

  it('calls repo with trimmed reason', async () => {
    vi.mocked(repo.suspendCompany).mockResolvedValue(undefined)
    await suspendCompany({ company_id: '1', reason: '  Fraud  ' })
    expect(repo.suspendCompany).toHaveBeenCalledWith('1', 'Fraud')
  })
})

describe('unsuspendCompany', () => {
  it('throws if company_id is missing', async () => {
    await expect(unsuspendCompany({ company_id: '' })).rejects.toThrow('Company ID is required')
  })

  it('calls repo', async () => {
    vi.mocked(repo.unsuspendCompany).mockResolvedValue(undefined)
    await unsuspendCompany({ company_id: '1' })
    expect(repo.unsuspendCompany).toHaveBeenCalledWith('1')
  })
})

describe('suspendUser', () => {
  it('throws if user_id is missing', async () => {
    await expect(suspendUser({ user_id: '', reason: 'test' })).rejects.toThrow('User ID is required')
  })

  it('throws if reason is empty', async () => {
    await expect(suspendUser({ user_id: 'u1', reason: '' })).rejects.toThrow('Suspension reason is required')
  })

  it('calls repo', async () => {
    vi.mocked(repo.suspendUser).mockResolvedValue(undefined)
    await suspendUser({ user_id: 'u1', reason: 'Abuse' })
    expect(repo.suspendUser).toHaveBeenCalledWith('u1', 'Abuse')
  })
})

describe('unsuspendUser', () => {
  it('throws if user_id is missing', async () => {
    await expect(unsuspendUser({ user_id: '' })).rejects.toThrow('User ID is required')
  })

  it('calls repo', async () => {
    vi.mocked(repo.unsuspendUser).mockResolvedValue(undefined)
    await unsuspendUser({ user_id: 'u1' })
    expect(repo.unsuspendUser).toHaveBeenCalledWith('u1')
  })
})
