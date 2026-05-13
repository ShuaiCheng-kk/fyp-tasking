import Link from 'next/link';

const inner: React.CSSProperties = { maxWidth: '1280px', margin: '0 auto', padding: '0 24px' };
const h2style: React.CSSProperties = { fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' };
const subtitleStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.75, maxWidth: '560px', margin: '0 auto' };

const IcoClock = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#F97316" strokeWidth="2" /><path d="M12 6v6l4 2" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoCamera = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="13" r="4" stroke="#F97316" strokeWidth="2" /></svg>);
const IcoSign = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><polygon points="18 2 22 6 12 16 8 16 8 12 18 2" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoCheck = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M22 4L12 14.01l-3-3" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoLock = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#F97316" strokeWidth="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#F97316" strokeWidth="2" strokeLinecap="round" /></svg>);
const IcoStar = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" stroke="#F97316" strokeWidth="2" strokeLinejoin="round" /></svg>);
const IcoShield = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const IconBox = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: '48px', height: '48px', background: '#FEF3C7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>{children}</div>
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

function CtaBanner({ headline, sub }: { headline: string; sub: string }) {
  return (
    <section className="cta-banner" style={{ background: '#F97316', padding: '80px 24px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.5rem', color: '#FFFFFF', marginBottom: '16px', lineHeight: 1.2 }}>{headline}</h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, marginBottom: '36px' }}>{sub}</p>
        <Link href="/get-started" className="btn-press" style={{ display: 'inline-block', background: '#FFFFFF', color: '#F97316', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9375rem' }}>Get Started Free</Link>
      </div>
    </section>
  );
}

export default function AttendancePage() {
  const features = [
    { icon: <IcoClock />, name: 'Clock In & Clock Out', desc: 'Simple, reliable time tracking for every casual worker on every shift — accessible from any browser, no hardware required.' },
    { icon: <IcoCamera />, name: 'Photo-based Verification', desc: 'Every clock-in comes with a live photo attached to the record. You always know who actually showed up.' },
    { icon: <IcoSign />, name: 'Attendance Confirmation & Submission', desc: 'Employees confirm the casual worker\'s presence on the ground, sign the record, and submit it to the manager — all within the platform.' },
    { icon: <IcoCheck />, name: 'Review & Approve Records', desc: 'Managers review submitted records with full context — clock-in time, photo, and signature — and approve, reject, or modify as needed.' },
    { icon: <IcoLock />, name: 'Tamper-proof Record Keeping', desc: 'Every modification is tracked. The original record is always preserved alongside any adjusted version for full audit transparency.' },
    { icon: <IcoStar />, name: 'AI Auto-approve Timesheets', desc: 'Records that check out are approved automatically. Only flagged records land on your desk.' },
    { icon: <IcoShield />, name: 'AI Anomaly Detection', desc: 'The system monitors patterns across all attendance data and surfaces anything suspicious — before it becomes a problem.' },
  ];

  const steps = [
    { n: '01', title: 'Clock In', desc: 'Casual worker clocks in and submits a live photo. Time and photo are recorded instantly.' },
    { n: '02', title: 'Confirm', desc: 'The assigned employee confirms the casual worker was present and carried out their duties.' },
    { n: '03', title: 'Submit', desc: 'Employee signs and submits the attendance record to the manager for review.' },
    { n: '04', title: 'Review & Approve', desc: 'Manager reviews the record — or lets AI approve it automatically if everything checks out.' },
  ];

  return (
    <>
      {/* ========== HERO ========== */}
      <section className="sub-section" style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div className="sub-inner" style={{ ...inner, textAlign: 'center' }}>
          <span style={{ display: 'inline-block', background: 'rgba(249,115,22,0.18)', color: '#FB923C', padding: '5px 14px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: '24px' }}>Attendance</span>
          <h1 className="sub-hero-h1" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', maxWidth: '760px', margin: '0 auto 20px' }}>
            Every clock-in. Verified. Every record. Protected.
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, maxWidth: '540px', margin: '0 auto 36px' }}>
            Accurate attendance tracking with AI built in — so nothing slips through the cracks.
          </p>
          <Link href="/get-started" className="btn-press cta-shimmer" style={{ display: 'inline-block', background: '#F97316', color: '#FFFFFF', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9375rem' }}>
            Get Started Free
          </Link>
        </div>
      </section>

      {/* ========== FEATURES GRID ========== */}
      <section className="sub-section" style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div className="sub-inner" style={inner}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 className="sub-h2" style={h2style}>Everything you need to track attendance with confidence</h2>
            <p style={subtitleStyle}>From the moment they clock in to the moment the record is approved.</p>
          </div>
          {/* 6 cards in 3-col grid, last card centered */}
          <div className="grid-features-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {features.slice(0, 6).map(f => <FeatureCard key={f.name} {...f} />)}
          </div>
          <div className="grid-features-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '20px' }}>
            <div />
            <FeatureCard {...features[6]} />
            <div />
          </div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section className="sub-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div className="sub-inner" style={inner}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 className="sub-h2" style={h2style}>From clock-in to approved record — fully covered.</h2>
            <p style={subtitleStyle}>A complete attendance flow with verification and AI built into every step.</p>
          </div>
          <div className="grid-steps-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0', position: 'relative' }}>
            {steps.map(({ n, title, desc }, i) => (
              <div key={n} style={{ position: 'relative' }}>
                {i < steps.length - 1 && <div className="step-connector" style={{ position: 'absolute', top: '35px', right: '-1px', width: '50%', height: '2px', background: 'linear-gradient(90deg, transparent, #F0E8D8)', zIndex: 0 }} />}
                {i > 0 && <div className="step-connector" style={{ position: 'absolute', top: '35px', left: '-1px', width: '50%', height: '2px', background: 'linear-gradient(90deg, #F0E8D8, transparent)', zIndex: 0 }} />}
                <div style={{ padding: '0 24px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#FEF3C7', border: '3px solid #F97316', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.625rem', fontWeight: 700, color: '#F97316', letterSpacing: '0.08em' }}>STEP</span>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 700, color: '#F97316', lineHeight: 1 }}>{n}</span>
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.125rem', color: '#1C1917', marginBottom: '10px' }}>{title}</h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <CtaBanner headline="No more disputed timesheets." sub="Photo-verified, AI-assisted, and fully auditable — from the first clock-in." />
    </>
  );
}
