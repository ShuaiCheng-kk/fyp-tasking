'use client';

// Auto-playing, looping product-demo of the real "My Shift Today" clock in/out strip (see
// showPersonalClock in src/components/attendance/AttendanceView.tsx) for the marketing Home Page.
// Short — the whole clock-in -> working -> clock-out lifecycle in one compact strip, with a shift
// timeline that actually fills in as the "shift" progresses so the passage of time reads visually,
// not just from the button/text changing.
import { useEffect, useRef, useState } from 'react';
import { Clock, Check, MousePointer2 } from 'lucide-react';

const ORANGE = '#F97316';
const GREEN = '#059669';
const PANEL_BORDER = '#E2E8F0';
const WORKING_MS = 2200;

type Phase = 'before' | 'working' | 'done';

export default function ClockInOutDemo() {
  const [phase, setPhase] = useState<Phase>('before');
  const [progress, setProgress] = useState(0);
  const [cursor, setCursor] = useState({ x: 80, y: 60, visible: false, clicking: false });
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
      setPhase('before');
      setProgress(0);
      setCursor({ x: 80, y: 60, visible: false, clicking: false });

      // 0s–2s: about to clock in.
      clickAt(1100, 1500, 1700, 80, 65);
      at(1500, () => { setPhase('working'); setProgress(100); });

      // 2s–4.2s: the timeline fills in while "working"; about to clock out right as it completes.
      clickAt(3300, 3700, 3900, 80, 65);
      at(3700, () => setPhase('done'));

      // 4.2s–9s: hold on the finished state.

      // ~9s: smoothly restart.
      at(9000, runCycle);
    }

    runCycle();
    return clearAll;
  }, []);

  const barColor = phase === 'done' ? GREEN : ORANGE;

  return (
    <div
      style={{
        position: 'relative', width: '100%', height: '100%', minHeight: 440, borderRadius: 20,
        background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes clockDemoFieldIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes clockDemoPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.35) } 50% { box-shadow: 0 0 0 5px rgba(249,115,22,0) } }
        @keyframes clockDemoPop { from { opacity: 0; transform: scale(0.5) } to { opacity: 1; transform: scale(1) } }
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
          <div style={{ width: 26, height: 26, borderRadius: 8, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={13} color={ORANGE} />
          </div>
          <h3 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#111827', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", whiteSpace: 'nowrap' }}>My Shift Today</h3>
        </div>

        {/* body */}
        <div style={{ flex: 1, minHeight: 0, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
          <div style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
                Shift · 9:00am – 5:00pm
              </span>
              {phase === 'working' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: '#FFF7ED', color: ORANGE, fontSize: '0.625rem', fontWeight: 800, animation: 'clockDemoPulse 1.4s ease-in-out infinite, clockDemoFieldIn 0.3s ease-out both' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: ORANGE }} /> On Shift
                </span>
              )}
              {phase === 'done' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: '#F1F5F9', color: '#64748B', fontSize: '0.625rem', fontWeight: 700, animation: 'clockDemoPop 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                  <Check size={9} strokeWidth={3} /> Done
                </span>
              )}
            </div>

            {/* shift timeline — fills in as the shift is "worked" */}
            <div>
              <div style={{ position: 'relative', height: 8, borderRadius: 999, background: '#F1F5F9' }}>
                <div
                  style={{
                    position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: 999,
                    width: `${progress}%`, background: barColor,
                    transition: `width ${WORKING_MS}ms linear, background 0.3s ease`,
                  }}
                />
                <div
                  style={{
                    position: 'absolute', top: '50%', left: `${progress}%`, width: 12, height: 12, borderRadius: '50%',
                    background: '#FFFFFF', border: `2.5px solid ${barColor}`, boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transform: 'translate(-50%, -50%)', transition: `left ${WORKING_MS}ms linear, border-color 0.3s ease`,
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.5625rem', fontWeight: 600, color: '#9CA3AF' }}>
                <span>9am {phase !== 'before' && <span style={{ color: GREEN, fontWeight: 700 }}>· In 9:02am</span>}</span>
                <span>{phase === 'done' && <span style={{ color: '#64748B', fontWeight: 700 }}>Out 5:01pm ·</span>} 5pm</span>
              </div>
            </div>

            <div>
              {phase === 'before' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 32, padding: '0 18px', borderRadius: 9, background: GREEN, color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 700, transform: cursor.clicking ? 'scale(0.95)' : 'scale(1)', transition: 'transform 0.15s ease' }}>
                  Clock In
                </span>
              )}
              {phase === 'working' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 32, padding: '0 18px', borderRadius: 9, background: '#DC2626', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 700, transform: cursor.clicking ? 'scale(0.95)' : 'scale(1)', transition: 'transform 0.15s ease', animation: 'clockDemoFieldIn 0.3s ease-out both' }}>
                  Clock Out
                </span>
              )}
              {phase === 'done' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 28, padding: '0 14px', borderRadius: 999, background: '#F1F5F9', color: '#64748B', fontSize: '0.6875rem', fontWeight: 700, animation: 'clockDemoFieldIn 0.3s ease-out both' }}>
                  Done for today
                </span>
              )}
            </div>
          </div>

          {phase === 'done' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#334155', fontSize: '0.75rem', fontWeight: 700, animation: 'clockDemoFieldIn 0.3s ease-out both' }}>
              7h 59m worked today
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
