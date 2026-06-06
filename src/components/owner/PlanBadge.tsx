'use client'

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#0F172A' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export default function OwnerPlanBadge({ plan, currentCompanyId }: { plan: string; currentCompanyId: string }) {
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [upgradeError, setUpgradeError] = useState('')
  const isPro = plan === 'Paid' || plan === 'Pro'

  const handlePlanChange = async (newPlan: 'Free' | 'Paid') => {
    if (!currentCompanyId) return
    setUpgradeLoading(true)
    setUpgradeError('')
    try {
      const res = await fetch('/api/company/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: currentCompanyId, plan: newPlan }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      window.location.reload()
    } catch (err) {
      setUpgradeError(err instanceof Error ? err.message : 'Failed to update plan')
    } finally {
      setUpgradeLoading(false)
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${isPro ? 'Pro' : 'Free'} plan`}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap',
          borderRadius: 999, padding: '0 16px', height: 36, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          background: isPro ? 'linear-gradient(135deg, #10B981, #14B8A6)' : '#F3F4F6',
          color: isPro ? '#fff' : '#4B5563',
          boxShadow: isPro ? '0 1px 4px rgba(16,185,129,0.3)' : 'none',
          transition: 'box-shadow 0.16s ease, transform 0.16s ease',
        }}
        onMouseEnter={event => {
          event.currentTarget.style.transform = 'translateY(-2px)'
          event.currentTarget.style.boxShadow = isPro ? '0 8px 18px rgba(16,185,129,0.28)' : '0 8px 18px rgba(15,23,42,0.10)'
        }}
        onMouseLeave={event => {
          event.currentTarget.style.transform = 'none'
          event.currentTarget.style.boxShadow = isPro ? '0 1px 4px rgba(16,185,129,0.3)' : 'none'
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 999, background: isPro ? 'rgba(255,255,255,0.7)' : '#9CA3AF', flexShrink: 0 }} />
        {isPro ? 'Pro Plan' : 'Free Plan'}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} style={{ width: 280, padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
        <div style={{ width: 280, borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', background: '#fff' }}>
          <div style={{ padding: '16px 20px', background: isPro ? 'linear-gradient(135deg, #10B981, #14B8A6)' : 'linear-gradient(135deg, #F3F4F6, #E5E7EB)' }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: isPro ? 'rgba(255,255,255,0.75)' : '#9CA3AF', margin: 0 }}>Current Plan</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: isPro ? '#fff' : '#1F2937', margin: '4px 0 2px' }}>{isPro ? 'Pro' : 'Free'}</p>
            <p style={{ fontSize: 12, color: isPro ? 'rgba(255,255,255,0.85)' : '#6B7280', margin: 0 }}>
              {isPro ? 'AI features & advanced analytics enabled' : 'Upgrade to unlock AI & analytics'}
            </p>
          </div>
          <div style={{ padding: '12px 16px' }}>
            {upgradeError && (
              <p style={{ marginBottom: 10, borderRadius: 8, background: '#FEF2F2', padding: '6px 10px', fontSize: 11, color: '#DC2626' }}>{upgradeError}</p>
            )}
            {isPro ? (
              <button
                type="button"
                onClick={() => handlePlanChange('Free')}
                disabled={upgradeLoading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 34, borderRadius: 10, border: 'none', background: '#F3F4F6', fontSize: 12, fontWeight: 500, color: '#6B7280', cursor: 'pointer' }}
              >
                {upgradeLoading ? <Spinner size={13} dark /> : 'Downgrade to Free'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handlePlanChange('Paid')}
                disabled={upgradeLoading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 34, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #10B981, #14B8A6)', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
              >
                {upgradeLoading ? <Spinner size={13} /> : 'Upgrade to Pro'}
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
