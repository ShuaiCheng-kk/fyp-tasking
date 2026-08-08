'use client';

// Auto-playing, looping product-demo of the real "Auto Task Assignment" AI modal (see the
// AI TASK ASSIGNMENT MODAL in src/components/tasks/TasksView.tsx) for the marketing Home Page.
// Same shape as the Shift Management "AI Schedule Suggestions" demo (input -> AI generation ->
// review -> create), reusing the purple accent and layout the real modal uses, restyled lighter
// rather than pixel-exact, on its own scripted timeline since the real modal needs an
// authenticated company session and live Supabase-backed members/departments.
import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, ChevronDown, GitBranch, Check, UserRound, MousePointer2 } from 'lucide-react';

const ACCENT = '#7C3AED';
const ACCENT_DEEP = '#6D28D9';
const PANEL_BORDER = '#E2E8F0';

const fieldLabelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: '0.625rem', color: '#374151', marginBottom: 5 };

const triggerStyle: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
  border: '1px solid #E2E8F0', borderRadius: 8, background: '#FFFFFF',
  padding: '6px 8px', fontSize: '0.6875rem', fontWeight: 500, color: '#0F172A',
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  High: { bg: '#FFEDD5', text: '#C2410C' },
};

const SUB_TASKS = ['Compile Q2 sales figures by region', 'Draft summary charts and KPIs', 'Review with finance before sending'];

type Phase = 'input' | 'loading' | 'review' | 'highlight';

const continueBtnStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '7px 14px', background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`,
  borderRadius: 8, color: '#FFFFFF', fontWeight: 600, fontSize: '0.6875rem',
  transform: active ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.15s ease',
});

export default function AiTaskAssignDemo() {
  const [phase, setPhase] = useState<Phase>('input');
  const [titleTyped, setTitleTyped] = useState(false);
  const [subToggle, setSubToggle] = useState(false);
  const [revealedSubTasks, setRevealedSubTasks] = useState(0);
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
      setPhase('input');
      setTitleTyped(false);
      setSubToggle(false);
      setRevealedSubTasks(0);
      setCursor({ x: 80, y: 80, visible: false, clicking: false });

      // 0s–3s: fill in the task title, priority, deadline, and toggle Sub Task on.
      at(400, () => setTitleTyped(true));
      at(1600, () => setSubToggle(true));
      clickAt(2300, 2700, 2900, 62, 88);

      // 3s–4.5s: AI generating.
      at(3000, () => setPhase('loading'));

      // 4.5s–9s: review — AI-written description, recommended assignee, generated sub-tasks.
      at(4500, () => {
        setPhase('review');
        let n = 0;
        const step = setInterval(() => {
          n += 1;
          setRevealedSubTasks(n);
          if (n >= SUB_TASKS.length) clearInterval(step);
        }, 450);
        intervals.current.push(step);
      });

      // 9s–11s: highlight and click "Create Task".
      at(9000, () => setPhase('highlight'));
      clickAt(9300, 9800, 10000, 87, 92);

      // ~12s: smoothly restart.
      at(12000, runCycle);
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
        @keyframes taskDemoTabIn { from { opacity: 0; transform: translateY(6px) scale(0.99) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes taskDemoFieldIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes taskDemoChipIn { from { opacity: 0; transform: scale(0.85) translateY(4px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes taskDemoGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.45) } 50% { box-shadow: 0 0 0 6px rgba(124,58,237,0) } }
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
            <div style={{ width: 26, height: 26, borderRadius: 8, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={13} color="#FFFFFF" strokeWidth={2.5} />
            </div>
            <h3 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#111827', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", whiteSpace: 'nowrap' }}>Auto Task Assignment</h3>
          </div>
          <span aria-hidden style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280', display: 'flex', padding: 5, borderRadius: 7, flexShrink: 0 }}>
            <X size={13} />
          </span>
        </div>

        {/* body */}
        <div style={{ flex: 1, minHeight: 0, padding: 16, display: 'flex', flexDirection: 'column' }}>
          {phase === 'input' && (
            <div key="input" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12, animation: 'taskDemoTabIn 0.25s ease-out' }}>
              <div>
                <span style={fieldLabelStyle}>Task Title</span>
                <span style={triggerStyle}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: titleTyped ? '#0F172A' : '#9CA3AF' }}>
                    {titleTyped ? 'Prepare quarterly sales report' : 'e.g. Prepare quarterly financial report'}
                  </span>
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <span style={fieldLabelStyle}>Priority</span>
                  <span style={triggerStyle}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 999, background: PRIORITY_COLORS.High.bg, color: PRIORITY_COLORS.High.text, fontSize: '0.625rem', fontWeight: 700 }}>High</span>
                    <ChevronDown size={11} color="#9CA3AF" />
                  </span>
                </div>
                <div>
                  <span style={fieldLabelStyle}>Deadline</span>
                  <span style={triggerStyle}>
                    <span>06/20/2026</span>
                  </span>
                </div>
              </div>
              <div style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.75rem', color: '#374151' }}>
                  <GitBranch size={12} color={ACCENT} /> Sub Task
                </span>
                <span style={{ width: 30, height: 17, borderRadius: 999, background: subToggle ? ACCENT : '#E5E7EB', position: 'relative', transition: 'background 0.25s ease', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 2, left: subToggle ? 15 : 2, width: 13, height: 13, borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.25s ease' }} />
                </span>
              </div>
              <span style={{ marginTop: 'auto', alignSelf: 'flex-end', ...continueBtnStyle(cursor.clicking) }}>Generate</span>
            </div>
          )}

          {phase === 'loading' && (
            <div key="loading" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, animation: 'taskDemoTabIn 0.25s ease-out' }}>
              <div style={{ width: '100%', height: 6, borderRadius: 999, background: '#EDE9FE', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: 999, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`, animation: 'taskDemoFieldIn 1.4s ease-out both' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, textAlign: 'center' }}>
                <span style={{ display: 'inline-flex', width: 16, height: 16, borderRadius: '50%', background: ACCENT, alignItems: 'center', justifyContent: 'center' }}>
                  <svg className="animate-spin" width={10} height={10} viewBox="0 0 18 18">
                    <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" />
                    <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  </svg>
                </span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: ACCENT_DEEP }}>Matching the best assignee and drafting sub-tasks…</span>
              </div>
            </div>
          )}

          {(phase === 'review' || phase === 'highlight') && (
            <div key="review" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, animation: 'taskDemoTabIn 0.25s ease-out', overflow: 'hidden' }}>
              <div>
                <span style={fieldLabelStyle}>Task Title</span>
                <span style={triggerStyle}><span>Prepare quarterly sales report</span></span>
              </div>
              <div>
                <span style={fieldLabelStyle}>Description</span>
                <span style={{ ...triggerStyle, display: 'block', minHeight: 32, lineHeight: 1.4, whiteSpace: 'normal' }}>
                  Compile Q2 sales figures across all departments and prepare a summary report for leadership review.
                </span>
              </div>
              <div>
                <span style={fieldLabelStyle}>Recommended Assignee</span>
                <span style={{ ...triggerStyle, background: '#FAF5FF', border: `1px solid #E9D5FF` }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 16, height: 16, borderRadius: 999, background: '#F3E8FF', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UserRound size={9} /></span>
                    Aisha Rahman
                  </span>
                  <ChevronDown size={11} color="#9CA3AF" />
                </span>
              </div>

              {subToggle && (
                <div style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                    <GitBranch size={11} color={ACCENT} />
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#374151' }}>Sub-Tasks</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 15, height: 15, padding: '0 4px', borderRadius: 8, background: '#F3E8FF', color: ACCENT, fontSize: 9, fontWeight: 800 }}>{revealedSubTasks}</span>
                  </div>
                  <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {SUB_TASKS.map((t, i) => i < revealedSubTasks && (
                      <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 7, border: `1px solid ${PANEL_BORDER}`, animation: 'taskDemoChipIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                        <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#F3E8FF', color: ACCENT, fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#111827' }}>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <span
                style={{
                  marginTop: 'auto', alignSelf: 'flex-end',
                  ...continueBtnStyle(cursor.clicking && phase === 'highlight'),
                  animation: phase === 'highlight' ? 'taskDemoGlow 0.7s ease-in-out infinite' : 'none',
                }}
              >
                <Check size={11} /> Create Task
              </span>
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
