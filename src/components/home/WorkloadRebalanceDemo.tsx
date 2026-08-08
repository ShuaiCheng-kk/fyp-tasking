'use client';

// Auto-playing, looping product-demo of the real "Workload Suggestion" modal (see
// workloadInsightOpen / handleApplyWorkloadSuggestion in src/components/tasks/TasksView.tsx) for
// the marketing Home Page: an overloaded person's task, a reassign action, and the recommended
// (under-loaded) teammate it moves to. Short — most of the time goes to the payoff: the workload
// counts actually changing.
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Check, UserRound, MousePointer2 } from 'lucide-react';

const ORANGE = '#F97316';
const ORANGE_DEEP = '#EA580C';
const PANEL_BORDER = '#E2E8F0';

type Phase = 'suggest' | 'applying' | 'result';

export default function WorkloadRebalanceDemo() {
  const [phase, setPhase] = useState<Phase>('suggest');
  const [fromCount, setFromCount] = useState(6);
  const [toCount, setToCount] = useState(2);
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
      setPhase('suggest');
      setFromCount(6);
      setToCount(2);
      setCursor({ x: 80, y: 20, visible: false, clicking: false });

      // 0s–2.6s: the AI-flagged suggestion — James is overloaded, Aisha has room.
      clickAt(1600, 2100, 2300, 50, 50);

      // 2.6s–3.2s: applying the reassignment.
      at(2600, () => setPhase('applying'));

      // 3.2s–8s: result — task moved, workload counts updated.
      at(3200, () => {
        setPhase('result');
        setFromCount(5);
        setToCount(3);
      });

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
        @keyframes wrDemoFieldIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes wrDemoBump { 0% { transform: scale(1.4) } 100% { transform: scale(1) } }
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
          <div style={{ width: 26, height: 26, borderRadius: 8, background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DEEP})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={13} color="#FFFFFF" strokeWidth={2.5} />
          </div>
          <h3 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#111827', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", whiteSpace: 'nowrap' }}>Workload Suggestion</h3>
        </div>

        {/* body */}
        <div style={{ flex: 1, minHeight: 0, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#374151', textAlign: 'center' }}>
            {phase === 'result' ? 'Reassigned' : 'James is overloaded — move a task to Aisha?'}
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 1fr', alignItems: 'center', gap: 10 }}>
            {/* overloaded person */}
            <div style={{ border: `1.5px solid ${PANEL_BORDER}`, borderRadius: 12, padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: '#FFFFFF' }}>
              <span style={{ width: 48, height: 48, borderRadius: 999, background: '#FFF7ED', color: ORANGE_DEEP, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserRound size={24} />
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A' }}>James Wong</span>
              <span key={fromCount} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '2px 9px', borderRadius: 999, background: phase === 'result' ? '#F1F5F9' : '#FEE2E2', color: phase === 'result' ? '#475569' : '#B91C1C', fontSize: '0.625rem', fontWeight: 800, animation: 'wrDemoBump 0.3s ease-out' }}>
                {fromCount} tasks
              </span>
            </div>

            {/* reassign action */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span
                style={{
                  width: 34, height: 34, borderRadius: 8, border: '1px solid #FED7AA',
                  background: phase === 'result' ? '#DCFCE7' : '#FFF7ED', color: phase === 'result' ? '#16A34A' : ORANGE_DEEP,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  transform: cursor.clicking ? 'scale(0.88)' : 'scale(1)', transition: 'transform 0.15s ease, background 0.25s ease, color 0.25s ease',
                }}
              >
                {phase === 'applying' ? (
                  <svg className="animate-spin" width={13} height={13} viewBox="0 0 18 18">
                    <circle cx="9" cy="9" r="7" stroke="rgba(234,88,12,0.25)" strokeWidth="2.5" fill="none" />
                    <path d="M9 2a7 7 0 0 1 7 7" stroke={ORANGE_DEEP} strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  </svg>
                ) : phase === 'result' ? (
                  <Check size={16} strokeWidth={3} />
                ) : (
                  <ArrowRightLeft size={16} />
                )}
              </span>
            </div>

            {/* recommended assignee */}
            <div style={{ border: `1.5px solid ${PANEL_BORDER}`, borderRadius: 12, padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: '#FFFFFF' }}>
              <span style={{ width: 48, height: 48, borderRadius: 999, background: '#FFF7ED', color: ORANGE_DEEP, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserRound size={24} />
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A' }}>Aisha Rahman</span>
              <span key={toCount} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '2px 9px', borderRadius: 999, background: '#DCFCE7', color: '#15803D', fontSize: '0.625rem', fontWeight: 800, animation: 'wrDemoBump 0.3s ease-out' }}>
                {toCount} tasks
              </span>
            </div>
          </div>

          {phase === 'result' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#16A34A', fontSize: '0.75rem', fontWeight: 700, animation: 'wrDemoFieldIn 0.3s ease-out both' }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={11} /></span>
              Task reassigned to Aisha Rahman
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
