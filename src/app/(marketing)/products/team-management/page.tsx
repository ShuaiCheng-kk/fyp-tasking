'use client';

import Link from 'next/link';
import { useMarketingCopy } from '../../useMarketingCopy';
import { MarketingIcon } from '../../marketingIcons';

const inner: React.CSSProperties = { maxWidth: '1280px', margin: '0 auto', padding: '0 24px' };
const h2style: React.CSSProperties = { fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' };
const subtitleStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.75, maxWidth: '560px', margin: '0 auto' };

const IcoDept    = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="8" height="5" rx="1" stroke="#F97316" strokeWidth="2" /><rect x="14" y="3" width="8" height="5" rx="1" stroke="#F97316" strokeWidth="2" /><rect x="8" y="16" width="8" height="5" rx="1" stroke="#F97316" strokeWidth="2" /><path d="M6 8v4h12V8M12 12v4" stroke="#F97316" strokeWidth="2" strokeLinecap="round" /></svg>);
const IcoLink    = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoPerm    = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoBlock   = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#F97316" strokeWidth="2" /><path d="M4.93 4.93l14.14 14.14" stroke="#F97316" strokeWidth="2" strokeLinecap="round" /></svg>);
const IcoDash    = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="#F97316" strokeWidth="2" /><rect x="14" y="3" width="7" height="7" rx="1" stroke="#F97316" strokeWidth="2" /><rect x="3" y="14" width="7" height="7" rx="1" stroke="#F97316" strokeWidth="2" /><rect x="14" y="14" width="7" height="7" rx="1" stroke="#F97316" strokeWidth="2" /></svg>);
const IcoEye     = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke="#F97316" strokeWidth="2" /></svg>);
const IcoHistory = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 3v5h5" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 7v5l3 3" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);

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

const roleBadgeColors: Record<string, { badge: string; badgeBg: string }> = {
  Owner:           { badge: '#92400E', badgeBg: '#FEF3C7' },
  Partner:         { badge: '#7C3AED', badgeBg: '#EDE9FE' },
  Manager:         { badge: '#1E3A5F', badgeBg: '#DBEAFE' },
  Employee:        { badge: '#065F46', badgeBg: '#D1FAE5' },
  'Casual Worker': { badge: '#374151', badgeBg: '#F3F4F6' },
  'Guest User':    { badge: '#4B3A2A', badgeBg: '#F0E8D8' },
};

function RoleCard({ name, desc }: { name: string; desc: string }) {
  const colors = roleBadgeColors[name] ?? { badge: '#374151', badgeBg: '#F3F4F6' };
  return (
    <div className="card-lift" style={{ background: '#FFFBF5', border: '1px solid #F0E8D8', borderRadius: '16px', padding: '24px' }}>
      <span style={{ display: 'inline-block', background: colors.badgeBg, color: colors.badge, padding: '4px 12px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'var(--font-body)', marginBottom: '14px' }}>
        {name}
      </span>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7 }}>{desc}</p>
    </div>
  );
}

export default function TeamManagementPage() {
  const copy = useMarketingCopy('products-team-management');

  const featureIcons = [<IcoDept key="1"/>, <IcoLink key="2"/>, <IcoPerm key="3"/>, <IcoBlock key="4"/>, <IcoDash key="5"/>, <IcoEye key="6"/>, <IcoHistory key="7"/>];
  const featureIdxs = copy.keys('feature.', '.name');
  const roleIdxs = copy.keys('role.', '.name');

  return (
    <>
      {/* ========== HERO ========== */}
      {copy.visible('hero') && (
      <section className="sub-section" style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div className="sub-inner" style={{ ...inner, textAlign: 'center' }}>
          <span style={{ display: 'inline-block', background: 'rgba(249,115,22,0.18)', color: '#FB923C', padding: '5px 14px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: '24px' }}>
            {copy('hero.badge', 'Team Management')}
          </span>
          <h1 className="sub-hero-h1" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', maxWidth: '720px', margin: '0 auto 20px' }}>
            {copy('hero.headline', 'Your company structure, exactly how you need it.')}
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, maxWidth: '500px', margin: '0 auto 36px' }}>
            {copy('hero.subheadline', 'Full control from the top. Focused access for everyone else.')}
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
            <h2 className="sub-h2" style={h2style}>{copy('features.title', 'Everything you need to run your organisation')}</h2>
            <p style={subtitleStyle}>{copy('features.subtitle', 'Structure, permissions, and access — all in one place.')}</p>
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

      {/* ========== ROLE BREAKDOWN ========== */}
      {copy.visible('content') && (
      <section className="sub-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div className="sub-inner" style={inner}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 className="sub-h2" style={h2style}>{copy('roles.title', 'The right access for every role.')}</h2>
            <p style={subtitleStyle}>{copy('roles.subtitle', 'Tasking is built around five roles, each with exactly the visibility and control they need — nothing more.')}</p>
          </div>
          <div className="grid-roles" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(roleIdxs.length || 5, 5)}, 1fr)`, gap: '16px' }}>
            {roleIdxs.map(idx => (
              <RoleCard key={idx} name={copy(`role.${idx}.name`, 'Role')} desc={copy(`role.${idx}.desc`, '')} />
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
            {copy('cta.headline', 'Get your team set up in minutes.')}
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, marginBottom: '36px' }}>
            {copy('cta.subheadline', 'No IT team. No training programme. Just a clean system your whole organisation can use from day one.')}
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
