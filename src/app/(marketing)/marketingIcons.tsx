// Shared icon registry for marketing pages and admin CMS picker.

export const MARKETING_ICON_NAMES = [
  'store', 'utensils', 'map-pin', 'calendar-check',
  'clock', 'camera', 'shield', 'star', 'zap', 'bell',
  'users', 'check-circle', 'lock', 'eye', 'search',
  'list', 'link', 'ban', 'grid', 'history',
  'org', 'file-plus', 'calendar', 'globe',
  'megaphone', 'timer', 'alert', 'pen',
] as const

export type MarketingIconName = typeof MARKETING_ICON_NAMES[number]

export function MarketingIcon({ name, size = 24, color = '#F97316' }: { name: string; size?: number; color?: string }) {
  const s = { width: size, height: size }
  const p = { stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'store':        return <svg {...s} viewBox="0 0 24 24" fill="none"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" {...p}/><line x1="3" y1="6" x2="21" y2="6" {...p}/><path d="M16 10a4 4 0 0 1-8 0" {...p}/></svg>
    case 'utensils':     return <svg {...s} viewBox="0 0 24 24" fill="none"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" {...p}/><path d="M7 2v20" {...p}/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" {...p}/></svg>
    case 'map-pin':      return <svg {...s} viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" {...p}/><circle cx="12" cy="10" r="3" {...p}/></svg>
    case 'calendar-check': return <svg {...s} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" {...p}/><line x1="16" y1="2" x2="16" y2="6" {...p}/><line x1="8" y1="2" x2="8" y2="6" {...p}/><line x1="3" y1="10" x2="21" y2="10" {...p}/><path d="m9 16 2 2 4-4" {...p}/></svg>
    case 'clock':        return <svg {...s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" {...p}/><path d="M12 6v6l4 2" {...p}/></svg>
    case 'camera':       return <svg {...s} viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" {...p}/><circle cx="12" cy="13" r="4" {...p}/></svg>
    case 'shield':       return <svg {...s} viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...p}/><path d="M9 12l2 2 4-4" {...p}/></svg>
    case 'star':         return <svg {...s} viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" {...p}/></svg>
    case 'zap':          return <svg {...s} viewBox="0 0 24 24" fill="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" {...p}/></svg>
    case 'bell':         return <svg {...s} viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...p}/><path d="M13.73 21a2 2 0 0 1-3.46 0" {...p}/></svg>
    case 'users':        return <svg {...s} viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...p}/><circle cx="9" cy="7" r="4" {...p}/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" {...p}/></svg>
    case 'check-circle': return <svg {...s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" {...p}/><path d="M8 12l3 3 5-5" {...p}/></svg>
    case 'lock':         return <svg {...s} viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" {...p}/><path d="M7 11V7a5 5 0 0 1 10 0v4" {...p}/></svg>
    case 'eye':          return <svg {...s} viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" {...p}/><circle cx="12" cy="12" r="3" {...p}/></svg>
    case 'search':       return <svg {...s} viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" {...p}/><path d="M21 21l-4.35-4.35" {...p}/></svg>
    case 'list':         return <svg {...s} viewBox="0 0 24 24" fill="none"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" {...p}/></svg>
    case 'link':         return <svg {...s} viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" {...p}/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" {...p}/></svg>
    case 'ban':          return <svg {...s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" {...p}/><path d="M4.93 4.93l14.14 14.14" {...p}/></svg>
    case 'grid':         return <svg {...s} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" {...p}/><rect x="14" y="3" width="7" height="7" rx="1" {...p}/><rect x="3" y="14" width="7" height="7" rx="1" {...p}/><rect x="14" y="14" width="7" height="7" rx="1" {...p}/></svg>
    case 'history':      return <svg {...s} viewBox="0 0 24 24" fill="none"><path d="M3 3v5h5" {...p}/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" {...p}/><path d="M12 7v5l3 3" {...p}/></svg>
    case 'org':          return <svg {...s} viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="8" height="5" rx="1" {...p}/><rect x="14" y="3" width="8" height="5" rx="1" {...p}/><rect x="8" y="16" width="8" height="5" rx="1" {...p}/><path d="M6 8v4h12V8M12 12v4" {...p}/></svg>
    case 'file-plus':    return <svg {...s} viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...p}/><path d="M14 2v6h6M12 18v-6M9 15h6" {...p}/></svg>
    case 'calendar':     return <svg {...s} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" {...p}/><path d="M16 2v4M8 2v4M3 10h18" {...p}/></svg>
    case 'globe':        return <svg {...s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" {...p}/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" {...p}/></svg>
    case 'megaphone':    return <svg {...s} viewBox="0 0 24 24" fill="none"><path d="M3 11l19-9-9 19-2-8-8-2z" {...p}/></svg>
    case 'timer':        return <svg {...s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" {...p}/><path d="M12 9v4l2.5 2.5" {...p}/><path d="M9 2h6M12 2v3" {...p}/></svg>
    case 'alert':        return <svg {...s} viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" {...p}/><path d="M12 9v4M12 17h.01" {...p}/></svg>
    case 'pen':          return <svg {...s} viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" {...p}/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" {...p}/></svg>
    default:             return <svg {...s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" {...p}/><path d="M12 8v4M12 16h.01" {...p}/></svg>
  }
}
