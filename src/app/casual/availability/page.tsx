'use client'

export default function CasualAvailabilityPage() {
  return (
    <>
      <header style={topBarStyle}>
        <h1 style={titleStyle}>Availability</h1>
        <div style={userStyle}>
          <span>Casual Worker</span>
        </div>
      </header>

      <main style={pageStyle}>
        <section>
          <p style={sectionLabelStyle}>AVAILABILITY</p>
          <p style={emptyTextStyle}>You have not set your availability yet.</p>
        </section>
      </main>
    </>
  )
}

const topBarStyle: React.CSSProperties = {
  height: 92,
  background: '#16A34A',
  color: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 48px',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: '1.5rem',
  fontWeight: 700,
}

const userStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.18)',
  fontWeight: 700,
}

const pageStyle: React.CSSProperties = {
  minHeight: 'calc(100vh - 92px)',
  background: '#ECFDF3',
  padding: '42px 48px',
  fontFamily: 'var(--font-body)',
}

const sectionLabelStyle: React.CSSProperties = {
  margin: 0,
  marginBottom: 20,
  fontFamily: 'var(--font-heading)',
  fontSize: '1rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  color: '#4B5563',
}

const emptyTextStyle: React.CSSProperties = {
  margin: 0,
  color: '#9CA3AF',
  fontSize: '1rem',
}