'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const ROLE_DASHBOARD: Record<string, string> = {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.clear()
        router.replace('/signin')
      }
    })

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        // Session gone — check if this is a deleted account (no company_members)
        // by trying /api/user/me which will 401; show deleted modal if so.
        // Since we have no session we cannot identify the user, so just redirect.
        router.replace('/')
        return
      }
      const res = await fetch(`/api/user/me?user_id=${session.user.id}`)
      if (res.status === 404) {
        // User's own account no longer exists in DB — account was deleted
        setShowDeletedModal(true)
        setChecking(false)
        return
      }
      const data = await res.json()
      const role: string = data.success ? (data.user?.role ?? '') : ''
      const redirect = ROLE_DASHBOARD[role]
      if (redirect) {
        router.replace(redirect)
      } else {
        setChecking(false)
      }
    })

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

  return <>{children}</>
}
