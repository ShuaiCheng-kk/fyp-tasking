import { loginAttemptRepository } from '@/repositories/auth/loginAttemptRepository'

// BUG-069: no rate limiting or account lockout on repeated failed sign-in attempts. Email-keyed
// (not IP-keyed) — the standard account-lockout approach, and the one CLAUDE.md's testing log
// asked for ("账号锁定策略"). Deliberately simple thresholds; tune here if they turn out too
// strict/loose in practice.
const MAX_ATTEMPTS = 5
const FAILURE_WINDOW_MS = 15 * 60 * 1000 // failures older than this don't count toward the threshold
const LOCKOUT_MS = 15 * 60 * 1000 // how long an account stays locked once triggered

export const loginLockoutService = {

  async checkLocked(email: string): Promise<{ locked: boolean; retryAfterSeconds?: number }> {
    const row = await loginAttemptRepository.get(email)
    if (!row?.locked_until) return { locked: false }
    const remainingMs = new Date(row.locked_until).getTime() - Date.now()
    if (remainingMs <= 0) return { locked: false }
    return { locked: true, retryAfterSeconds: Math.ceil(remainingMs / 1000) }
  },

  async recordFailure(email: string): Promise<void> {
    const now = new Date()
    const existing = await loginAttemptRepository.get(email)
    const windowExpired = !!existing && (now.getTime() - new Date(existing.first_failed_at).getTime() > FAILURE_WINDOW_MS)
    const startingFresh = !existing || windowExpired

    const failed_count = startingFresh ? 1 : existing!.failed_count + 1
    const first_failed_at = startingFresh ? now.toISOString() : existing!.first_failed_at
    const locked_until = failed_count >= MAX_ATTEMPTS
      ? new Date(now.getTime() + LOCKOUT_MS).toISOString()
      : (startingFresh ? null : existing!.locked_until)

    await loginAttemptRepository.upsert({ email, failed_count, first_failed_at, locked_until })
  },

  async clear(email: string): Promise<void> {
    await loginAttemptRepository.clear(email)
  },

}
