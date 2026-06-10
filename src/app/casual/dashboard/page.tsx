'use client'

export default function WorkerDashboardPage() {
  return (
    <>
      <header style={topBarStyle}>
        <h1 style={titleStyle}>Dashboard</h1>
        <div style={userStyle}>
          <span>Casual Worker</span>
        </div>
      </header>

      <main style={pageStyle}>
        <section style={sectionStyle}>
          <p style={sectionLabelStyle}>UPCOMING WORK</p>
          <p style={emptyTextStyle}>No upcoming shifts assigned.</p>

          <p style={sectionLabelStyle}>PENDING INVITATIONS</p>
          <p style={emptyTextStyle}>No pending invitations.</p>

          <p style={sectionLabelStyle}>RECENT ACTIVITY</p>
          <p style={emptyTextStyle}>No recent activity.</p>
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

const sectionStyle: React.CSSProperties = {
  maxWidth: 900,
}

const sectionLabelStyle: React.CSSProperties = {
  margin: '0 0 20px',
  marginTop: 28,
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