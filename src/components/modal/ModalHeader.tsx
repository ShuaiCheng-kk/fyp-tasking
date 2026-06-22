// Canonical modal primitive — lifted from src/app/owner/team/page.tsx. Do not redesign here.

import { X } from 'lucide-react'

export default function ModalHeader({ title, icon, iconBg, onClose }: { title: string; icon?: React.ReactNode; iconBg?: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && (
          <div style={{ width: 32, height: 32, borderRadius: 9, background: iconBg ?? 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </div>
        )}
        <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>{title}</h2>
      </div>
      <button
        onClick={onClose}
        style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8, flexShrink: 0 }}
        onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
      >
        <X size={16} />
      </button>
    </div>
  )
}
