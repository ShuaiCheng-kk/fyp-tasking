'use client';

// Auto-playing, looping product-demo of the real "Sub Task" toggle + SubTaskOrderList (see
// src/components/tasks/TasksView.tsx's task-creation "Sub Task" card, and the numbered checklist
// used on My Tasks boards) for the marketing Home Page. Short — most of the time goes to the
// payoff: a task actually broken into a tracked checklist.
import { useEffect, useRef, useState } from 'react';
import { GitBranch, Plus, Check, MousePointer2 } from 'lucide-react';

const ORANGE = '#F97316';
const ORANGE_DEEP = '#EA580C';
const PANEL_BORDER = '#E2E8F0';

const fieldLabelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: '0.625rem', color: '#374151', marginBottom: 5 };

type Phase = 'toggle' | 'adding' | 'result';

const SUB_TASKS = ['Book the venue', 'Send invitations', 'Confirm catering'];

export default function SubtasksDemo() {
  const [phase, setPhase] = useState<Phase>('toggle');
  const [checked, setChecked] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
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
      setAddedCount(0);
      setDoneCount(0);
      setCursor({ x: 80, y: 20, visible: false, clicking: false });

      // 0s–1.6s: switch "Sub Task" on.
      clickAt(700, 1000, 1200, 82, 30);
      at(1000, () => setChecked(true));

      // 1.6s–4.4s: add 3 sub-tasks one at a time.
      at(1600, () => setPhase('adding'));
      clickAt(1700, 2000, 2200, 88, 75);
      at(2000, () => setAddedCount(1));
      clickAt(2600, 2900, 3100, 88, 75);
      at(2900, () => setAddedCount(2));
      clickAt(3500, 3800, 4000, 88, 75);
      at(3800, () => setAddedCount(3));

      // 4.4s–8s: result — the tracked checklist, progress ticking off.
      at(4400, () => setPhase('result'));
      at(5000, () => setDoneCount(1));
      at(5800, () => setDoneCount(2));

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
        @keyframes subDemoFieldIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes subDemoRowIn { from { opacity: 0; transform: scale(0.9) translateY(4px) } to { opacity: 1; transform: scale(1) translateY(0) } }
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
            <GitBranch size={13} color="#FFFFFF" strokeWidth={2.5} />
          </div>
          <h3 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#111827', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", whiteSpace: 'nowrap' }}>Plan the Team Offsite</h3>
        </div>

        {/* body */}
        <div style={{ flex: 1, minHeight: 0, padding: 16, display: 'flex', flexDirection: 'column' }}>
          {phase !== 'result' ? (
            <div style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 10, padding: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.75rem', color: '#374151' }}>
                  <GitBranch size={13} color={ORANGE} /> Sub Task
                  {addedCount > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 5px', borderRadius: 8, background: '#FFF3E8', color: ORANGE_DEEP, fontSize: 10, fontWeight: 800 }}>{addedCount}</span>
                  )}
                </span>
                <span style={{ width: 30, height: 17, borderRadius: 999, background: checked ? ORANGE : '#E5E7EB', position: 'relative', transition: 'background 0.25s ease', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 2, left: checked ? 15 : 2, width: 13, height: 13, borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.25s ease' }} />
                </span>
              </div>

              {checked && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, animation: 'subDemoFieldIn 0.3s ease-out both' }}>
                  {SUB_TASKS.map((t, i) => i < addedCount && (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, animation: 'subDemoRowIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                      <span style={{ width: 17, height: 17, borderRadius: '50%', background: '#FFF3E8', color: ORANGE_DEEP, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#111827' }}>{t}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ flex: 1, minWidth: 0, ...fieldLabelStyle, margin: 0, padding: '7px 9px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, fontWeight: 500, color: '#9CA3AF', fontSize: '0.625rem' }}>Sub-task title...</span>
                    <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 7, background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DEEP})`, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: cursor.clicking ? 'scale(0.9)' : 'scale(1)', transition: 'transform 0.15s ease' }}>
                      <Plus size={13} strokeWidth={2.5} />
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: '0.6875rem', color: '#374151' }}>{doneCount} of {SUB_TASKS.length} done</span>
              {SUB_TASKS.map((t, i) => {
                const done = i < doneCount;
                return (
                  <div key={t} style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ width: 18, height: 18, marginTop: 8, borderRadius: '50%', background: done ? '#DCFCE7' : '#FFF3E8', color: done ? '#15803D' : ORANGE_DEEP, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.25s ease, color 0.25s ease' }}>
                        {i + 1}
                      </span>
                      {i < SUB_TASKS.length - 1 && <div style={{ width: 1, flex: 1, background: PANEL_BORDER }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: done ? '#9CA3AF' : '#111827' }}>{t}</span>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: done ? '#16A34A' : '#FFFFFF', border: done ? 'none' : '1.5px solid #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.25s ease' }}>
                        {done && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                      </span>
                    </div>
                  </div>
                );
              })}
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
