// Canonical modal primitive — lifted from src/app/owner/team/page.tsx. Do not redesign here.

import { modalKeyframes } from '@/components/theme/tokens'

export default function ModalOverlay({ children, onClose, maxWidth = '540px' }: { children: React.ReactNode; onClose: () => void; maxWidth?: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        animation: 'overlayFadeIn 0.18s ease-out',
      }}
    >
      <style>{modalKeyframes}</style>
      <div style={{ width: `min(${maxWidth}, calc(100% - 32px))` }}>
        {children}
      </div>
    </div>
  )
}
