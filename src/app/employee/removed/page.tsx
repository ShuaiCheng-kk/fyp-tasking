'use client'
import { useRouter } from 'next/navigation'

export default function EmployeeRemovedPage() {
  const router = useRouter()

  const handleExit = () => {
    localStorage.clear()
    router.push('/')
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#FFFFFF',
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
          You have been removed from this company. Your account has been deleted.
        </p>
        <button
          onClick={handleExit}
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
