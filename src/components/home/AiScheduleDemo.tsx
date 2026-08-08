'use client';

// Auto-playing, looping product-demo of the real "Auto Shift Scheduling" AI wizard (see the AI
// SHIFT SCHEDULING MODAL in src/components/shifts/ShiftsView.tsx) for the marketing Home Page.
// It borrows the real product's accent color, department-color hashing (deptColor) and the actual
// AI rule-check copy (AI_SCHEDULE_RULE_STEPS) so it reads as "the same product", but is a
// lighter, prettier restyling rather than a pixel-exact clone — it plays the whole wizard from
// step 1 (Dates) through step 4 (Generate) to the finished schedule on its own scripted timeline,
// since mounting the real stateful wizard would need an authenticated company session and live
// Supabase-backed data that don't exist on a public marketing page.
import { useEffect, useRef, useState } from 'react';
import { Sparkles, Check, CheckCheck, RotateCw, ChevronLeft, ChevronDown, X, UserCog, UserRound, CalendarDays, AlertTriangle, MousePointer2 } from 'lucide-react';
import { deptColor } from '@/lib/deptColor';
import { AI_SCHEDULE_RULE_STEPS } from '@/lib/aiScheduleGenerationStore';

const PANEL_BORDER = '#E2E8F0';
const ACCENT = '#7C3AED';
const ACCENT_DEEP = '#6D28D9';

function Spinner({ size = 13 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function formatShiftHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

const DEPT_OPS = 'demo-dept-operations';
const DEPT_SALES = 'demo-dept-sales';

type DemoCell = { deptId: string; start: string; end: string } | 'off' | 'gap' | null;

type DemoRow = {
  key: string;
  name: string;
  role: 'Manager' | 'Employee';
  deptId: string;
  cells: DemoCell[];
};

const DAY_LABELS = [
  { d: '10', w: 'Mon' },
  { d: '11', w: 'Tue' },
  { d: '12', w: 'Wed' },
  { d: '13', w: 'Thu' },
  { d: '14', w: 'Fri' },
  { d: '15', w: 'Sat' },
  { d: '16', w: 'Sun' },
];

// 7 assigned shifts total across the grid — matches the "Create 7 Shifts" button below.
const ROWS: DemoRow[] = [
  { key: 'sarah', name: 'Sarah Chen', role: 'Manager', deptId: DEPT_OPS, cells: [
    { deptId: DEPT_OPS, start: '09:00', end: '17:00' }, null, { deptId: DEPT_OPS, start: '09:00', end: '17:00' }, null, { deptId: DEPT_OPS, start: '09:00', end: '17:00' }, null, 'off',
  ] },
  { key: 'james', name: 'James Wong', role: 'Employee', deptId: DEPT_OPS, cells: [
    null, { deptId: DEPT_OPS, start: '10:00', end: '18:00' }, null, { deptId: DEPT_OPS, start: '10:00', end: '18:00' }, null, 'off', null,
  ] },
  { key: 'aisha', name: 'Aisha Rahman', role: 'Employee', deptId: DEPT_OPS, cells: [
    null, null, null, null, null, null, 'gap',
  ] },
  { key: 'marcus', name: 'Marcus Lee', role: 'Manager', deptId: DEPT_SALES, cells: [
    { deptId: DEPT_SALES, start: '08:00', end: '16:00' }, null, null, { deptId: DEPT_SALES, start: '08:00', end: '16:00' }, null, null, null,
  ] },
  { key: 'priya', name: 'Priya Nair', role: 'Employee', deptId: DEPT_SALES, cells: [
    null, null, 'gap', null, null, null, null,
  ] },
];

const TOTAL_SHIFTS = ROWS.reduce((n, row) => n + row.cells.filter(c => c && c !== 'off' && c !== 'gap').length, 0);

// Reading-order flat index of every assigned-shift cell, for the progressive AI-reveal stagger.
const REVEAL_ORDER: { rowKey: string; col: number }[] = [];
ROWS.forEach(row => row.cells.forEach((c, col) => { if (c && c !== 'off' && c !== 'gap') REVEAL_ORDER.push({ rowKey: row.key, col }); }));

type Phase = 'dates' | 'departments' | 'shiftTypes' | 'cta' | 'loading' | 'revealing' | 'complete' | 'highlight';

const STEP_LABELS = ['Dates', 'Departments', 'Shift', 'Generate'];
const STEP_OF_PHASE: Record<Phase, number> = {
  dates: 0, departments: 1, shiftTypes: 2, cta: 3, loading: 3, revealing: 3, complete: 3, highlight: 3,
};

const NAME_COL = 118;
const NARROW_CARD_WIDTH = 300;
const WIDE_CARD_WIDTH = 560;

// Mirrors modalLabelStyle in the real AI wizard (src/components/shifts/ShiftsView.tsx).
const fieldLabelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: '0.625rem', color: '#374151', marginBottom: 5 };

// Mirrors the TimelineDatePicker / TimePicker trigger button styling in the real wizard.
const pickerTriggerStyle: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
  border: '1px solid #E2E8F0', borderRadius: 8, background: '#FFFFFF',
  padding: '6px 8px', fontSize: '0.6875rem', fontWeight: 500, color: '#0F172A',
};

const continueBtnStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '7px 16px', background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`,
  borderRadius: 8, color: '#FFFFFF', fontWeight: 600, fontSize: '0.6875rem',
  transform: active ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.15s ease',
});

export default function AiScheduleDemo() {
  const [phase, setPhase] = useState<Phase>('dates');
  const [progress, setProgress] = useState(0);
  const [ruleIdx, setRuleIdx] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [cursor, setCursor] = useState({ x: 80, y: 80, visible: false, clicking: false });
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
      setPhase('dates');
      setProgress(0);
      setRuleIdx(0);
      setRevealedCount(0);
      setCursor({ x: 80, y: 80, visible: false, clicking: false });

      // 0s–2s: step 1, pick the date range.
      clickAt(1200, 1650, 1850, 82, 80);

      // 2s–4s: step 2, pick departments.
      at(2000, () => setPhase('departments'));
      clickAt(3200, 3650, 3850, 82, 80);

      // 4s–6s: step 3, set the shift time.
      at(4000, () => setPhase('shiftTypes'));
      clickAt(5200, 5650, 5850, 82, 80);

      // 6s–7.5s: reach the Generate step, click "Generate Schedule with AI".
      at(6000, () => setPhase('cta'));
      clickAt(6400, 7100, 7300, 64, 78);

      // 7.5s–9s: AI generation/loading state.
      at(7500, () => {
        setPhase('loading');
        let p = 0;
        const bump = setInterval(() => {
          p = Math.min(100, p + 6);
          setProgress(p);
          if (p >= 100) clearInterval(bump);
        }, 90);
        intervals.current.push(bump);
      });
      at(7700, () => setRuleIdx(1));
      at(8150, () => setRuleIdx(4));
      at(8600, () => setRuleIdx(7));

      // 9s–11.5s: reveal the Suggested Schedule, shift cells appearing progressively.
      at(9000, () => {
        setPhase('revealing');
        let n = 0;
        const step = setInterval(() => {
          n += 1;
          setRevealedCount(n);
          if (n >= TOTAL_SHIFTS) clearInterval(step);
        }, Math.floor(2300 / TOTAL_SHIFTS));
        intervals.current.push(step);
      });

      // 11.5s–13s: completed schedule, existing UI at rest.
      at(11500, () => { setPhase('complete'); setRevealedCount(TOTAL_SHIFTS); });

      // 13s–15s: highlight and click "Create 7 Shifts".
      at(13000, () => setPhase('highlight'));
      clickAt(13300, 13800, 14000, 87, 92);

      // ~15s: smoothly restart from step 1.
      at(15000, runCycle);
    }

    runCycle();
    return clearAll;
  }, []);

  const stepIdx = STEP_OF_PHASE[phase];
  // revealing/complete/highlight all render the same results panel — group them under one key so
  // the panel doesn't remount (and re-play its fade-in) between them, which read as a double flash
  // right before the loop restarts.
  const contentGroup = phase === 'revealing' || phase === 'complete' || phase === 'highlight' ? 'results' : phase;
  // Same behavior as the real modal: narrow while stepping through Dates/Departments/Shift/Generate,
  // then widens once the AI has produced a schedule to show — see the `width:` ternary on the real
  // "AI SHIFT SCHEDULING MODAL" in src/components/shifts/ShiftsView.tsx.
  const isWide = contentGroup === 'results';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 440,
        borderRadius: 20,
        background: '#F1F5F9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes aiDemoTabIn { from { opacity: 0; transform: translateY(6px) scale(0.99) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes aiDemoFieldIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes aiDemoCheckIn { from { opacity: 0; transform: scale(0.4) } to { opacity: 1; transform: scale(1) } }
        @keyframes aiDemoCellIn { from { opacity: 0; transform: scale(0.85) } to { opacity: 1; transform: scale(1) } }
        @keyframes aiDemoGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.45) } 50% { box-shadow: 0 0 0 6px rgba(124,58,237,0) } }
      `}</style>

      <div
        style={{
          position: 'relative',
          width: isWide ? '100%' : NARROW_CARD_WIDTH,
          maxWidth: WIDE_CARD_WIDTH,
          height: '100%',
          maxHeight: 400,
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #F1F5F9',
          boxShadow: '0 20px 50px rgba(15,23,42,0.14), 0 4px 14px rgba(15,23,42,0.06)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 0.3s ease',
        }}
      >
        {/* header */}
        <div style={{ padding: '13px 16px 11px', borderBottom: '1px solid #F3F4F6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={13} color="#FFFFFF" strokeWidth={2.5} />
            </div>
            <h3 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#111827', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", whiteSpace: 'nowrap' }}>Auto Shift Scheduling</h3>
          </div>
          <span aria-hidden style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280', display: 'flex', padding: 5, borderRadius: 7, flexShrink: 0 }}>
            <X size={13} />
          </span>
        </div>

        {/* body */}
        <div style={{ flex: 1, minHeight: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* step nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {STEP_LABELS.map((label, i) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {i < stepIdx ? (
                  <div style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#F5F3FF', color: ACCENT }}>
                    <ChevronLeft size={11} strokeWidth={2.75} />
                  </div>
                ) : (
                  <div style={{ width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, background: i === stepIdx ? ACCENT : '#F3F4F6', color: i === stepIdx ? '#FFF' : '#9CA3AF', flexShrink: 0, transition: 'background 0.25s ease, color 0.25s ease' }}>
                    {i + 1}
                  </div>
                )}
                {i === stepIdx && <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#111827' }}>{label}</span>}
                {i < STEP_LABELS.length - 1 && <div style={{ width: 12, height: 1.5, background: '#E5E7EB', margin: '0 1px' }} />}
              </div>
            ))}
          </div>

          {/* content */}
          <div key={contentGroup} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, animation: 'aiDemoTabIn 0.25s ease-out' }}>
            {phase === 'dates' && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[{ label: 'From', value: '06/10/2026' }, { label: 'To', value: '06/16/2026' }].map((f, i) => (
                    <div key={f.label} style={{ flex: 1, animation: 'aiDemoFieldIn 0.4s ease-out both', animationDelay: `${i * 150}ms` }}>
                      <span style={fieldLabelStyle}>{f.label}</span>
                      <span style={pickerTriggerStyle}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' }}>
                          <CalendarDays size={12} color="#64748B" style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap' }}>{f.value}</span>
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <span style={{ marginTop: 'auto', alignSelf: 'flex-end', ...continueBtnStyle(cursor.clicking) }}>Continue</span>
              </div>
            )}

            {phase === 'departments' && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ ...fieldLabelStyle, marginBottom: 0 }}>Departments</span>
                  <span style={{ display: 'flex', gap: 5 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 6, border: '1px solid #E5E7EB', color: ACCENT }}><CheckCheck size={11} /></span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 6, border: '1px solid #E5E7EB', color: '#9CA3AF' }}><X size={11} /></span>
                  </span>
                </div>
                {[{ name: 'Operations', id: DEPT_OPS }, { name: 'Sales', id: DEPT_SALES }].map((d, i) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 9, border: '1.5px solid #E5E7EB', background: '#FFFFFF', animation: 'aiDemoFieldIn 0.35s ease-out both', animationDelay: `${i * 180}ms` }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: deptColor(d.id), flexShrink: 0 }} />
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                    </span>
                    <span
                      style={{
                        width: 15, height: 15, borderRadius: 5, flexShrink: 0,
                        border: `2px solid ${ACCENT}`, background: ACCENT,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'aiDemoCheckIn 0.3s ease-out both', animationDelay: `${350 + i * 200}ms`,
                      }}
                    >
                      <Check size={9} color="#FFFFFF" strokeWidth={3} />
                    </span>
                  </div>
                ))}
                <span style={{ marginTop: 'auto', alignSelf: 'flex-end', ...continueBtnStyle(cursor.clicking) }}>Continue</span>
              </div>
            )}

            {phase === 'shiftTypes' && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ ...fieldLabelStyle, marginBottom: 0 }}>Shift</span>
                <div style={{ padding: '10px 11px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#FFFFFF' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[{ label: 'Start Time', value: '9:00 AM' }, { label: 'End Time', value: '5:00 PM' }].map((f, i) => (
                      <div key={f.label} style={{ animation: 'aiDemoFieldIn 0.35s ease-out both', animationDelay: `${i * 180}ms` }}>
                        <span style={fieldLabelStyle}>{f.label}</span>
                        <span style={pickerTriggerStyle}>
                          <span style={{ whiteSpace: 'nowrap' }}>{f.value}</span>
                          <ChevronDown size={11} color="#9CA3AF" style={{ flexShrink: 0 }} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <span style={{ marginTop: 'auto', alignSelf: 'flex-end', ...continueBtnStyle(cursor.clicking) }}>Continue</span>
              </div>
            )}

            {phase === 'cta' && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px 12px', background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`, borderRadius: 8,
                    fontWeight: 600, fontSize: '0.6875rem', color: '#FFFFFF',
                    transform: cursor.clicking ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.15s ease',
                  }}
                >
                  <Sparkles size={11} strokeWidth={2.5} />
                  Generate Schedule with AI
                </span>
              </div>
            )}

            {phase === 'loading' && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
                <div style={{ width: '100%', height: 6, borderRadius: 999, background: '#EDE9FE', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', borderRadius: 999, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`, transition: 'width 0.09s linear' }} />
                </div>
                <div key={ruleIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, textAlign: 'center', animation: 'aiDemoTabIn 0.25s ease-out' }}>
                  <span style={{ display: 'inline-flex', width: 16, height: 16, borderRadius: '50%', background: ACCENT, alignItems: 'center', justifyContent: 'center' }}>
                    <Spinner size={10} />
                  </span>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: ACCENT_DEEP }}>{AI_SCHEDULE_RULE_STEPS[ruleIdx]}</span>
                </div>
              </div>
            )}

            {(phase === 'revealing' || phase === 'complete' || phase === 'highlight') && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.6875rem', color: '#374151' }}>Suggested Schedule</span>
                  <span style={{ fontSize: 9.5, fontWeight: 500, color: '#9CA3AF' }}>Drag a shift to reassign</span>
                </div>

                <div style={{ flex: 1, minHeight: 0, borderRadius: 10, overflow: 'hidden', border: `1px solid ${PANEL_BORDER}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: `${NAME_COL}px repeat(${DAY_LABELS.length}, 1fr)`, background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', height: 28 }}>
                    <div style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }} />
                    {DAY_LABELS.map(day => (
                      <div key={day.w} style={{ padding: '3px 2px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <p style={{ margin: 0, fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.85)', lineHeight: 1.1 }}>{day.d}</p>
                        <p style={{ margin: 0, fontSize: 8, fontWeight: 500, color: 'rgba(255,255,255,0.5)', lineHeight: 1.1 }}>{day.w}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    {ROWS.map((row, rowIdx) => {
                      const barColor = deptColor(row.deptId);
                      return (
                        <div key={row.key} style={{ display: 'grid', gridTemplateColumns: `${NAME_COL}px repeat(${DAY_LABELS.length}, 1fr)`, borderTop: rowIdx === 0 ? 'none' : `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', minHeight: 30 }}>
                          <div style={{ display: 'flex', alignItems: 'center', borderRight: `1px solid ${PANEL_BORDER}`, overflow: 'hidden' }}>
                            <div style={{ width: 4, alignSelf: 'stretch', flexShrink: 0, background: barColor, opacity: 0.85 }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 5px 0 6px', minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, flexShrink: 0, background: row.role === 'Manager' ? '#FFF7ED' : '#F3F4F6', color: row.role === 'Manager' ? '#EA580C' : '#4B5563', borderRadius: 999 }}>
                                {row.role === 'Manager' ? <UserCog size={8} /> : <UserRound size={8} />}
                              </div>
                              <span style={{ fontSize: 9, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
                            </div>
                          </div>
                          {row.cells.map((cell, col) => {
                            const revealIdx = REVEAL_ORDER.findIndex(r => r.rowKey === row.key && r.col === col);
                            const isRevealed = revealIdx === -1 ? true : revealIdx < revealedCount;
                            return (
                              <div key={col} style={{ padding: 2, borderRight: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {cell === 'off' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 999, background: '#F5F3FF', border: '1px solid #C4B5FD', height: 14, width: '100%' }}>
                                    <CalendarDays size={7} color={ACCENT} />
                                  </div>
                                ) : cell === 'gap' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: '#FCA5A5', border: '1px solid #DC2626', height: 14, width: '100%' }}>
                                    <AlertTriangle size={7} color="#7F1D1D" />
                                  </div>
                                ) : cell ? (
                                  isRevealed ? (
                                    <div
                                      style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        height: 14, width: '100%', borderRadius: 999,
                                        background: '#FFFFFF', border: `1.25px solid ${deptColor(cell.deptId)}`,
                                        animation: 'aiDemoCellIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
                                      }}
                                    >
                                      <span style={{ fontSize: 6.5, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>
                                        {formatShiftHour(cell.start)}–{formatShiftHour(cell.end)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div style={{ borderRadius: 999, background: '#F3F4F6', height: 14, width: '100%' }} />
                                  )
                                ) : (
                                  <div style={{ borderRadius: 999, background: '#F3F4F6', height: 14, width: '100%', opacity: 0.5 }} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${PANEL_BORDER}`, borderRadius: 7, background: '#FFFFFF', color: '#0F172A', height: 24, padding: '0 8px', fontSize: '0.625rem', fontWeight: 600 }}>
                    <RotateCw size={9} /> Regenerate
                  </span>
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 10px', height: 24,
                      background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`, borderRadius: 7,
                      fontWeight: 600, fontSize: '0.625rem', color: '#FFFFFF',
                      animation: phase === 'highlight' ? 'aiDemoGlow 0.7s ease-in-out infinite' : 'none',
                      transform: cursor.clicking && phase === 'highlight' ? 'scale(0.94)' : 'scale(1)',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    <Check size={9} /> Create {TOTAL_SHIFTS} Shifts
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* fake cursor — purely decorative, dramatizes the automated "click" through each step */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: `${cursor.x}%`,
            top: `${cursor.y}%`,
            opacity: cursor.visible ? 1 : 0,
            transform: `translate(-20%, -15%) scale(${cursor.clicking ? 0.85 : 1})`,
            transition: 'left 0.55s ease, top 0.55s ease, opacity 0.25s ease, transform 0.15s ease',
            color: '#1C1917',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))',
            pointerEvents: 'none',
          }}
        >
          <MousePointer2 size={16} fill="#FFFFFF" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}
