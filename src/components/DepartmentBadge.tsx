// Canonical department badge — pill shape, tinted background derived from the department's own
// color (see src/lib/deptColor.ts), lifted from the Attendance page's Requests-tab SwapCard.
// Any page showing a record's department must use this instead of a page-local badge.

import { ReactNode } from 'react'
import { deptColor } from '@/lib/deptColor'

export default function DepartmentBadge({
  departmentId,
  departmentName,
  fallbackLabel = 'Company-wide',
  fallbackIcon,
  large = false,
}: {
  departmentId: string | null | undefined
  departmentName: string | null | undefined
  fallbackLabel?: string
  fallbackIcon?: ReactNode
  large?: boolean
}) {
  const fontSize = large ? '0.85rem' : '0.72rem'
  const padding = large ? '6px 14px' : '4px 10px'

  if (!departmentId || !departmentName) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize, fontWeight: 800, color: '#64748B', background: '#F1F5F9', borderRadius: 999, padding }}>
        {fallbackIcon}
        {fallbackLabel}
      </span>
    )
  }

  const dc = deptColor(departmentId)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize, fontWeight: 800, color: dc, background: `${dc}1a`, borderRadius: 999, padding }}>
      {departmentName}
    </span>
  )
}
