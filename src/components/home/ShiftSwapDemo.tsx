'use client';

// Auto-playing, looping product-demo of the real Shift Swap request card (see the `compact` swap
// card in src/components/attendance/AttendanceView.tsx's Shift Swaps tab) for the marketing Home
// Page. Short — one request, approved, with the swap actually reflected.
import { useEffect, useRef, useState } from 'react';
import { Calendar, Clock, Check, X, UserRound, MousePointer2 } from 'lucide-react';

const ORANGE = '#F97316';
const PANEL_BORDER = '#E2E8F0';

type Phase = 'pending' | 'approved';

function MiniShiftCard({ name, date, time, mirror, flash }: { name: string; date: string; time: string; mirror?: boolean; flash?: boolean }) {
  return (
    <div
      style={{
        flex: 1, minWidth: 0, borderRadius: 10, padding: '9px 8px', display: 'flex', alignItems: 'center',
        justifyContent: mirror ? 'flex-end' : undefined, gap: 8, background: '#FFFFFF',
        border: `1.5px solid ${flash ? '#4ADE80' : PANEL_BORDER}`,
        boxShadow: flash ? '0 0 0 3px rgba(74,222,128,0.25)' : 'none',
        transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
      }}
    >
      {mirror && (
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap' }}>{name}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#64748B' }}><Calendar size={9} /><span style={{ fontSize: '0.5625rem', fontWeight: 600 }}>{date}</span></span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#64748B' }}><Clock size={9} /><span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#334155' }}>{time}</span></span>
        </span>
      )}
      <span style={{ width: 26, height: 26, borderRadius: 999, background: '#F3F4F6', color: '#4B5563', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <UserRound size={13} />
      </span>
      {!mirror && (
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap' }}>{name}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#64748B' }}><Calendar size={9} /><span style={{ fontSize: '0.5625rem', fontWeight: 600 }}>{date}</span></span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#64748B' }}><Clock size={9} /><span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#334155' }}>{time}</span></span>
        </span>
      )}
    </div>
  );
}

export default function ShiftSwapDemo() {
  const [phase, setPhase] = useState<Phase>('pending');
  const [justApproved, setJustApproved] = useState(false);
  const [cursor, setCursor] = useState({ x: 80, y: 20, visible: false, clicking: false });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
    const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    const clickAt = (showMs: number, clickMs: number, hideMs: number, x: number, y: number) => {
      at(showMs, () => setCursor({ x, y, visible: true, clicking: false }));
      at(clickMs, () => setCursor(c => ({ ...c, clicking: true })));
      at(hideMs, () => setCursor(c => ({ ...c, visible: false, clicking: false })));
    };

    function runCycle() {
      clearAll();
      setPhase('pending');
      setJustApproved(false);
      setCursor({ x: 80, y: 20, visible: false, clicking: false });

      // 0s–2.6s: pending swap request, cursor clicks Approve.
      clickAt(1600, 2100, 2300, 88, 26);

      // 2.6s–8s: result — approved, shifts actually swapped. A brief green flash on both shift
      // cards marks the moment the trade executes, then settles.
      at(2600, () => { setPhase('approved'); setJustApproved(true); });
      at(3400, () => setJustApproved(false));

      // ~8s: smoothly restart.
      at(8000, runCycle);
    }

    runCycle();
    return clearAll;
  }, []);

  return (
    <div
      style={{
        position: 'relative', width: '100%', height: '100%', minHeight: 440, borderRadius: 20,
        background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes swapDemoFieldIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes swapNudgeR { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(4px); } }
        @keyframes swapNudgeL { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-4px); } }
        @keyframes swapDemoBadgeIn { 0% { opacity: 0; transform: scale(0.4); } 70% { transform: scale(1.15); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>

      <div
        style={{
          position: 'relative', width: '100%', maxWidth: 420, height: '100%', maxHeight: 400,
          background: '#FFFFFF', borderRadius: 16, border: '1px solid #F1F5F9',
          boxShadow: '0 20px 50px rgba(15,23,42,0.14), 0 4px 14px rgba(15,23,42,0.06)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* header */}
        <div style={{ padding: '13px 16px 11px', borderBottom: '1px solid #F3F4F6', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: `linear-gradient(135deg, ${ORANGE}, #EA580C)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Calendar size={13} color="#FFFFFF" strokeWidth={2.5} />
          </div>
          <h3 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#111827', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", whiteSpace: 'nowrap' }}>Shift Swap</h3>
        </div>

        {/* body */}
        <div style={{ flex: 1, minHeight: 0, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ background: phase === 'approved' ? '#F0FDF4' : '#F9FAFB', border: `1.5px solid ${phase === 'approved' ? '#86EFAC' : PANEL_BORDER}`, borderRadius: 14, padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12, transition: 'background 0.3s ease, border-color 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 800, color: ORANGE, background: `${ORANGE}1a`, borderRadius: 999, padding: '3px 9px' }}>Operations</span>
              {phase === 'pending' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 7, border: '1.5px solid #FECACA', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={11} color="#DC2626" />
                  </span>
                  <span style={{ width: 24, height: 24, borderRadius: 7, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: cursor.clicking ? 'scale(0.88)' : 'scale(1)', transition: 'transform 0.15s ease' }}>
                    <Check size={11} color="#FFFFFF" />
                  </span>
                </div>
              ) : (
                <span title="Approved" style={{ width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ECFDF5', color: '#047857', border: '1.5px solid #86EFAC', borderRadius: 999, animation: 'swapDemoBadgeIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MiniShiftCard name="James Wong" date="Sat, 13 Jun" time="10am–6pm" mirror flash={justApproved} />
              <span style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: phase === 'approved' ? '#4ADE80' : '#94A3B8', transition: 'color 0.4s ease' }}>
                <svg width="18" height="7" viewBox="0 0 24 8" fill="none" style={{ animation: phase === 'pending' ? 'swapNudgeR 0.8s ease-in-out infinite' : 'none' }}><line x1="1" y1="4" x2="19" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><polyline points="16,1 22,4 16,7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <svg width="18" height="7" viewBox="0 0 24 8" fill="none" style={{ animation: phase === 'pending' ? 'swapNudgeL 0.8s ease-in-out infinite' : 'none' }}><line x1="23" y1="4" x2="5" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><polyline points="8,1 2,4 8,7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <MiniShiftCard name="Aisha Rahman" date="Sun, 14 Jun" time="10am–6pm" flash={justApproved} />
            </div>
          </div>

          {phase === 'approved' && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#16A34A', fontSize: '0.75rem', fontWeight: 700, animation: 'swapDemoFieldIn 0.3s ease-out both' }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={11} /></span>
              Shifts swapped
            </div>
          )}
        </div>

        {/* fake cursor — purely decorative */}
        <div
          aria-hidden
          style={{
            position: 'absolute', left: `${cursor.x}%`, top: `${cursor.y}%`,
            opacity: cursor.visible ? 1 : 0,
            transform: `translate(-20%, -15%) scale(${cursor.clicking ? 0.85 : 1})`,
            transition: 'left 0.55s ease, top 0.55s ease, opacity 0.25s ease, transform 0.15s ease',
            color: '#1C1917', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))', pointerEvents: 'none',
          }}
        >
          <MousePointer2 size={16} fill="#FFFFFF" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}
