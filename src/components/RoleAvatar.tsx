// Canonical role-avatar primitive — lifted from src/app/owner/team/page.tsx. Do not redesign here.

import { Crown, UserCog, UserRound, HardHat } from 'lucide-react'

export default function RoleAvatar({ role, size = 36, photoUrl }: { role: string; size?: number; photoUrl?: string | null }) {
  if (photoUrl) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: 999, flexShrink: 0, overflow: 'hidden' }}>
        <img src={photoUrl} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </span>
    )
  }
  const cfg: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
    Owner:   { bg: '#0F172A', color: '#FFFFFF',  icon: <Crown    size={size * 0.42} /> },
    Partner: { bg: '#0F172A', color: '#FFFFFF',  icon: <Crown    size={size * 0.42} /> },
    Manager: { bg: '#FFF7ED', color: '#EA580C',  icon: <UserCog  size={size * 0.42} /> },
    Employee:{ bg: '#F3F4F6', color: '#4B5563',  icon: <UserRound size={size * 0.42} /> },
    'Casual Worker': { bg: '#EFF6FF', color: '#2563EB', icon: <HardHat size={size * 0.42} /> },
  }
  const { bg, color, icon } = cfg[role] ?? { bg: '#F3F4F6', color: '#6B7280', icon: <UserRound size={size * 0.42} /> }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: 999, background: bg, color, flexShrink: 0 }}>
      {icon}
    </span>
  )
}
