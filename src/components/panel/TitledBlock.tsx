// Canonical titled-block primitive — matches the Owner pages' block language (reference:
// the Activity Log / Departments blocks on src/app/owner/team/page.tsx): white card with
// 1px #E5E7EB border, radius 14, soft shadow, padding 18/24/20; header row of a 30x30 icon
// badge (radius 9, #FFF7ED) + 18px/700 #0F172A title, then an inset divider, then the body.
// Do not redesign here. No subtitles — the title and icon must be self-explanatory.

export default function TitledBlock({
  icon,
  title,
  titleHint,
  headerRight,
  containerStyle,
  bodyStyle,
  children,
}: {
  icon: React.ReactNode
  title: string
  // Opt-in small pill directly beside the title — only for a non-obvious interaction affordance
  // (e.g. "drag cards to move"), never a descriptive caption. Omitted by every other caller, so
  // the default title-only rendering is unchanged everywhere else.
  titleHint?: React.ReactNode
  // Right-aligned header slot (e.g. an Edit button, a refresh icon, a status pill).
  headerRight?: React.ReactNode
  // Outer overrides for host-specific states (e.g. a highlighted orange border).
  containerStyle?: React.CSSProperties
  bodyStyle?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: '18px 24px 20px', boxSizing: 'border-box', ...containerStyle }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>{title}</span>
        {titleHint}
        {headerRight && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{headerRight}</div>
        )}
      </div>
      <div style={{ borderTop: '1px solid #E5E7EB', marginBottom: 14, flexShrink: 0 }} />
      <div style={bodyStyle}>{children}</div>
    </div>
  )
}
