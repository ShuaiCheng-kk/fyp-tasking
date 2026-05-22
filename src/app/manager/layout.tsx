'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const ROLE_DASHBOARD: Record<string, string> = {
  Owner: '/owner/dashboard',
  Employee: '/employee/dashboard',
  'Casual Worker': '/casual/dashboard',
}

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [accountRemoved, setAccountRemoved] = useState(false)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Detect session invalidation caused by owner removing this manager's account
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setAccountRemoved(true)
      }
    })

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/signin')
        return
      }
      const res = await fetch(`/api/user/me?user_id=${session.user.id}`)
      if (res.status === 401) {
        localStorage.clear()
        router.replace('/signin')
        return
      }
      const data = await res.json()
      const role: string = data.success ? (data.user?.role ?? '') : ''
      if (role === 'Manager') {
        setChecking(false)
      } else {
        router.replace(ROLE_DASHBOARD[role] ?? '/signin')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const handleAccountRemovedExit = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    localStorage.clear()
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (accountRemoved) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '40px 48px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.18)',
          maxWidth: '460px',
          textAlign: 'center',
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: '#FEF2F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4M12 17h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="9" stroke="#EF4444" strokeWidth="2" />
            </svg>
          </div>
          <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: '0 0 12px' }}>
            Your account has been removed
          </h2>
          <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.6, margin: '0 0 24px' }}>
            Your account has been removed from the company. Thank you for using Tasking.
          </p>
          <button
            onClick={handleAccountRemovedExit}
            style={{
              padding: '10px 28px',
              background: '#111827',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9375rem',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            Exit
          </button>
        </div>
      </div>
    )
  }

  if (checking) return null

  return <>{children}</>
}
