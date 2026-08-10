import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {}, createClient: () => ({}) }))
vi.mock('@/lib/supabaseAdmin', () => ({ getSupabaseAdmin: () => ({}) }))

vi.mock('@/repositories/auth/loginAttemptRepository', () => ({
  loginAttemptRepository: {
    get: vi.fn(),
    upsert: vi.fn(),
    clear: vi.fn(),
  },
}))

import { loginLockoutService } from './loginLockoutService'
import { loginAttemptRepository } from '@/repositories/auth/loginAttemptRepository'

describe('loginLockoutService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-09T12:00:00.000Z'))
  })

  it('BUG069-UT-1: a fresh email is not locked', async () => {
    vi.mocked(loginAttemptRepository.get).mockResolvedValue(null)

    const result = await loginLockoutService.checkLocked('user@test.com')

    expect(result.locked).toBe(false)
  })

  it('BUG069-UT-2: the first four failures accumulate but do not lock the account', async () => {
    vi.mocked(loginAttemptRepository.get).mockResolvedValueOnce(null)
    await loginLockoutService.recordFailure('user@test.com')
    expect(loginAttemptRepository.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ failed_count: 1, locked_until: null }))

    vi.mocked(loginAttemptRepository.get).mockResolvedValueOnce({
      email: 'user@test.com', failed_count: 3, first_failed_at: '2026-08-09T12:00:00.000Z', locked_until: null,
    })
    await loginLockoutService.recordFailure('user@test.com')
    expect(loginAttemptRepository.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ failed_count: 4, locked_until: null }))
  })

  it('BUG069-UT-3: the 5th failure within the window locks the account for 15 minutes', async () => {
    vi.mocked(loginAttemptRepository.get).mockResolvedValue({
      email: 'user@test.com', failed_count: 4, first_failed_at: '2026-08-09T12:00:00.000Z', locked_until: null,
    })

    await loginLockoutService.recordFailure('user@test.com')

    expect(loginAttemptRepository.upsert).toHaveBeenCalledWith({
      email: 'user@test.com', failed_count: 5, first_failed_at: '2026-08-09T12:00:00.000Z',
      locked_until: '2026-08-09T12:15:00.000Z',
    })
  })

  it('BUG069-UT-4: checkLocked reports locked with seconds remaining while locked_until is in the future', async () => {
    vi.mocked(loginAttemptRepository.get).mockResolvedValue({
      email: 'user@test.com', failed_count: 5, first_failed_at: '2026-08-09T11:50:00.000Z',
      locked_until: '2026-08-09T12:05:00.000Z',
    })

    const result = await loginLockoutService.checkLocked('user@test.com')

    expect(result).toEqual({ locked: true, retryAfterSeconds: 300 })
  })

  it('BUG069-UT-5: checkLocked reports unlocked once locked_until has passed', async () => {
    vi.mocked(loginAttemptRepository.get).mockResolvedValue({
      email: 'user@test.com', failed_count: 5, first_failed_at: '2026-08-09T11:00:00.000Z',
      locked_until: '2026-08-09T11:15:00.000Z',
    })

    const result = await loginLockoutService.checkLocked('user@test.com')

    expect(result.locked).toBe(false)
  })

  it('BUG069-UT-6: a failure outside the rolling window restarts the count instead of accumulating', async () => {
    vi.mocked(loginAttemptRepository.get).mockResolvedValue({
      email: 'user@test.com', failed_count: 4, first_failed_at: '2026-08-09T11:00:00.000Z', locked_until: null,
    })

    await loginLockoutService.recordFailure('user@test.com')

    expect(loginAttemptRepository.upsert).toHaveBeenCalledWith({
      email: 'user@test.com', failed_count: 1, first_failed_at: '2026-08-09T12:00:00.000Z', locked_until: null,
    })
  })

  it('BUG069-UT-7: clear removes the account\'s failure record after a successful sign-in', async () => {
    await loginLockoutService.clear('user@test.com')

    expect(loginAttemptRepository.clear).toHaveBeenCalledWith('user@test.com')
  })
})
