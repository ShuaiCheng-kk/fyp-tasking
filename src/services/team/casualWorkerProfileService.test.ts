import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/team/casualWorkerProfileRepository', () => ({
  casualWorkerProfileRepository: {
    getCertificatesByUserId: vi.fn(),
  },
}))

import { casualWorkerProfileService } from './casualWorkerProfileService'
import { casualWorkerProfileRepository } from '@/repositories/team/casualWorkerProfileRepository'

describe('casualWorkerProfileService — CW Detail card certificates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when user_id is missing', async () => {
    await expect(casualWorkerProfileService.getCertificates('')).rejects.toThrow('user_id is required')
    expect(casualWorkerProfileRepository.getCertificatesByUserId).not.toHaveBeenCalled()
  })

  it('returns the certificates the repository resolves for the worker', async () => {
    const certs = [
      { id: 'c1', user_id: 'cw-1', name: 'Food Hygiene Certificate', file_url: 'https://x/food.pdf', created_at: '2026-07-01T00:00:00Z' },
      { id: 'c2', user_id: 'cw-1', name: 'First Aid Certificate (CPR + AED)', file_url: null, created_at: '2026-07-02T00:00:00Z' },
    ]
    vi.mocked(casualWorkerProfileRepository.getCertificatesByUserId).mockResolvedValue(certs)

    const result = await casualWorkerProfileService.getCertificates('cw-1')

    expect(casualWorkerProfileRepository.getCertificatesByUserId).toHaveBeenCalledWith('cw-1')
    expect(result).toEqual(certs)
  })
})
