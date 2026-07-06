'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const ROLE_DASHBOARD: Record<string, string> = {
  Partner: '/partner/dashboard',
  Manager: '/manager/dashboard',
  Employee: '/employee/dashboard',
  'Casual Worker': '/casual/dashboard',
}

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [showDeletedModal, setShowDeletedModal] = useState(false)

  const handleExit = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    localStorage.clear()
    await supabase.auth.signOut()
    router.replace('/')
  }

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const clearAndRedirect = () => {
      localStorage.removeItem('tasking_user_id')
      localStorage.removeItem('tasking_company_id')
      localStorage.removeItem('tasking_active_session')
      localStorage.removeItem('tasking_user_role')
      router.replace('/signin')
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') clearAndRedirect()
      if (event === 'TOKEN_REFRESHED' && !session) clearAndRedirect()
    })

    supabase.auth.getSession().then(({ error }) => {
      if (error?.message?.toLowerCase().includes('refresh token')) clearAndRedirect()
    })

    async function checkAuth() {
      // Use the Supabase session as the authoritative source.
      // createBrowserClient reads from cookies (set by the SSR signin route).
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id ?? localStorage.getItem('tasking_user_id')

      if (!userId) {
        router.replace('/')
        return
      }

      const res = await fetch(`/api/user/me?user_id=${userId}`)
      if (res.status === 404) {
        setShowDeletedModal(true)
        setChecking(false)
        return
      }
      const data = await res.json()
      const role: string = data.success ? (data.user?.role ?? '') : ''
      const redirect = ROLE_DASHBOARD[role]
      if (redirect) {
        router.replace(redirect)
      } else if (!data.success || !role) {
        router.replace('/')
      } else {
        setChecking(false)
      }
    }

    checkAuth()

    return () => subscription.unsubscribe()
  }, [router])

  if (showDeletedModal) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
        }}
      >
        <div style={{ width: '440px', background: '#FFFFFF', borderRadius: '16px', padding: '36px 32px', boxShadow: '0 8px 40px rgba(0,0,0,0.16)' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.125rem', color: '#111827', margin: '0 0 12px' }}>
            Your account has been removed
          </h2>
          <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.6, margin: '0 0 28px' }}>
            You have been removed from your last company. Your account has been permanently deleted.
          </p>
          <button
            onClick={handleExit}
            style={{
              width: '100%',
              height: '48px',
              background: '#F97316',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.9375rem',
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

  return <div className="owner-layout">{children}</div>
}