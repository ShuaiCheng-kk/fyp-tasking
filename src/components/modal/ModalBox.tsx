// Canonical modal primitive — lifted from src/app/owner/team/page.tsx. Do not redesign here.

export default function ModalBox({ children, closing = false }: { children: React.ReactNode; closing?: boolean }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 20,
      overflow: 'hidden',
      boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)',
      maxHeight: '90vh',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      animation: `${closing ? 'modalSlideOut' : 'modalSlideIn'} 0.22s cubic-bezier(0.16,1,0.3,1)`,
    }}>
      {children}
    </div>
  )
}
