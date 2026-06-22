// Canonical panel primitive — lifted from src/app/owner/team/page.tsx. Do not redesign here.

export default function SectionBlock({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: subtitle ? 12 : 18 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.2px' }}>{title}</p>
          {subtitle && <p style={{ fontSize: 12, fontWeight: 500, color: '#64748B', margin: '3px 0 0' }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}
