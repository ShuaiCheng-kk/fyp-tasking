// Shared empty-state block (BUG-012) — before this, every panel wrote its own inline empty-state
// markup and at least 3 different visual patterns had drifted into the app simultaneously: a
// muted gray box with icon+text, a colored icon-box floating on white, and bare icon+text with no
// container at all. 'subtle' below is the canonical style already documented in this folder's
// index.ts spec comment; 'iconBox' and 'plain' cover the other two patterns that were already in
// real use (a "select something" prompt on a detail panel, and a bare inline message respectively)
// rather than force everything into one shape that doesn't fit its container.
type EmptyStateProps = {
  icon: React.ReactNode
  message: string
  // Second, quieter line under the message — e.g. iconBox's "how do I do this" hint.
  subtitle?: string
  variant?: 'subtle' | 'iconBox' | 'plain'
  // Fill the parent flex container's remaining space instead of a fixed minHeight — use when this
  // is the sole content of a flex:1 panel body.
  fill?: boolean
}

export default function EmptyState({ icon, message, subtitle, variant = 'subtle', fill = false }: EmptyStateProps) {
  if (variant === 'iconBox') {
    return (
      <div style={{ flex: fill ? 1 : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', color: '#94A3B8' }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: '#F97316' }}>
            {icon}
          </div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{message}</p>
          {subtitle && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>{subtitle}</p>}
        </div>
      </div>
    )
  }

  if (variant === 'plain') {
    return (
      <div style={{ flex: fill ? 1 : undefined, minHeight: fill ? undefined : 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#9CA3AF', fontWeight: 600, fontSize: 13, textAlign: 'center' }}>
        {icon}
        <span>{message}</span>
      </div>
    )
  }

  // 'subtle' — the canonical style already documented at src/components/panel/index.ts
  return (
    <div style={{ flex: fill ? 1 : undefined, minHeight: fill ? undefined : 120, padding: '32px 0', borderRadius: 14, background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 8, fontWeight: 600, fontSize: 13, textAlign: 'center' }}>
      {icon}
      <span>{message}</span>
    </div>
  )
}
