'use client'

import ManagerSidebar from '@/components/ManagerSidebar'

export default function ManagerSettingsPage() {
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <ManagerSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '18px 32px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#111827', margin: 0 }}>Settings</h1>
        </div>

        <div style={{ padding: '28px 32px', flex: 1 }}>
          <p style={{ color: '#9CA3AF', fontSize: '0.9375rem' }}>Account settings coming soon.</p>
        </div>
      </main>
    </div>
  )
}
