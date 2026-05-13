import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Rocket, Heart } from 'lucide-react';

// ─── Shared styles ────────────────────────────────────────────────────────────

const inner = { maxWidth: '800px', margin: '0 auto', padding: '0 24px' } as const;
const wideInner = { maxWidth: '1280px', margin: '0 auto', padding: '0 24px' } as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MissionPage() {
  return (
    <>
      {/* ========== HERO ========== */}
      <section style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div style={{ ...inner, textAlign: 'center' }}>
          <Link
            href="/about"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.5)',
              marginBottom: '32px',
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}
          >

          </Link>
          <span style={{
            display: 'inline-block',
            background: 'rgba(249,115,22,0.18)',
            color: '#FB923C',
            padding: '5px 14px',
            borderRadius: '100px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            marginBottom: '24px',
          }}>
            Mission
          </span>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '3rem',
            lineHeight: 1.15,
            color: '#FFFFFF',
            marginBottom: '20px',
          }}>
            We built Tasking because SMEs deserve better.
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.0625rem',
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.75,
          }}>
            Not a watered-down version of enterprise software. Not another spreadsheet wrapper.
            A platform built from scratch for the way SMEs actually operate.
          </p>
        </div>
      </section>

      {/* ========== WHY WE BUILT IT ========== */}
      <section style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div style={wideInner}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ width: '44px', height: '44px', background: '#FEF3C7', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={22} color="#F97316" strokeWidth={1.75} />
                </div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.75rem', color: '#1C1917' }}>
                  Why we built it
                </h2>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: '#78716C', lineHeight: 1.8, marginBottom: '16px' }}>
                Across retail floors, F&B kitchens, logistics hubs, and event venues, SME managers were doing the same thing: juggling WhatsApp groups, spreadsheets, paper timesheets, and manual phone calls just to keep their casual workforce running.
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: '#78716C', lineHeight: 1.8 }}>
                They weren&apos;t failing because they lacked effort. They were failing because the tools available were either built for large enterprises with IT departments, or too simple to handle the real complexity of managing people who work flexibly, inconsistently, and across multiple roles.
              </p>
            </div>
            <div style={{ background: '#FFFBF5', border: '1px solid #F0E8D8', borderRadius: '20px', padding: '36px' }}>
              {[
                'Shift coordination done through WhatsApp threads',
                'Clock-ins tracked on paper or not at all',
                'No reliable way to verify who actually showed up',
                'Attendance disputes with no audit trail',
                'Weeks wasted reposting the same job roles',
              ].map((pain, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: i < 4 ? '16px' : '0' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#FEF3C7', border: '2px solid #F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.6875rem', fontWeight: 700, color: '#F97316' }}>{i + 1}</span>
                  </div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#1C1917', lineHeight: 1.65 }}>{pain}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========== WHAT WE SET OUT TO DO ========== */}
      <section style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div style={wideInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
            <div style={{ width: '44px', height: '44px', background: '#FEF3C7', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Rocket size={22} color="#F97316" strokeWidth={1.75} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.75rem', color: '#1C1917' }}>
              What we set out to do
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            {[
              {
                title: 'Automate the repetitive',
                body: 'Every task that a manager does manually on a recurring basis — posting the same job, chasing confirmations, approving clean timesheets — should be handled by the system. Managers should only be involved when something genuinely needs their attention.',
              },
              {
                title: 'Centralise everything',
                body: 'Recruitment, attendance, team structure, notifications — all in one place. No more bouncing between tools, no more data living in five different places, no more version-of-truth problems.',
              },
              {
                title: 'Make verification the default',
                body: 'Photo-verified clock-ins and signed attendance records aren\'t premium features. They\'re the baseline. Every attendance record in Tasking comes with a chain of evidence — so disputes don\'t happen, and when they do, the truth is already on record.',
              },
              {
                title: 'Give smaller businesses real AI',
                body: 'AI candidate ranking, job description generation, auto-approval, and anomaly detection aren\'t locked behind an enterprise plan. They\'re free. Because SMEs need them just as much as anyone else.',
              },
            ].map(({ title, body }) => (
              <div key={title} className="card-lift" style={{ background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '16px', padding: '32px' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.125rem', color: '#1C1917', marginBottom: '10px' }}>{title}</h3>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== WHAT WE STAND FOR ========== */}
      <section style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div style={wideInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
            <div style={{ width: '44px', height: '44px', background: '#FEF3C7', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Heart size={22} color="#F97316" strokeWidth={1.75} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.75rem', color: '#1C1917' }}>
              What we stand for
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {[
              {
                badge: 'Free AI',
                title: 'No paywalls on intelligence',
                body: 'Every AI feature in Tasking — candidate ranking, job description generation, auto-approval, anomaly detection — is free. Not a trial. Not a premium add-on. Free forever. Intelligence shouldn\'t be a luxury.',
              },
              {
                badge: 'Built for SMEs',
                title: 'Not a stripped-down enterprise tool',
                body: 'We didn\'t take an enterprise product and remove features until it was affordable. We started from scratch with SME workflows in mind — 5 to 50 employees, casual contracts, multiple departments, managers who wear ten hats.',
              },
              {
                badge: 'Simple by design',
                title: 'No onboarding programme required',
                body: 'If your team needs a three-day training session to use a scheduling tool, something has already gone wrong. Tasking is designed so that every role — from the owner to the casual worker — can get up and running on day one.',
              },
            ].map(({ badge, title, body }) => (
              <div key={title} style={{ background: '#FFFBF5', border: '1px solid #F0E8D8', borderRadius: '16px', padding: '32px' }}>
                <span style={{ display: 'inline-block', background: '#FEF3C7', color: '#92400E', padding: '4px 12px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'var(--font-body)', marginBottom: '16px' }}>
                  {badge}
                </span>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.125rem', color: '#1C1917', marginBottom: '10px' }}>{title}</h3>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== CTA ========== */}
      <section style={{ background: '#F97316', padding: '72px 24px' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.25rem', color: '#FFFFFF', marginBottom: '16px', lineHeight: 1.2 }}>
            Ready to see it for yourself?
          </h2>
          <Link href="/get-started" className="btn-press" style={{ display: 'inline-block', background: '#FFFFFF', color: '#F97316', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9375rem' }}>
            Get Started Free
          </Link>
        </div>
      </section>
    </>
  );
}
