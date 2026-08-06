import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/importRepository', () => ({
  importRepository: {
    getDepartmentsByCompany: vi.fn(),
  },
}))

vi.mock('@/services/invitation/invitationService', () => ({
  invitationService: {
    sendInvite: vi.fn(),
  },
}))

import { importService } from './importService'
import { importRepository } from '@/repositories/owner/importRepository'
import { invitationService } from '@/services/invitation/invitationService'

describe('UC31 Invite Members by CSV', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(importRepository.getDepartmentsByCompany).mockResolvedValue([
      { id: 'dept-1', company_id: 'comp-1', name: 'Marketing', color: '#3B82F6' } as never,
    ])
  })

  it('UC31-M-UT-O: Owner bulk-invites a valid CSV of members', async () => {
    vi.mocked(invitationService.sendInvite).mockResolvedValue(undefined as never)

    const result = await importService.importMembers({
      company_id: 'comp-1',
      invited_by: 'owner-1',
      members: [
        { email: 'newpartner@test.com', role: 'Partner', department_name: '' },
        { email: 'newmanager@test.com', role: 'Manager', department_name: 'Marketing' },
      ] as never,
    })

    expect(result.invited).toEqual(['newpartner@test.com', 'newmanager@test.com'])
    expect(result.failed).toEqual([])
    expect(invitationService.sendInvite).toHaveBeenCalledTimes(2)
    expect(invitationService.sendInvite).toHaveBeenCalledWith(expect.objectContaining({ email: 'newmanager@test.com', department_id: 'dept-1' }))
  })

  it('UC31-M-UT-P: Partner bulk-invites a valid CSV of members', async () => {
    vi.mocked(invitationService.sendInvite).mockResolvedValue(undefined as never)

    const result = await importService.importMembers({
      company_id: 'comp-1',
      invited_by: 'partner-1',
      members: [
        { email: 'newemployee@test.com', role: 'Employee', department_name: 'Marketing' },
      ] as never,
    })

    expect(result.invited).toEqual(['newemployee@test.com'])
    expect(result.failed).toEqual([])
  })

  it('UC31-A1-UT-O: Owner uploads a CSV with some invalid rows, which are skipped while valid rows still get invited', async () => {
    vi.mocked(invitationService.sendInvite).mockResolvedValue(undefined as never)

    const result = await importService.importMembers({
      company_id: 'comp-1',
      invited_by: 'owner-1',
      members: [
        { email: 'good@test.com', role: 'Manager', department_name: 'Marketing' },
        { email: 'not-an-email', role: 'Manager', department_name: 'Marketing' },
        { email: 'wrongrole@test.com', role: 'CEO', department_name: 'Marketing' },
        { email: 'nodept@test.com', role: 'Employee', department_name: 'Nonexistent Department' },
      ] as never,
    })

    expect(result.invited).toEqual(['good@test.com'])
    expect(result.failed).toEqual([
      { email: 'not-an-email', message: 'Invalid email address' },
      { email: 'wrongrole@test.com', message: 'Unsupported role: CEO' },
      { email: 'nodept@test.com', message: 'Department not found' },
    ])
    expect(invitationService.sendInvite).toHaveBeenCalledTimes(1)
  })

  it('UC31-A1-UT-P: Partner uploads a CSV with some invalid rows, which are skipped while valid rows still get invited', async () => {
    vi.mocked(invitationService.sendInvite).mockResolvedValue(undefined as never)

    const result = await importService.importMembers({
      company_id: 'comp-1',
      invited_by: 'partner-1',
      members: [
        { email: 'good2@test.com', role: 'Partner', department_name: '' },
        { email: 'bad-email-2', role: 'Manager', department_name: 'Marketing' },
      ] as never,
    })

    expect(result.invited).toEqual(['good2@test.com'])
    expect(result.failed).toEqual([
      { email: 'bad-email-2', message: 'Invalid email address' },
    ])
    expect(invitationService.sendInvite).toHaveBeenCalledTimes(1)
  })
})
