'use client'

import { useEffect } from 'react'
import Link from 'next/link'

// ─── Design tokens ────────────────────────────────────────────────────────────

const fH = 'var(--font-heading)'
const fB = 'var(--font-body)'

// ─── Logo ─────────────────────────────────────────────────────────────────────

function TaskingLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '36px' }}>
      <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#F97316" />
        <rect x="8" y="9" width="9" height="2.5" rx="1.25" fill="white" />
        <rect x="8" y="14.75" width="16" height="2.5" rx="1.25" fill="white" />
        <rect x="8" y="20.5" width="12" height="2.5" rx="1.25" fill="white" />
        <circle cx="22" cy="10.25" r="3.5" fill="#10B981" />
        <path d="M20.3 10.25L21.5 11.5L23.8 9" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.375rem', color: '#1C1917' }}>Tasking</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SignOutPage() {
  useEffect(() => {
    localStorage.removeItem('tasking_user_id')
    localStorage.removeItem('tasking_user_role')
    localStorage.removeItem('tasking_company_id')
    localStorage.removeItem('tasking_active_session')
    sessionStorage.removeItem('tasking_session_active')
  }, [])

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FFFBF5',
      padding: '40px 24px',
    }}>
      <TaskingLogo />

      <h1 style={{
        fontFamily: fH,
        fontWeight: 700,
        fontSize: '2rem',
        color: '#1C1917',
        marginBottom: '12px',
        textAlign: 'center',
      }}>
        You&#39;ve been signed out.
      </h1>

      <p style={{
        fontFamily: fB,
        fontSize: '1.0625rem',
        color: '#78716C',
        marginBottom: '36px',
        textAlign: 'center',
        lineHeight: 1.65,
      }}>
        Thanks for using Tasking. See you next time.
      </p>

      <Link
        href="/signin"
        style={{
          display: 'inline-block',
          background: '#F97316',
          color: '#FFFFFF',
          fontFamily: fB,
          fontWeight: 700,
          fontSize: '1rem',
          padding: '14px 40px',
          borderRadius: '10px',
          textDecoration: 'none',
          marginBottom: '20px',
          transition: 'opacity 0.15s',
        }}
      >
        Sign In
      </Link>

      <Link
        href="/"
        style={{
          fontFamily: fB,
          fontSize: '0.9375rem',
          color: '#78716C',
          textDecoration: 'none',
        }}
      >
        Back to homepage
      </Link>
    </div>
  )
}
