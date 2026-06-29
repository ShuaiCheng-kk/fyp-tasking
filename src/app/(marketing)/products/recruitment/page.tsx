'use client';

import Link from 'next/link';
import { useMarketingCopy } from '../../useMarketingCopy';

const inner: React.CSSProperties = { maxWidth: '1280px', margin: '0 auto', padding: '0 24px' };
const h2style: React.CSSProperties = { fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' };
const subtitleStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.75, maxWidth: '560px', margin: '0 auto' };

const IcoPost     = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 2v6h6M12 18v-6M9 15h6" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoUsers    = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="7" r="4" stroke="#F97316" strokeWidth="2" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#F97316" strokeWidth="2" strokeLinecap="round" /></svg>);
const IcoClock    = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#F97316" strokeWidth="2" /><path d="M12 6v6l4 2" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoList     = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoCalendar = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="#F97316" strokeWidth="2" /><path d="M16 2v4M8 2v4M3 10h18" stroke="#F97316" strokeWidth="2" strokeLinecap="round" /></svg>);
const IcoSearch   = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="#F97316" strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke="#F97316" strokeWidth="2" strokeLinecap="round" /></svg>);
const IcoUndo     = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 7v6h6" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoGlobe    = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#F97316" strokeWidth="2" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="#F97316" strokeWidth="2" /></svg>);

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

export default function RecruitmentPage() {
  const copy = useMarketingCopy('products-recruitment');

  const featureIcons = [<IcoPost key="1"/>, <IcoUsers key="2"/>, <IcoClock key="3"/>, <IcoList key="4"/>, <IcoCalendar key="5"/>, <IcoSearch key="6"/>, <IcoUndo key="7"/>, <IcoGlobe key="8"/>];
  const featureIdxs = copy.keys('feature.', '.name');

  const stepDefaults = [
    { n: '01', titleKey: 'workflow.step1.title', descKey: 'workflow.step1.desc', defaultTitle: 'Post',    defaultDesc: 'Publish your job opening to the public recruitment page. Casual workers and applicants can browse and apply instantly.' },
    { n: '02', titleKey: 'workflow.step2.title', descKey: 'workflow.step2.desc', defaultTitle: 'Review',  defaultDesc: 'See every applicant ranked by AI recommendation. Skills, availability, and work history — all surfaced automatically.' },
    { n: '03', titleKey: 'workflow.step3.title', descKey: 'workflow.step3.desc', defaultTitle: 'Invite',  defaultDesc: 'Select your candidate and send the invitation. The 12-hour acceptance window starts automatically.' },
    { n: '04', titleKey: 'workflow.step4.title', descKey: 'workflow.step4.desc', defaultTitle: 'Confirm', defaultDesc: 'Candidate accepts, job closes, worker is assigned to the shift. Done.' },
  ];

  return (
    <>
      {/* ========== HERO ========== */}
      {copy.visible('hero') && (
      <section className="sub-section" style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div className="sub-inner" style={{ ...inner, textAlign: 'center' }}>
          <span style={{ display: 'inline-block', background: 'rgba(249,115,22,0.18)', color: '#FB923C', padding: '5px 14px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: '24px' }}>
            {copy('hero.badge', 'Recruitment')}
          </span>
          <h1 className="sub-hero-h1" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', maxWidth: '680px', margin: '0 auto 20px' }}>
            {copy('hero.headline', 'Find the right people. Fast.')}
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, maxWidth: '520px', margin: '0 auto 36px' }}>
            {copy('hero.subheadline', 'From job posting to confirmed hire — without the back-and-forth.')}
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
            <h2 className="sub-h2" style={h2style}>{copy('features.title', 'Everything you need to hire casual workers')}</h2>
            <p style={subtitleStyle}>{copy('features.subtitle', 'Every feature in this module exists because SMEs asked for it.')}</p>
          </div>
          <div className="grid-features-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {featureIdxs.map((idx, i) => (
              <FeatureCard key={idx} icon={featureIcons[i % featureIcons.length]} name={copy(`feature.${idx}.name`, 'Feature')} desc={copy(`feature.${idx}.desc`, '')} />
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ========== HOW IT WORKS ========== */}
      {copy.visible('content') && (
      <section className="sub-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div className="sub-inner" style={inner}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 className="sub-h2" style={h2style}>{copy('workflow.title', 'From open role to confirmed hire in four steps.')}</h2>
            <p style={subtitleStyle}>{copy('workflow.subtitle', 'A complete hiring flow — built specifically for casual workforce management.')}</p>
          </div>
          <div className="grid-steps-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0', position: 'relative' }}>
            {stepDefaults.map(({ n, titleKey, descKey, defaultTitle, defaultDesc }, i) => (
              <div key={n} style={{ position: 'relative' }}>
                {i < stepDefaults.length - 1 && <div className="step-connector" style={{ position: 'absolute', top: '35px', right: '-1px', width: '50%', height: '2px', background: 'linear-gradient(90deg, transparent, #F0E8D8)', zIndex: 0 }} />}
                {i > 0 && <div className="step-connector" style={{ position: 'absolute', top: '35px', left: '-1px', width: '50%', height: '2px', background: 'linear-gradient(90deg, #F0E8D8, transparent)', zIndex: 0 }} />}
                <div style={{ padding: '0 24px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#FEF3C7', border: '3px solid #F97316', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.625rem', fontWeight: 700, color: '#F97316', letterSpacing: '0.08em' }}>STEP</span>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 700, color: '#F97316', lineHeight: 1 }}>{n}</span>
                  </div>
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
            {copy('cta.headline', 'Your next hire is one post away.')}
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, marginBottom: '36px' }}>
            {copy('cta.subheadline', 'Join SMEs already using Tasking to fill shifts faster and smarter.')}
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
