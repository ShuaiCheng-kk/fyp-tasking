'use client';

// Auto-playing, looping product-demo of the real "Post Job" publish action (Draft -> Active, see
// saveForm('open') / the status pills in src/components/recruitment/RecruitmentView.tsx) for the
// marketing Home Page. Short — most of the time goes to the payoff: the posting actually going
// live on the Job Board.
import { useEffect, useRef, useState } from 'react';
import { Briefcase, Check, Users, MousePointer2 } from 'lucide-react';

const ORANGE = '#F97316';
const ORANGE_DEEP = '#EA580C';
const PANEL_BORDER = '#E2E8F0';

type Phase = 'draft' | 'publishing' | 'live';

export default function JobPublishingDemo() {
  const [phase, setPhase] = useState<Phase>('draft');
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
      setPhase('draft');
      setCursor({ x: 80, y: 20, visible: false, clicking: false });

      // 0s–2.4s: draft job, cursor clicks "Post Job".
      clickAt(1400, 1900, 2100, 84, 90);

      // 2.4s–3s: publishing.
      at(2400, () => setPhase('publishing'));

      // 3s–8s: result — live on the Job Board.
      at(3000, () => setPhase('live'));

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
        @keyframes pubDemoFieldIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
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
            <Briefcase size={13} color="#FFFFFF" strokeWidth={2.5} />
          </div>
          <h3 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#111827', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", whiteSpace: 'nowrap' }}>Post Job</h3>
        </div>

        {/* body */}
        <div style={{ flex: 1, minHeight: 0, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
          <div style={{ border: `1.5px solid ${phase === 'live' ? '#A7F3D0' : PANEL_BORDER}`, borderRadius: 14, padding: '14px 16px', background: phase === 'live' ? '#ECFDF5' : '#FFFFFF', transition: 'border-color 0.3s ease, background 0.3s ease', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#111827' }}>Weekend Barista</span>
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999,
                  fontSize: '0.625rem', fontWeight: 800,
                  background: phase === 'live' ? '#DCFCE7' : '#EFF6FF',
                  color: phase === 'live' ? '#15803D' : '#1D4ED8',
                  transition: 'background 0.3s ease, color 0.3s ease',
                }}
              >
                {phase === 'live' && <Check size={9} strokeWidth={3} />}
                {phase === 'live' ? 'Active' : 'Draft'}
              </span>
            </div>
            <span style={{ fontSize: '0.6875rem', color: '#9CA3AF' }}>Cafe Operations · $12/hour</span>
            {phase === 'live' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, animation: 'pubDemoFieldIn 0.3s ease-out both', fontSize: '0.625rem', fontWeight: 700, color: '#64748B' }}>
                <Users size={11} /> 0 applicants so far
              </div>
            )}
          </div>

          <span
            style={{
              alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.6875rem', color: '#FFFFFF',
              background: phase === 'live' ? '#94A3B8' : `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DEEP})`,
              transform: cursor.clicking ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.15s ease, background 0.3s ease',
            }}
          >
            {phase === 'publishing' ? (
              <svg className="animate-spin" width={11} height={11} viewBox="0 0 18 18">
                <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" />
                <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </svg>
            ) : (
              <Check size={11} />
            )}
            {phase === 'live' ? 'Posted' : phase === 'publishing' ? 'Posting…' : 'Post Job'}
          </span>

          {phase === 'live' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#16A34A', fontSize: '0.75rem', fontWeight: 700, animation: 'pubDemoFieldIn 0.3s ease-out both' }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={11} /></span>
              Now visible on the Job Board
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
