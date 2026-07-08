'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AlertTriangle, Check, X } from 'lucide-react'
import Spinner from '@/components/Spinner'
import { aiScheduleGenerationStore } from '@/lib/aiScheduleGenerationStore'

const WIDGET_HEIGHT = 36
const GAP_FROM_BADGES = 12
// Used only on the rare owner page that doesn't render the user/plan badge row at all.
const FALLBACK_POSITION = { top: 20, right: 24 }

// Persistent, cross-page indicator for the Owner's "Auto Shift Scheduling" AI run — mounted once in
// src/app/owner/layout.tsx so it stays visible (and the run keeps streaming) no matter which
// /owner/* page the Owner navigates to while it's in progress. Clicking it takes them back to
// Shifts to review the result; the Shifts page auto-opens the wizard when it sees a non-idle run.
// Styled to match the OwnerUserBadge/PlanBadge pills it sits next to (36px pill, white, #E5E7EB
// border) rather than a standalone card, and positioned by measuring that badge row at runtime
// (each owner page marks its wrapper with data-owner-header-badges) rather than a guessed fixed
// offset — a hardcoded pixel value drifts out of alignment across pages/screen sizes.
export default function AiScheduleStatusWidget() {
  const state = useSyncExternalStore(aiScheduleGenerationStore.subscribe, aiScheduleGenerationStore.getSnapshot, aiScheduleGenerationStore.getSnapshot)
  const router = useRouter()
  const pathname = usePathname()
  const [position, setPosition] = useState(FALLBACK_POSITION)
  const visible = state.status !== 'idle'

  useEffect(() => {
    if (!visible) return

    // Measure the first badge itself, not the [data-owner-header-badges] wrapper — several pages
    // give that wrapper an asymmetric paddingTop (to nudge the row down under the page title), which
    // would throw off center-alignment if we centered against the wrapper's own (padded) box instead
    // of the badge's actual visual box.
    //
    // Always re-look-up the target instead of caching one element: the page's own user/company data
    // (and therefore which element is actually the first badge) can still be loading/changing right
    // after this widget mounts, so a reference captured too early can go stale — re-resolving on
    // every tick is what actually keeps this correct, not any one clever trigger.
    const measure = () => {
      const wrapper = document.querySelector<HTMLElement>('[data-owner-header-badges]')
      const el = (wrapper?.firstElementChild as HTMLElement | null) ?? null
      if (!el) { setPosition(FALLBACK_POSITION); return }
      const rect = el.getBoundingClientRect()
      setPosition({
        top: Math.round(rect.top + (rect.height - WIDGET_HEIGHT) / 2),
        right: Math.round(window.innerWidth - rect.left + GAP_FROM_BADGES),
      })
    }

    measure()
    // Keep polling for as long as the widget is visible, not just a brief window after mount — the
    // badge row can shift (avatar/name/plan finishing an async fetch, inserting/resizing) at a point
    // that doesn't necessarily fire a DOM mutation or a resize of the exact element being watched,
    // and on a slow connection that can take a lot longer than a "brief settle" window. The widget
    // is only ever on screen for a bounded stretch (one generation run), so the cost is negligible.
    const pollInterval = setInterval(measure, 150)
    const mo = new MutationObserver(measure)
    mo.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', measure)

    return () => {
      clearInterval(pollInterval)
      mo.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [visible, pathname])

  if (!visible) return null

  const goToShifts = () => {
    // Bump the open-request counter unconditionally — if the Shifts page is already mounted (the
    // Owner is already sitting on /owner/shifts), navigating nowhere wouldn't otherwise tell it to
    // reopen the wizard.
    aiScheduleGenerationStore.requestOpen()
    if (pathname !== '/owner/shifts') router.push('/owner/shifts')
  }

  // Also cancels an in-flight run (clear() aborts the fetch) — not just dismissing a finished one.
  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    aiScheduleGenerationStore.clear()
  }

  const label = state.status === 'generating'
    ? 'Generating Schedule…'
    : state.status === 'done'
      ? 'Schedule Ready'
      : 'Schedule Generation Failed'

  // Pulses while generating, and while a finished draft is still unreviewed — draws the Owner's eye
  // until they actually click through. Stops the instant they do (acknowledged) or once dismissed
  // (status back to idle) or failed (nothing pending to lose their attention over). Two separate
  // named keyframes (rather than one keyframe reading a CSS custom property off the button) so the
  // ring color for each status is baked directly into the animation — nothing to wire through inline
  // style timing.
  const shouldBreathe = (state.status === 'generating' || state.status === 'done') && !state.acknowledged
  const breatheAnimationName = state.status === 'done' ? 'aiScheduleBreatheDone' : 'aiScheduleBreatheGenerating'

  return (
    <>
      <style>{`
        @keyframes aiScheduleBreatheGenerating {
          0%, 100% { box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 0 0 0 rgba(124,58,237,0.45); }
          50% { box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 0 0 7px rgba(124,58,237,0); }
        }
        @keyframes aiScheduleBreatheDone {
          0%, 100% { box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 0 0 0 rgba(22,163,74,0.5); }
          50% { box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 0 0 8px rgba(22,163,74,0); }
        }
      `}</style>
      <button
        type="button"
        onClick={goToShifts}
        style={{
          position: 'fixed',
          top: position.top,
          right: position.right,
          zIndex: 90,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: WIDGET_HEIGHT,
          background: '#FFFFFF',
          border: '1.5px solid #E5E7EB',
          borderRadius: 999,
          padding: '0 8px 0 6px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          animation: shouldBreathe ? `${breatheAnimationName} 1.8s ease-in-out infinite` : undefined,
        }}
      >
        {state.status === 'generating' && (
          <span style={{ width: 24, height: 24, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F3FF' }}>
            <Spinner size={13} dark />
          </span>
        )}
        {state.status === 'done' && (
          <span style={{ width: 24, height: 24, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#DCFCE7' }}>
            <Check size={13} color="#16A34A" strokeWidth={2.5} />
          </span>
        )}
        {state.status === 'error' && (
          <span style={{ width: 24, height: 24, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF2F2' }}>
            <AlertTriangle size={13} color="#DC2626" />
          </span>
        )}
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{label}</span>
        {state.status !== 'done' && (
          <span
            role="button"
            aria-label={state.status === 'generating' ? 'Cancel' : 'Dismiss'}
            title={state.status === 'generating' ? 'Cancel' : 'Dismiss'}
            onClick={dismiss}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 999, color: '#9CA3AF', flexShrink: 0, cursor: 'pointer' }}
          >
            <X size={13} />
          </span>
        )}
      </button>
    </>
  )
}
