'use client';

// Auto-playing, looping product-demo of the real "AI Assessment" applicant scoring (see
// recommendCandidates / AiFitGauge in src/components/recruitment/RecruitmentView.tsx) for the
// marketing Home Page. Short — most of the time goes to the payoff: the fit-score bars appearing
// under each applicant.
import { useEffect, useRef, useState } from 'react';
import { Sparkles, UserRound, Star, MousePointer2 } from 'lucide-react';

const ACCENT = '#7C3AED';
const ACCENT_DEEP = '#6D28D9';
const PANEL_BORDER = '#E2E8F0';

type Phase = 'idle' | 'analyzing' | 'result';

const APPLICANTS = [
  { name: 'Chen Wei', applied: '2d ago', score: 88 },
  { name: 'Farah Ismail', applied: '1d ago', score: 62 },
  { name: 'Tan Jun Hao', applied: '5h ago', score: 41 },
];

function FitGauge({ score, revealed }: { score: number; revealed: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 10, borderRadius: 999, overflow: 'hidden', display: 'flex', background: '#F3F4F6' }}>
        <div style={{ width: revealed ? `${score}%` : '0%', height: '100%', background: '#10B981', transition: 'width 0.6s cubic-bezier(0.34,1.2,0.64,1)' }} />
        <div style={{ width: revealed ? `${100 - score}%` : '100%', height: '100%', background: '#FECDD3', transition: 'width 0.6s cubic-bezier(0.34,1.2,0.64,1)' }} />
      </div>
      <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#6B7280', flexShrink: 0, minWidth: 26, textAlign: 'right' }}>{revealed ? `${score}%` : ''}</span>
    </div>
  );
}

export default function AiCandidateRecommendationsDemo() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [revealedCount, setRevealedCount] = useState(0);
  const [showBest, setShowBest] = useState(false);
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
      setShowBest(false);
      setCursor({ x: 80, y: 20, visible: false, clicking: false });

      // 0s–1.6s: applicants waiting, cursor clicks "AI Assessment".
      clickAt(900, 1300, 1500, 82, 22);

      // 1.6s–2.3s: analyzing.
      at(1600, () => setPhase('analyzing'));

      // 2.3s–8s: result — fit-score bars reveal one by one, best match called out.
      at(2300, () => setPhase('result'));
      at(2500, () => setRevealedCount(1));
      at(3100, () => setRevealedCount(2));
      at(3700, () => setRevealedCount(3));
      at(4500, () => setShowBest(true));

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
        @keyframes candDemoFieldIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
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
          <h3 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#111827', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", whiteSpace: 'nowrap' }}>Applicants</h3>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 8,
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`, color: '#FFFFFF',
              height: 26, padding: '0 9px', fontSize: '0.625rem', fontWeight: 700,
              transform: cursor.clicking ? 'scale(0.94)' : 'scale(1)', transition: 'transform 0.15s ease',
            }}
          >
            {phase === 'analyzing' ? (
              <svg className="animate-spin" width={10} height={10} viewBox="0 0 18 18">
                <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" />
                <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </svg>
            ) : (
              <Sparkles size={11} strokeWidth={2.5} />
            )}
            {phase === 'analyzing' ? 'Analyzing…' : 'AI Assessment'}
          </span>
        </div>

        {/* body */}
        <div style={{ flex: 1, minHeight: 0, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {APPLICANTS.map((a, i) => {
            const revealed = phase === 'result' && i < revealedCount;
            const isBest = i === 0 && showBest;
            return (
              <div key={a.name} style={{ border: `1.5px solid ${isBest ? '#86EFAC' : PANEL_BORDER}`, background: isBest ? '#F0FDF4' : '#FFFFFF', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, transition: 'border-color 0.3s ease, background 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 999, background: '#F3F4F6', color: '#4B5563', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserRound size={15} />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#111827' }}>{a.name}</span>
                    <span style={{ display: 'block', fontSize: '0.5625rem', color: '#9CA3AF' }}>Applied {a.applied}</span>
                  </span>
                  {isBest && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, background: '#DCFCE7', color: '#15803D', fontSize: '0.5625rem', fontWeight: 800, animation: 'candDemoFieldIn 0.3s ease-out both', flexShrink: 0 }}>
                      <Star size={9} strokeWidth={2.5} /> Best Match
                    </span>
                  )}
                </div>
                <FitGauge score={a.score} revealed={revealed} />
              </div>
            );
          })}
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
