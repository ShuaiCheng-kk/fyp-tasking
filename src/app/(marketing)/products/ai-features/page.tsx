'use client';

import Link from 'next/link';
import { useMarketingCopy } from '../../useMarketingCopy';

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AiFeaturesPage() {
  const copy = useMarketingCopy('products-ai-features');

  const steps = [
    { step: '01', labelKey: 'workflow.step1.label', defaultLabel: 'Recruit', titleKey: 'workflow.step1.title', descKey: 'workflow.step1.desc', defaultTitle: 'Post a job', defaultDesc: 'AI generates the description and ranks applicants automatically — so you open the list already knowing who to pick.' },
    { step: '02', labelKey: 'workflow.step2.label', defaultLabel: 'Verify',  titleKey: 'workflow.step2.title', descKey: 'workflow.step2.desc', defaultTitle: 'Casual worker clocks in', defaultDesc: 'AI verifies the photo against the record and flags anything that looks off — before it becomes your problem.' },
    { step: '03', labelKey: 'workflow.step3.label', defaultLabel: 'Approve', titleKey: 'workflow.step3.title', descKey: 'workflow.step3.desc', defaultTitle: 'Shift ends', defaultDesc: 'AI reviews the timesheet and approves or escalates instantly — so clean records never sit waiting for manual review.' },
  ];

  const features: { icon: React.ReactNode; nameKey: string; descKey: string; defaultName: string; defaultDesc: string }[] = [
    { icon: <IcoStar />, nameKey: 'feature.1.name', descKey: 'feature.1.desc', defaultName: 'AI Candidate Recommendation', defaultDesc: "Stop guessing who's the right fit. Tasking ranks every applicant by skills, availability, and work history — so the best match is always at the top." },
    { icon: <IcoPen />,  nameKey: 'feature.2.name', descKey: 'feature.2.desc', defaultName: 'AI Job Description Generator', defaultDesc: 'Enter a role title and key requirements. Get a ready-to-publish job description in seconds. No more staring at a blank page.' },
    { icon: <IcoCheck />,nameKey: 'feature.3.name', descKey: 'feature.3.desc', defaultName: 'AI Auto-approve Timesheets',  defaultDesc: 'Clean records that meet all criteria get approved without you lifting a finger. Only the ones that need your attention ever reach your inbox.' },
    { icon: <IcoShield />,nameKey:'feature.4.name', descKey: 'feature.4.desc', defaultName: 'AI Anomaly Detection',         defaultDesc: 'Photo mismatches, unusual clock-in patterns, repeated late arrivals — Tasking catches them automatically before they turn into disputes.' },
  ];

  return (
    <>
      {/* ========== HERO ========== */}
      {copy.visible('hero') && (
      <section className="sub-section" style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div className="sub-inner" style={{ ...inner, textAlign: 'center' }}>
          <span style={{ display: 'inline-block', background: 'rgba(249,115,22,0.18)', color: '#FB923C', padding: '5px 14px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: '24px' }}>
            {copy('hero.badge', 'AI Features')}
          </span>
          <h1 className="sub-hero-h1" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', maxWidth: '700px', margin: '0 auto 20px' }}>
            {copy('hero.headline', 'Enterprise-grade AI. Free for everyone.')}
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, maxWidth: '560px', margin: '0 auto 36px' }}>
            {copy('hero.subheadline', 'Four intelligent tools built into your workflow from day one — no upgrades, no paywalls, no excuses.')}
          </p>
          <Link href={copy('hero.button.url', '/get-started')} className="btn-press cta-shimmer" style={{ display: 'inline-block', background: '#F97316', color: '#FFFFFF', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9375rem' }}>
            {copy('hero.button.label', 'Get Started Free')}
          </Link>
        </div>
      </section>
      )}

      {/* ========== FEATURES GRID ========== */}
      {copy.visible('intro') && (
      <section className="sub-section" style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div className="sub-inner" style={inner}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 className="sub-h2" style={h2style}>{copy('features.title', "What's inside")}</h2>
            <p style={subtitleStyle}>{copy('features.subtitle', 'Four AI tools. All free. All built in.')}</p>
          </div>
          <div className="grid-features-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            {features.map(f => (
              <FeatureCard key={f.nameKey} icon={f.icon} name={copy(f.nameKey, f.defaultName)} desc={copy(f.descKey, f.defaultDesc)} />
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ========== HOW IT FITS INTO YOUR WORKFLOW ========== */}
      {copy.visible('content') && (
      <section className="sub-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div className="sub-inner" style={inner}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 className="sub-h2" style={h2style}>{copy('workflow.title', 'AI that works with you, not around you.')}</h2>
            <p style={subtitleStyle}>{copy('workflow.subtitle', "These aren't standalone tools. They're built into the exact moments in your workflow where they matter most.")}</p>
          </div>

          <div className="grid-steps-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0', position: 'relative' }}>
            {steps.map(({ step, labelKey, defaultLabel, titleKey, descKey, defaultTitle, defaultDesc }, i) => (
              <div key={step} style={{ position: 'relative' }}>
                {i < 2 && <div className="step-connector" style={{ position: 'absolute', top: '36px', right: '0', width: '50%', height: '2px', background: 'linear-gradient(90deg, #F97316, #FED7AA)', zIndex: 0 }} />}
                {i > 0 && <div className="step-connector" style={{ position: 'absolute', top: '36px', left: '0', width: '50%', height: '2px', background: 'linear-gradient(90deg, #FED7AA, #F97316)', zIndex: 0 }} />}
                <div style={{ padding: '0 32px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#FEF3C7', border: '3px solid #F97316', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.6875rem', fontWeight: 700, color: '#F97316', letterSpacing: '0.08em' }}>STEP</span>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 700, color: '#F97316', lineHeight: 1 }}>{step}</span>
                  </div>
                  <span style={{ display: 'inline-block', background: '#FEF3C7', color: '#92400E', padding: '2px 10px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: '12px' }}>{copy(labelKey, defaultLabel)}</span>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.125rem', color: '#1C1917', marginBottom: '10px' }}>{copy(titleKey, defaultTitle)}</h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7 }}>{copy(descKey, defaultDesc)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ========== FINAL CTA ========== */}
      {copy.visible('cta') && (
      <section className="cta-banner" style={{ background: '#F97316', padding: '80px 24px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.5rem', color: '#FFFFFF', marginBottom: '16px', lineHeight: 1.2 }}>
            {copy('cta.headline', 'Ready to put AI to work?')}
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, marginBottom: '36px' }}>
            {copy('cta.subheadline', 'All four AI features are free. No upgrade required.')}
          </p>
          <Link href={copy('cta.button.url', '/get-started')} className="btn-press" style={{ display: 'inline-block', background: '#FFFFFF', color: '#F97316', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9375rem' }}>
            {copy('cta.button.label', 'Get Started Free')}
          </Link>
        </div>
      </section>
      )}
    </>
  );
}
