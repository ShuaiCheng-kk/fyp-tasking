import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
    },
  },
  createClient: () => ({}),
}))

import { authService } from './authService'
import { supabase } from '@/lib/supabase'

describe('UC75 Log Out', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC75-M-UT: Logging out ends the current session', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as never)

    await authService.signOut()

    expect(supabase.auth.signOut).toHaveBeenCalled()
  })

  it('UC75-BR-UT: A failure ending the session surfaces the underlying error instead of silently succeeding', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: { message: 'Network error' } } as never)

    await expect(authService.signOut()).rejects.toThrow('Network error')
  })
})
