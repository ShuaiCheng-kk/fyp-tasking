// Canonical toast primitive — lifted from src/app/owner/team/page.tsx (4 duplicated inline copies
// consolidated into this one component). Do not redesign here.

import { Check } from 'lucide-react'
import { toastKeyframes } from '@/components/theme/tokens'

export default function Toast({ message }: { message: string }) {
  if (!message) return null
  return (
    <>
      <div style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: '#0F172A',
        color: '#FFFFFF',
        borderRadius: 12,
        padding: '12px 20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        animation: 'fadeSlideUpToast 0.22s ease',
        pointerEvents: 'none',
      }}>
        <Check size={15} style={{ color: '#10B981', flexShrink: 0 }} />
        {message}
      </div>
      <style>{toastKeyframes}</style>
    </>
  )
}
