'use client';

// Auto-playing, looping product-demo of the real "Recurring" toggle inside the Assign Shift
// drawer (see the AI SHIFT SCHEDULING batch drawer's "Recurring" card in
// src/components/shifts/ShiftsView.tsx, and the shared src/components/DatePickerField.tsx it uses
// for "Repeat Until") for the marketing Home Page. Fewer steps than the AI Schedule demo, so this
// one is shorter and spends more of its time on the payoff: the repeated shifts it creates.
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, X, Repeat, Check, MousePointer2 } from 'lucide-react';
import DatePickerField from '@/components/DatePickerField';

const ORANGE = '#F97316';
const ORANGE_DEEP = '#EA580C';
const PANEL_BORDER = '#E2E8F0';

const fieldLabelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: '0.625rem', color: '#374151', marginBottom: 5 };

type Phase = 'toggle' | 'configure' | 'result';

const RULES = ['Daily', 'Weekly', 'Custom'];

// 4 weekly-repeated shift dates the result view reveals progressively.
const REPEATED_DATES = ['Mon, 10 Jun', 'Mon, 17 Jun', 'Mon, 24 Jun', 'Mon, 1 Jul'];

export default function RecurringShiftDemo() {
  const [phase, setPhase] = useState<Phase>('toggle');
  const [checked, setChecked] = useState(false);
  const [activeRule, setActiveRule] = useState(1); // Weekly, matches the real default
  const [repeatUntil, setRepeatUntil] = useState('');
  const [revealedCount, setRevealedCount] = useState(0);
  const [cursor, setCursor] = useState({ x: 80, y: 20, visible: false, clicking: false });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervals = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => {
    const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
    const clearAll = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      intervals.current.forEach(clearInterval);
      intervals.current = [];
    };
    const clickAt = (showMs: number, clickMs: number, hideMs: number, x: number, y: number) => {
      at(showMs, () => setCursor({ x, y, visible: true, clicking: false }));
      at(clickMs, () => setCursor(c => ({ ...c, clicking: true })));
      at(hideMs, () => setCursor(c => ({ ...c, visible: false, clicking: false })));
    };

    function runCycle() {
      clearAll();
      setPhase('toggle');
      setChecked(false);
      setActiveRule(1);
      setRepeatUntil('');
      setRevealedCount(0);
      setCursor({ x: 80, y: 20, visible: false, clicking: false });

      // 0s–1.6s: switch "Recurring" on.
      clickAt(700, 1000, 1200, 82, 22);
      at(1000, () => setChecked(true));

      // 1.6s–4.2s: confirm Weekly, fill in Repeat Until.
      at(1600, () => setPhase('configure'));
      clickAt(1900, 2200, 2400, 50, 48);
      at(2700, () => setRepeatUntil('2026-07-01'));

      // 4.2s–7.6s: result — the 4 shifts this repeat actually created.
      at(4200, () => {
        setPhase('result');
        let n = 0;
        const step = setInterval(() => {
          n += 1;
          setRevealedCount(n);
          if (n >= REPEATED_DATES.length) clearInterval(step);
        }, 450);
        intervals.current.push(step);
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
        @keyframes recDemoFieldIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes recDemoChipIn { from { opacity: 0; transform: scale(0.85) translateY(4px) } to { opacity: 1; transform: scale(1) translateY(0) } }
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
                  <Repeat size={13} color={ORANGE} /> Recurring
                </span>
                <span style={{ width: 30, height: 17, borderRadius: 999, background: checked ? ORANGE : '#E5E7EB', position: 'relative', transition: 'background 0.25s ease', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 2, left: checked ? 15 : 2, width: 13, height: 13, borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.25s ease' }} />
                </span>
              </div>

              {checked && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14, animation: 'recDemoFieldIn 0.3s ease-out both' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {RULES.map((rule, i) => {
                      const active = activeRule === i;
                      return (
                        <span key={rule} style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: active ? `1.5px solid ${ORANGE}` : `1px solid ${PANEL_BORDER}`, background: active ? '#FFF7ED' : '#FFFFFF', color: active ? ORANGE : '#0F172A', borderRadius: 7, fontSize: '0.6875rem', fontWeight: 600, transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease' }}>
                          {rule}
                        </span>
                      );
                    })}
                  </div>
                  <div>
                    <span style={fieldLabelStyle}>Repeat Until</span>
                    <div style={{ pointerEvents: 'none' }}>
                      <DatePickerField value={repeatUntil} onChange={() => {}} compact clearable={false} disableYearJump />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontWeight: 600, fontSize: '0.6875rem', color: '#374151' }}>Created from this shift</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {REPEATED_DATES.map((d, i) => (
                  i < revealedCount && (
                    <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, border: `1px solid ${PANEL_BORDER}`, animation: 'recDemoChipIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                      <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: ORANGE, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#111827' }}>{d}</span>
                      <span style={{ fontSize: '0.6875rem', color: '#9CA3AF', marginLeft: 'auto' }}>9am–5pm</span>
                    </div>
                  )
                ))}
              </div>
              {revealedCount >= REPEATED_DATES.length && (
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: '#16A34A', fontSize: '0.75rem', fontWeight: 700, animation: 'recDemoFieldIn 0.3s ease-out both' }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={11} /></span>
                  4 shifts created
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
