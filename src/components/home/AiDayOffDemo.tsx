'use client';

// Auto-playing, looping product-demo of the real "AI Process" Fixed Day Off queue analysis (see
// analyzeFixedOffQueue / approveSafeFixedOffQueue in src/components/attendance/AttendanceView.tsx)
// for the marketing Home Page: safe/flagged verdicts per pending request, then a one-click batch
// approval of the safe ones.
import { useEffect, useRef, useState } from 'react';
import { Sparkles, Inbox, Check, AlertTriangle, X, UserRound, MousePointer2 } from 'lucide-react';

const ACCENT = '#7C3AED';
const ACCENT_DEEP = '#6D28D9';
const PANEL_BORDER = '#E2E8F0';

type Phase = 'idle' | 'analyzing' | 'result' | 'approving' | 'done';

const REQUESTS = [
  { name: 'Sarah Chen', dept: 'Operations', submitted: '2h ago', verdict: 'safe' as const },
  { name: 'Marcus Lee', dept: 'Sales', submitted: '5h ago', verdict: 'safe' as const },
  { name: 'Priya Nair', dept: 'Sales', submitted: '1d ago', verdict: 'flagged' as const },
];

export default function AiDayOffDemo() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [revealedCount, setRevealedCount] = useState(0);
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
      setPhase('idle');
      setRevealedCount(0);
      setCursor({ x: 80, y: 20, visible: false, clicking: false });

      // 0s–1.8s: pending requests, cursor clicks "AI Process".
      clickAt(1000, 1400, 1600, 84, 22);

      // 1.8s–2.6s: analyzing.
      at(1800, () => setPhase('analyzing'));

      // 2.6s–6.5s: verdicts reveal one by one.
      at(2600, () => setPhase('result'));
      at(2900, () => setRevealedCount(1));
      at(3400, () => setRevealedCount(2));
      at(3900, () => setRevealedCount(3));

      // 6.5s–7.2s: approve the safe ones.
      clickAt(6200, 6600, 6800, 92, 22);
      at(6600, () => setPhase('approving'));

      // 7.2s–10s: result — approved.
      at(7200, () => setPhase('done'));

      // ~10s: smoothly restart.
      at(10000, runCycle);
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
        @keyframes offDemoFieldIn { from { opacity: 0; transform: scale(0.6) } to { opacity: 1; transform: scale(1) } }
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
        <div style={{ padding: '13px 16px 11px', borderBottom: '1px solid #F3F4F6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Inbox size={13} color="#F97316" />
            </div>
            <h3 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#111827', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", whiteSpace: 'nowrap' }}>Requests</h3>
          </div>

          {(phase === 'idle' || phase === 'analyzing') && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 8, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`, color: '#FFFFFF', height: 26, padding: '0 9px', fontSize: '0.625rem', fontWeight: 700, transform: cursor.clicking ? 'scale(0.94)' : 'scale(1)', transition: 'transform 0.15s ease' }}>
              {phase === 'analyzing' ? (
                <svg className="animate-spin" width={10} height={10} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" /><path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" /></svg>
              ) : (
                <Sparkles size={11} strokeWidth={2.5} />
              )}
              {phase === 'analyzing' ? 'Analyzing…' : 'AI Process'}
            </span>
          )}
          {(phase === 'result' || phase === 'approving' || phase === 'done') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></span>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: phase === 'done' ? '#94A3B8' : 'linear-gradient(135deg, #22C55E, #16A34A)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: cursor.clicking ? 'scale(0.88)' : 'scale(1)', transition: 'transform 0.15s ease, background 0.3s ease' }}>
                {phase === 'approving' ? (
                  <svg className="animate-spin" width={11} height={11} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" /><path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" /></svg>
                ) : <Check size={12} strokeWidth={2.5} />}
              </span>
            </div>
          )}
        </div>

        {/* body */}
        <div style={{ flex: 1, minHeight: 0, padding: 16, display: 'flex', flexDirection: 'column' }}>
          {REQUESTS.map((r, i) => {
            const showVerdict = (phase === 'result' || phase === 'approving' || phase === 'done') && i < revealedCount;
            const isApprovedAway = phase === 'done' && r.verdict === 'safe';
            return (
              <div
                key={r.name}
                style={{
                  overflow: 'hidden',
                  maxHeight: isApprovedAway ? 0 : 68,
                  opacity: isApprovedAway ? 0 : 1,
                  marginBottom: isApprovedAway ? 0 : 8,
                  transition: 'max-height 0.4s ease, opacity 0.3s ease, margin-bottom 0.4s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1.5px solid ${PANEL_BORDER}`, borderRadius: 12, padding: '9px 10px' }}>
                  <span style={{ width: 28, height: 28, borderRadius: 999, background: '#F3F4F6', color: '#4B5563', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserRound size={14} />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#F97316', background: '#FFF3E8', borderRadius: 999, padding: '1px 6px' }}>{r.dept}</span>
                    </span>
                    <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#111827' }}>{r.name}</span>
                    <span style={{ display: 'block', fontSize: '0.5625rem', color: '#9CA3AF' }}>Submitted {r.submitted}</span>
                  </span>
                  {showVerdict && (
                    r.verdict === 'safe' ? (
                      <span title="Safe to approve" style={{ width: 24, height: 24, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: 'offDemoFieldIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                        <Check size={13} strokeWidth={3} color="#15803D" />
                      </span>
                    ) : (
                      <span title="Needs review" style={{ width: 24, height: 24, borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: 'offDemoFieldIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                        <AlertTriangle size={13} color="#B45309" />
                      </span>
                    )
                  )}
                </div>
              </div>
            );
          })}

          {phase === 'done' && (
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#16A34A', fontSize: '0.75rem', fontWeight: 700, animation: 'offDemoFieldIn 0.3s ease-out both' }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={11} /></span>
              2 approved · 1 needs review
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
