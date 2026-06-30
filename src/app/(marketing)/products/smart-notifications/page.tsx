'use client';

import Link from 'next/link';
import { useMarketingCopy } from '../../useMarketingCopy';
import { MarketingIcon } from '../../marketingIcons';

const inner: React.CSSProperties = { maxWidth: '1280px', margin: '0 auto', padding: '0 24px' };
const h2style: React.CSSProperties = { fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' };
const subtitleStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.75, maxWidth: '560px', margin: '0 auto' };

const IcoTimer = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" stroke="#F97316" strokeWidth="2" /><path d="M12 9v4l2.5 2.5" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 2h6M12 2v3" stroke="#F97316" strokeWidth="2" strokeLinecap="round" /></svg>);
const IcoBell  = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#F97316" strokeWidth="2" strokeLinecap="round" /></svg>);
const IcoAlert = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 9v4M12 17h.01" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoCheck = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#F97316" strokeWidth="2" /><path d="M8 12l3 3 5-5" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoMega  = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 11l19-9-9 19-2-8-8-2z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoZap   = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);

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

export default function SmartNotificationsPage() {
  const copy = useMarketingCopy('products-smart-notifications');

  const featureIcons = [<IcoTimer key="1"/>, <IcoBell key="2"/>, <IcoAlert key="3"/>, <IcoCheck key="4"/>, <IcoMega key="5"/>, <IcoZap key="6"/>];
  const featureIdxs = copy.keys('feature.', '.name');
  const timelineIdxs = copy.keys('timeline.', '.trigger');

  const timelineDefaults: Record<string, { trigger: string; event: string }> = {
    '1': { trigger: 'Invitation sent',           event: '12-hour reminder fires automatically if no response received' },
    '2': { trigger: 'Job filled',                event: 'All other applicants notified instantly' },
    '3': { trigger: 'CW already allocated',      event: 'Manager alerted before a conflict happens' },
    '4': { trigger: 'Attendance record submitted',event: 'Manager notified immediately for review' },
    '5': { trigger: 'Manager posts announcement', event: 'All relevant staff see it in their dashboard instantly' },
  };

  return (
    <>
      {/* ========== HERO ========== */}
      {copy.visible('hero') && (
      <section className="sub-section" style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div className="sub-inner" style={{ ...inner, textAlign: 'center' }}>
          <span style={{ display: 'inline-block', background: 'rgba(249,115,22,0.18)', color: '#FB923C', padding: '5px 14px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: '24px' }}>
            {copy('hero.badge', 'Smart Notifications')}
          </span>
          <h1 className="sub-hero-h1" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', maxWidth: '680px', margin: '0 auto 20px' }}>
            {copy('hero.headline', 'No more chasing people for updates.')}
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, maxWidth: '500px', margin: '0 auto 36px' }}>
            {copy('hero.subheadline', 'Tasking handles the follow-ups. You handle the business.')}
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
            <h2 className="sub-h2" style={h2style}>{copy('features.title', 'Every notification your workflow needs')}</h2>
            <p style={subtitleStyle}>{copy('features.subtitle', 'Automatic, targeted, and triggered at exactly the right moment.')}</p>
          </div>
          <div className="grid-features-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {featureIdxs.map((idx, i) => {
              const iconName = copy(`feature.${idx}.icon`, '')
              const icon = iconName ? <MarketingIcon name={iconName} size={24} /> : featureIcons[i % featureIcons.length]
              return <FeatureCard key={idx} icon={icon} name={copy(`feature.${idx}.name`, 'Feature')} desc={copy(`feature.${idx}.desc`, '')} />
            })}
          </div>
        </div>
      </section>
      )}

      {/* ========== TIMELINE ========== */}
      {copy.visible('content') && (
      <section className="sub-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div className="sub-inner" style={inner}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 className="sub-h2" style={h2style}>{copy('timeline.title', 'The right message. At the right moment. Every time.')}</h2>
            <p style={subtitleStyle}>{copy('timeline.subtitle', 'Every notification in Tasking is triggered automatically — no manual sending, no missed updates.')}</p>
          </div>
          <div style={{ maxWidth: '720px', margin: '0 auto', position: 'relative' }}>
            <div style={{ position: 'absolute', left: '23px', top: '24px', bottom: '24px', width: '2px', background: '#F0E8D8' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {timelineIdxs.map((idx, i) => (
                <div key={idx} style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', paddingBottom: i < timelineIdxs.length - 1 ? '32px' : '0' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#FEF3C7', border: '3px solid #F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', zIndex: 1 }}>
                    <IcoBell />
                  </div>
                  <div style={{ paddingTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1rem', color: '#1C1917' }}>{copy(`timeline.${idx}.trigger`, timelineDefaults[idx]?.trigger ?? 'Trigger')}</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.65 }}>{copy(`timeline.${idx}.event`, timelineDefaults[idx]?.event ?? '')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ========== FINAL CTA ========== */}
      {copy.visible('cta') && (
      <section className="cta-banner" style={{ background: '#F97316', padding: '80px 24px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.5rem', color: '#FFFFFF', marginBottom: '16px', lineHeight: 1.2 }}>
            {copy('cta.headline', 'Stay in the loop. Automatically.')}
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, marginBottom: '36px' }}>
            {copy('cta.subheadline', 'Every key moment in your workflow, covered — without you lifting a finger.')}
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
