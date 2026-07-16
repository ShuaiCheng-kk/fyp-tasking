// Canonical panel primitive — lifted from src/app/owner/team/page.tsx (originally "TeamShowcaseCard"),
// generalized name only (props unchanged). Do not redesign here.

import { Search } from 'lucide-react'

export default function ShowcaseCard({
  icon,
  iconBg = '#FFF7ED',
  title,
  rightContent,
  actions,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  fillHeight,
  className,
  children,
}: {
  icon: React.ReactNode
  iconBg?: string
  title: string
  rightContent?: React.ReactNode
  actions?: React.ReactNode
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  fillHeight?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className} style={{ flex: fillHeight ? 1 : undefined, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ minHeight: 78, padding: '20px 24px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0, flex: 1 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.2px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
          </div>
          {rightContent}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          {actions}
          {onSearchChange && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
              <input
                value={searchValue ?? ''}
                onChange={e => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                style={{ width: 180, height: 34, borderRadius: 999, border: '1px solid #E5E7EB', background: '#F9FAFB', padding: '0 12px 0 32px', fontSize: 13, color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#FFFFFF' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB' }}
              />
            </div>
          )}
        </div>
      </div>
      <div style={{ borderTop: '1px solid #E5E7EB', flexShrink: 0 }} />
      <div style={{ flex: 1, minHeight: 0, padding: '18px 24px 20px', overflowY: fillHeight ? 'auto' : undefined }}>
        {children}
      </div>
    </div>
  )
}
