'use client';

// Auto-playing, looping product-demo of the real "AI Job Builder" wizard (see wizardStep === 'ai'
// in src/components/recruitment/RecruitmentView.tsx's Post Job modal) for the marketing Home Page.
// Same shape as the other AI demos (choose job type -> describe -> generate -> editable draft),
// reusing the purple AI accent, on its own scripted timeline since the real wizard needs an
// authenticated company session.
import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Repeat, Zap, MousePointer2 } from 'lucide-react';

const ACCENT = '#7C3AED';
const ACCENT_DEEP = '#6D28D9';
const PANEL_BORDER = '#E2E8F0';

const fieldLabelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: '0.625rem', color: '#374151', marginBottom: 5 };

const fieldBoxStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, background: '#FFFFFF',
  padding: '6px 8px', fontSize: '0.625rem', fontWeight: 500, color: '#0F172A', lineHeight: 1.5,
};

const continueBtnStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '7px 14px', background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`,
  borderRadius: 8, color: '#FFFFFF', fontWeight: 600, fontSize: '0.6875rem',
  transform: active ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.15s ease',
});

type Phase = 'type' | 'describe' | 'loading' | 'review' | 'highlight';

export default function AiJobDescriptionDemo() {
  const [phase, setPhase] = useState<Phase>('type');
  const [typeSelected, setTypeSelected] = useState(false);
  const [promptTyped, setPromptTyped] = useState(false);
  const [titleFilled, setTitleFilled] = useState(false);
  const [respFilled, setRespFilled] = useState(false);
  const [skillsFilled, setSkillsFilled] = useState(false);
  const [cursor, setCursor] = useState({ x: 80, y: 80, visible: false, clicking: false });
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
      setPhase('type');
      setTypeSelected(false);
      setPromptTyped(false);
      setTitleFilled(false);
      setRespFilled(false);
      setSkillsFilled(false);
      setCursor({ x: 80, y: 80, visible: false, clicking: false });

      // 0s–1.8s: choose "Shift Job".
      clickAt(700, 1100, 1300, 50, 32);
      at(1100, () => setTypeSelected(true));

      // 1.8s–4s: describe the job, click Generate.
      at(1800, () => setPhase('describe'));
      at(2200, () => setPromptTyped(true));
      clickAt(3400, 3700, 3900, 87, 88);

      // 4s–5.5s: AI generating.
      at(4000, () => setPhase('loading'));

      // 5.5s–9s: review — editable AI draft.
      at(5500, () => {
        setPhase('review');
        setTitleFilled(true);
      });
      at(6100, () => setRespFilled(true));
      at(6700, () => setSkillsFilled(true));

      // 9s–11s: highlight and click "Continue".
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
        @keyframes jobDemoTabIn { from { opacity: 0; transform: translateY(6px) scale(0.99) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes jobDemoFieldIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes jobDemoGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.45) } 50% { box-shadow: 0 0 0 6px rgba(124,58,237,0) } }
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
            <h3 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#111827', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", whiteSpace: 'nowrap' }}>Post Job</h3>
          </div>
          <span aria-hidden style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280', display: 'flex', padding: 5, borderRadius: 7, flexShrink: 0 }}>
            <X size={13} />
          </span>
        </div>

        {/* body */}
        <div style={{ flex: 1, minHeight: 0, padding: 16, display: 'flex', flexDirection: 'column' }}>
          {phase === 'type' && (
            <div key="type" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, animation: 'jobDemoTabIn 0.25s ease-out' }}>
              {[
                { Icon: Repeat, title: 'Shift Job', desc: 'Fixed schedule with a defined start and end time.' },
                { Icon: Zap, title: 'One-Off Job', desc: 'Complete a specific task with a fixed start time.' },
              ].map(({ Icon, title, desc }, i) => (
                <div key={title} style={{ padding: '10px 12px', border: `1.5px solid ${i === 0 && typeSelected ? ACCENT : PANEL_BORDER}`, borderRadius: 10, background: i === 0 && typeSelected ? '#FAF5FF' : '#FFFFFF', display: 'flex', alignItems: 'center', gap: 10, transition: 'border-color 0.2s ease, background 0.2s ease' }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={13} color={ACCENT} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: '0.6875rem', color: '#374151' }}>{title}</span>
                    <span style={{ display: 'block', fontSize: '0.5625rem', color: '#9CA3AF' }}>{desc}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {phase === 'describe' && (
            <div key="describe" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, animation: 'jobDemoTabIn 0.25s ease-out' }}>
              <div>
                <span style={fieldLabelStyle}>Describe Your Job</span>
                <span style={{ ...fieldBoxStyle, display: 'block', minHeight: 54, color: promptTyped ? '#0F172A' : '#9CA3AF' }}>
                  {promptTyped ? 'Need a barista for weekend morning shifts at our downtown cafe, must be friendly and reliable.' : 'e.g. Need a barista for weekend morning shifts…'}
                </span>
              </div>
              <span style={{ marginTop: 'auto', alignSelf: 'flex-end', ...continueBtnStyle(cursor.clicking) }}>
                <Sparkles size={11} strokeWidth={2.5} /> Generate
              </span>
            </div>
          )}

          {phase === 'loading' && (
            <div key="loading" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, animation: 'jobDemoTabIn 0.25s ease-out' }}>
              <div style={{ width: '100%', height: 6, borderRadius: 999, background: '#EDE9FE', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: 999, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`, animation: 'jobDemoFieldIn 1.4s ease-out both' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, textAlign: 'center' }}>
                <span style={{ display: 'inline-flex', width: 16, height: 16, borderRadius: '50%', background: ACCENT, alignItems: 'center', justifyContent: 'center' }}>
                  <svg className="animate-spin" width={10} height={10} viewBox="0 0 18 18">
                    <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" />
                    <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  </svg>
                </span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: ACCENT_DEEP }}>Writing the job description…</span>
              </div>
            </div>
          )}

          {(phase === 'review' || phase === 'highlight') && (
            <div key="review" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, animation: 'jobDemoTabIn 0.25s ease-out' }}>
              <div>
                <span style={fieldLabelStyle}>Job Title</span>
                <span style={{ ...fieldBoxStyle, animation: titleFilled ? 'jobDemoFieldIn 0.3s ease-out both' : 'none' }}>
                  {titleFilled ? 'Weekend Barista' : ''}
                </span>
              </div>
              <div>
                <span style={fieldLabelStyle}>Responsibilities</span>
                <span style={{ ...fieldBoxStyle, display: 'block', minHeight: 40, animation: respFilled ? 'jobDemoFieldIn 0.3s ease-out both' : 'none' }}>
                  {respFilled ? 'Prepare coffee and beverages, serve customers, keep the counter clean during weekend morning shifts.' : ''}
                </span>
              </div>
              <div>
                <span style={fieldLabelStyle}>Skills &amp; Qualifications</span>
                <span style={{ ...fieldBoxStyle, display: 'block', minHeight: 32, animation: skillsFilled ? 'jobDemoFieldIn 0.3s ease-out both' : 'none' }}>
                  {skillsFilled ? 'Friendly, reliable, prior cafe experience preferred.' : ''}
                </span>
              </div>
              <span
                style={{
                  marginTop: 'auto', alignSelf: 'flex-end',
                  ...continueBtnStyle(cursor.clicking && phase === 'highlight'),
                  animation: phase === 'highlight' ? 'jobDemoGlow 0.7s ease-in-out infinite' : 'none',
                }}
              >
                Continue
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
