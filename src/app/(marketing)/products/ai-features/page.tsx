import Link from 'next/link';

// ─── Design tokens ────────────────────────────────────────────────────────────

const inner: React.CSSProperties = { maxWidth: '1280px', margin: '0 auto', padding: '0 24px' };

const h2style: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontWeight: 700,
  fontSize: '2.25rem',
  color: '#1C1917',
  marginBottom: '12px',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: '1.0625rem',
  color: '#78716C',
  lineHeight: 1.75,
  maxWidth: '560px',
  margin: '0 auto',
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const IcoStar = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" stroke="#F97316" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);
const IcoPen = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcoCheck = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="#F97316" strokeWidth="2" />
    <path d="M8 12l3 3 5-5" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcoShield = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 12l2 2 4-4" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcoCalendar = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="5" width="18" height="16" rx="2" stroke="#F97316" strokeWidth="2" />
    <path d="M3 9.5h18M8 3v4M16 3v4" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 14.5l2.5 2.5L16 12" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Shared components ────────────────────────────────────────────────────────

const IconBox = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: '48px', height: '48px', background: '#FEF3C7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
    {children}
  </div>
);

function FeatureCard({ icon, name, desc }: { icon: React.ReactNode; name: string; desc: string }) {
  return (
    <div className="card-lift" style={{ background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '16px', padding: '28px' }}>
      <IconBox>{icon}</IconBox>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.0625rem', color: '#1C1917', marginBottom: '8px' }}>{name}</h3>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7 }}>{desc}</p>
    </div>
  );
}

function CtaBanner({ headline, sub, ctaLabel = 'Get Started Free', ctaHref = '/get-started' }: { headline: string; sub: string; ctaLabel?: string; ctaHref?: string }) {
  return (
    <section className="cta-banner" style={{ background: '#F97316', padding: '80px 24px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.5rem', color: '#FFFFFF', marginBottom: '16px', lineHeight: 1.2 }}>{headline}</h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, marginBottom: '36px' }}>{sub}</p>
        <Link href={ctaHref} className="btn-press" style={{ display: 'inline-block', background: '#FFFFFF', color: '#F97316', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9375rem' }}>
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AiFeaturesPage() {
  const steps = [
    { step: '01', label: 'Schedule', title: 'Build the week', desc: 'AI suggests a conflict-free shift schedule based on availability and coverage needs — so you start from a draft, not a blank grid.' },
    { step: '02', label: 'Recruit', title: 'Post a job', desc: 'AI generates the description and ranks applicants automatically — so you open the list already knowing who to pick.' },
    { step: '03', label: 'Monitor', title: 'Shift runs', desc: 'AI watches for photo mismatches and unusual clock-in patterns, flagging anything that looks off before it becomes a dispute.' },
  ];

  return (
    <>
      {/* ========== HERO ========== */}
      <section className="sub-section" style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div className="sub-inner" style={{ ...inner, textAlign: 'center' }}>
          <span style={{ display: 'inline-block', background: 'rgba(249,115,22,0.18)', color: '#FB923C', padding: '5px 14px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: '24px' }}>
            AI Features
          </span>
          <h1 className="sub-hero-h1" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', maxWidth: '700px', margin: '0 auto 20px' }}>
            Enterprise-grade AI. Built into Pro.
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, maxWidth: '560px', margin: '0 auto 36px' }}>
            Five intelligent tools built into your workflow, included with every Pro plan — no separate add-ons, no per-feature pricing.
          </p>
          <Link href="/pricing" className="btn-press cta-shimmer" style={{ display: 'inline-block', background: '#F97316', color: '#FFFFFF', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9375rem' }}>
            See Pricing
          </Link>
        </div>
      </section>

      {/* ========== FEATURES GRID ========== */}
      <section className="sub-section" style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div className="sub-inner" style={inner}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 className="sub-h2" style={h2style}>What&apos;s inside</h2>
            <p style={subtitleStyle}>Five AI tools. All included with Pro.</p>
          </div>
          <div className="grid-features-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <FeatureCard icon={<IcoCalendar />} name="AI Schedule Suggestion" desc="Tell Tasking who's available and what coverage you need. Get a conflict-free shift schedule suggested in seconds, ready to publish." />
            <FeatureCard icon={<IcoCheck />} name="AI Task Assignment Suggestion" desc="Tasking matches the right person to the right task based on skills and current workload — so nothing falls on the wrong desk." />
            <FeatureCard icon={<IcoPen />} name="AI Job Description Generator" desc="Enter a role title and key requirements. Get a ready-to-publish job description in seconds. No more staring at a blank page." />
            <FeatureCard icon={<IcoStar />} name="AI Candidate Recommendation" desc="Stop guessing who's the right fit. Tasking ranks every applicant by skills, availability, and work history — so the best match is always at the top." />
            <FeatureCard icon={<IcoShield />} name="AI Anomaly Detection" desc="Photo mismatches, unusual clock-in patterns, repeated late arrivals — Tasking catches them automatically before they turn into disputes." />
          </div>
        </div>
      </section>

      {/* ========== HOW IT FITS INTO YOUR WORKFLOW ========== */}
      <section className="sub-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div className="sub-inner" style={inner}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 className="sub-h2" style={h2style}>AI that works with you, not around you.</h2>
            <p style={subtitleStyle}>These aren&apos;t standalone tools. They&apos;re built into the exact moments in your workflow where they matter most.</p>
          </div>

          <div className="grid-steps-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0', position: 'relative' }}>
            {steps.map(({ step, label, title, desc }, i) => (
              <div key={step} style={{ position: 'relative' }}>
                {i < 2 && <div className="step-connector" style={{ position: 'absolute', top: '36px', right: '0', width: '50%', height: '2px', background: 'linear-gradient(90deg, #F97316, #FED7AA)', zIndex: 0 }} />}
                {i > 0 && <div className="step-connector" style={{ position: 'absolute', top: '36px', left: '0', width: '50%', height: '2px', background: 'linear-gradient(90deg, #FED7AA, #F97316)', zIndex: 0 }} />}
                <div style={{ padding: '0 32px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#FEF3C7', border: '3px solid #F97316', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.6875rem', fontWeight: 700, color: '#F97316', letterSpacing: '0.08em' }}>STEP</span>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 700, color: '#F97316', lineHeight: 1 }}>{step}</span>
                  </div>
                  <span style={{ display: 'inline-block', background: '#FEF3C7', color: '#92400E', padding: '2px 10px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: '12px' }}>{label}</span>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.125rem', color: '#1C1917', marginBottom: '10px' }}>{title}</h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <CtaBanner
        headline="Ready to put AI to work?"
        sub="All five AI features are included with the Pro plan, starting at $20/month."
        ctaLabel="See Pricing"
        ctaHref="/pricing"
      />
    </>
  );
}