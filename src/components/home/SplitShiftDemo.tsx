'use client';

// Auto-playing, looping product-demo of the real "Splitting" toggle inside the Assign Shift
// drawer (see the "Splitting" card next to "Recurring" in the batch drawer of
// src/components/shifts/ShiftsView.tsx) for the marketing Home Page. Short, like the Recurring
// Shifts demo — most of the time goes to the payoff: one shift visibly splitting into two blocks
// with a break in between.
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, X, SplitSquareHorizontal, Check, ChevronDown, MousePointer2 } from 'lucide-react';

const ORANGE = '#F97316';
const ORANGE_DEEP = '#EA580C';
const PANEL_BORDER = '#E2E8F0';

const fieldLabelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: '0.625rem', color: '#374151', marginBottom: 4 };

function timeChip(value: string, editable: boolean): React.CSSProperties {
  return {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
    border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 8px', fontSize: '0.6875rem', fontWeight: 500,
    background: editable ? '#FFFFFF' : '#F9FAFB', color: editable ? '#0F172A' : '#9CA3AF',
  };
}

type Phase = 'toggle' | 'configure' | 'result';

// Percentages of the 9am–5pm (8h) track that each segment occupies.
const BAR1_SINGLE = { left: 0, width: 100 };
const BAR1_SPLIT = { left: 0, width: 50 }; // 9am–1pm = 4h / 8h
const BAR2_SPLIT = { left: 62.5, width: 37.5 }; // 2pm–5pm = 3h / 8h

export default function SplitShiftDemo() {
  const [phase, setPhase] = useState<Phase>('toggle');
  const [checked, setChecked] = useState(false);
  const [split, setSplit] = useState(false);
  const [showResultCaption, setShowResultCaption] = useState(false);
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
      setPhase('toggle');
      setChecked(false);
      setSplit(false);
      setShowResultCaption(false);
      setCursor({ x: 80, y: 20, visible: false, clicking: false });

      // 0s–1.6s: switch "Splitting" on.
      clickAt(700, 1000, 1200, 82, 22);
      at(1000, () => setChecked(true));

      // 1.6s–4.2s: Shift 1 / Shift 2 time fields reveal.
      at(1600, () => setPhase('configure'));

      // 4.2s–7.6s: result — one shift visibly splits into two, with a break between.
      at(4200, () => setPhase('result'));
      at(5200, () => setSplit(true));
      at(6000, () => setShowResultCaption(true));

      // ~8s: smoothly restart.
      at(8000, runCycle);
    }

    runCycle();
    return clearAll;
  }, []);

  const bar1 = split ? BAR1_SPLIT : BAR1_SINGLE;

  return (
    <div
      style={{
        position: 'relative', width: '100%', height: '100%', minHeight: 440, borderRadius: 20,
        background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes splitDemoFieldIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
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
        <div style={{ padding: '13px 16px 11px', borderBottom: '1px solid #F3F4F6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DEEP})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CalendarDays size={13} color="#FFFFFF" strokeWidth={2.5} />
            </div>
            <h3 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#111827', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", whiteSpace: 'nowrap' }}>Assign Shift</h3>
          </div>
          <span aria-hidden style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280', display: 'flex', padding: 5, borderRadius: 7, flexShrink: 0 }}>
            <X size={13} />
          </span>
        </div>

        {/* body */}
        <div style={{ flex: 1, minHeight: 0, padding: 16, display: 'flex', flexDirection: 'column' }}>
          {phase !== 'result' ? (
            <div style={{ background: '#FFFFFF', borderRadius: 14, padding: 12, border: `1px solid ${PANEL_BORDER}`, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ ...fieldLabelStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
                  <SplitSquareHorizontal size={13} color={ORANGE} /> Splitting
                </span>
                <span style={{ width: 30, height: 17, borderRadius: 999, background: checked ? ORANGE : '#E5E7EB', position: 'relative', transition: 'background 0.25s ease', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 2, left: checked ? 15 : 2, width: 13, height: 13, borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.25s ease' }} />
                </span>
              </div>

              {checked && (
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, animation: 'splitDemoFieldIn 0.3s ease-out both' }}>
                  <div>
                    <span style={{ display: 'block', textAlign: 'center', fontWeight: 600, fontSize: '0.6875rem', color: '#374151', marginBottom: 6 }}>Shift 1</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div>
                        <span style={fieldLabelStyle}>Start</span>
                        <span style={timeChip('9:00 AM', false)}><span>9:00 AM</span></span>
                      </div>
                      <div>
                        <span style={fieldLabelStyle}>End</span>
                        <span style={timeChip('1:00 PM', true)}><span>1:00 PM</span><ChevronDown size={10} color="#9CA3AF" /></span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <span style={{ display: 'block', textAlign: 'center', fontWeight: 600, fontSize: '0.6875rem', color: '#374151', marginBottom: 6 }}>Shift 2</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div>
                        <span style={fieldLabelStyle}>Start</span>
                        <span style={timeChip('2:00 PM', true)}><span>2:00 PM</span><ChevronDown size={10} color="#9CA3AF" /></span>
                      </div>
                      <div>
                        <span style={fieldLabelStyle}>End</span>
                        <span style={timeChip('5:00 PM', false)}><span>5:00 PM</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '0.6875rem', color: '#374151' }}>{split ? 'Split into two shifts' : 'Original shift'}</span>

              <div style={{ position: 'relative', height: 40, borderRadius: 10, background: '#F8FAFC', border: `1px solid ${PANEL_BORDER}` }}>
                <div
                  style={{
                    position: 'absolute', top: 5, bottom: 5, left: `${bar1.left}%`, width: `${bar1.width}%`,
                    borderRadius: 999, background: '#FFF7ED', border: `1.5px solid ${ORANGE}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    transition: 'left 0.6s cubic-bezier(0.65,0,0.35,1), width 0.6s cubic-bezier(0.65,0,0.35,1)',
                  }}
                >
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, color: ORANGE_DEEP, whiteSpace: 'nowrap' }}>
                    {split ? '9am–1pm' : '9am–5pm'}
                  </span>
                </div>
                <div
                  style={{
                    position: 'absolute', top: 5, bottom: 5, left: `${BAR2_SPLIT.left}%`, width: split ? `${BAR2_SPLIT.width}%` : '0%',
                    opacity: split ? 1 : 0,
                    borderRadius: 999, background: '#FFF7ED', border: `1.5px solid ${ORANGE}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    transition: 'left 0.6s cubic-bezier(0.65,0,0.35,1), width 0.6s cubic-bezier(0.65,0,0.35,1), opacity 0.4s ease 0.2s',
                  }}
                >
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, color: ORANGE_DEEP, whiteSpace: 'nowrap' }}>2pm–5pm</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.5625rem', fontWeight: 600, color: '#9CA3AF' }}>
                <span>9am</span>
                <span>1pm</span>
                <span>2pm</span>
                <span>5pm</span>
              </div>

              {showResultCaption && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16A34A', fontSize: '0.75rem', fontWeight: 700, animation: 'splitDemoFieldIn 0.3s ease-out both' }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={11} /></span>
                  2 shifts created, with a break in between
                </div>
              )}
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
