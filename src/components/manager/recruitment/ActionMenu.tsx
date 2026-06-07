'use client'

import React, { useState, useEffect, useRef } from 'react'
import { MoreHorizontal, Pencil, Copy, XCircle, Archive, Trash2 } from 'lucide-react'
import { JobPosting } from '@/types/recruitment.types'

interface ActionMenuProps {
  job: JobPosting
  onEdit: () => void
  onDuplicate: () => void
  onClose: () => void
  onArchive: () => void
  onDelete: () => void
}

export function ActionMenu({ job, onEdit, onDuplicate, onClose, onArchive, onDelete }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const isClosed   = job.status === 'closed'
  const isArchived = job.status === 'archived'

  const items = [
    { icon: <Pencil size={14} />,  label: 'Edit',      action: onEdit },
    { icon: <Copy size={14} />,    label: 'Duplicate', action: onDuplicate },
    ...(!isClosed && !isArchived ? [{ icon: <XCircle size={14} />, label: 'Close',   action: onClose }] : []),
    ...(!isArchived               ? [{ icon: <Archive size={14} />, label: 'Archive', action: onArchive }] : []),
    { icon: <Trash2 size={14} />,  label: 'Delete',    action: onDelete, color: '#DC2626' },
  ]

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          background: open ? '#F3F4F6' : 'none', border: '1px solid transparent',
          borderColor: open ? '#E5E7EB' : 'transparent', borderRadius: '6px',
          cursor: 'pointer', padding: '4px 5px', color: '#6B7280',
          display: 'flex', alignItems: 'center', transition: 'all 0.15s',
        }}>
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 4px)',
          background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '148px', zIndex: 50, overflow: 'hidden',
        }}>
          {items.map((item, i) => (
            <button key={i} onClick={() => { setOpen(false); item.action() }}
              style={{
                display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
                padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.8375rem', fontWeight: 500, color: item.color ?? '#374151',
                textAlign: 'left', transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = item.color ? '#FEF2F2' : '#F9FAFB')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              {item.icon}{item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
