'use client';

import Link from 'next/link';
import { useMarketingCopy } from '../useMarketingCopy';
import { MarketingIcon } from '../marketingIcons';
import type { MarketingPage } from '@/types/MarketingPage';

const maxW: React.CSSProperties = { maxWidth: '1280px', margin: '0 auto', padding: '0 48px' };
const maxWNarrow: React.CSSProperties = { maxWidth: '800px', margin: '0 auto', padding: '0 48px' };

const RetailIcon = () => (
  <svg width="120" height="120" viewBox="0 0 24 24" fill="none" strokeWidth="1.25">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="#F97316" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="3" y1="6" x2="21" y2="6" stroke="#F97316" strokeLinecap="round" />
    <path d="M16 10a4 4 0 0 1-8 0" stroke="#F97316" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FnbIcon = () => (
  <svg width="120" height="120" viewBox="0 0 24 24" fill="none" strokeWidth="1.25">
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" stroke="#F97316" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 2v20" stroke="#F97316" strokeLinecap="round" />
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" stroke="#F97316" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LogisticsIcon = () => (
  <svg width="120" height="120" viewBox="0 0 24 24" fill="none" strokeWidth="1.25">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="#F97316" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="10" r="3" stroke="#F97316" />
  </svg>
);

const EventIcon = () => (
  <svg width="120" height="120" viewBox="0 0 24 24" fill="none" strokeWidth="1.25">
    <rect x="3" y="4" width="18" height="18" rx="2" stroke="#F97316" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="16" y1="2" x2="16" y2="6" stroke="#F97316" strokeLinecap="round" />
    <line x1="8" y1="2" x2="8" y2="6" stroke="#F97316" strokeLinecap="round" />
    <line x1="3" y1="10" x2="21" y2="10" stroke="#F97316" strokeLinecap="round" />
    <path d="m9 16 2 2 4-4" stroke="#F97316" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HospitalityIcon = () => (
  <svg width="120" height="120" viewBox="0 0 24 24" fill="none" strokeWidth="1.25">
    <path d="M2 18v-7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7" stroke="#F97316" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 18v3M22 18v3" stroke="#F97316" strokeLinecap="round" />
    <path d="M4 11V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3" stroke="#F97316" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="7" cy="8" r="1.3" stroke="#F97316" />
  </svg>
);

const CleaningIcon = () => (
  <svg width="120" height="120" viewBox="0 0 24 24" fill="none" strokeWidth="1.25">
    <path d="M9 22V10a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v12" stroke="#F97316" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 8V4h2v4" stroke="#F97316" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 4h4" stroke="#F97316" strokeLinecap="round" />
    <path d="M6 22h12" stroke="#F97316" strokeLinecap="round" />
    <path d="M15 3l3-1M16 5h3M15 7l3 1" stroke="#F97316" strokeLinecap="round" />
  </svg>
);

const iconMap: Record<string, React.FC> = {
  retail: RetailIcon,
  fnb: FnbIcon,
  logistics: LogisticsIcon,
  'event-management': EventIcon,
  hospitality: HospitalityIcon,
  cleaning: CleaningIcon,
};

export default function IndustriesPageClient({ initialPage }: { initialPage: MarketingPage | null }) {
  const copy = useMarketingCopy('industries', initialPage);
  const industryIdxs = copy.keys('industry.', '.badge');

  return (
    <>
      {/* ============================= HERO SECTION ============================= */}
      {copy.visible('hero') && (
      <section className="sub-section" style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div className="sub-inner" style={{ ...maxWNarrow, textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', marginBottom: '20px' }}>
            {copy('hero.headline', 'One platform. Every industry.')}
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, maxWidth: '620px', margin: '0 auto 36px' }}>
            {copy('hero.subheadline', 'Whether you run a café, a retail chain, or a construction firm, Tasking gives you the tools to manage your team and casual workforce with confidence.')}
          </p>
          <Link href={copy('hero.button.url', '/get-started')} className="btn-press cta-shimmer" style={{ display: 'inline-block', background: '#F97316', color: '#FFFFFF', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9375rem' }}>
            {copy('hero.button.label', 'Get Started Free')}
          </Link>
        </div>
      </section>
      )}

      {/* ============================= INDUSTRIES SECTION ============================= */}
      {copy.visible('content') && (
      <>
          {industryIdxs.map((idx, i) => {
            const id = copy(`industry.${idx}.id`, idx)
            const customIcon = copy(`industry.${idx}.icon`, '')
            const image = copy(`industry.${idx}.image`, '')
            const Icon = iconMap[id] ?? RetailIcon
            const isEven = i % 2 === 0
            const statement = copy(`industry.${idx}.statement`, '')
            const stepIdxs = copy.keys(`industry.${idx}.step`, '.title')
            const isNewFormat = !!statement
            return (
              <section key={idx} id={id} className="page-section" style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FFFBF5', padding: '56px 0' }}>
                <div className="section-inner" style={maxW}>
                <div className="industry-row" style={{ flexDirection: isEven ? 'row' : 'row-reverse' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'inline-block', background: '#FEF3C7', color: '#92400E', padding: '6px 18px', borderRadius: '100px', fontSize: '0.9375rem', fontWeight: 700, fontFamily: 'var(--font-body)', marginBottom: '20px' }}>
                      {copy(`industry.${idx}.badge`, 'Industry')}
                    </span>
                    {isNewFormat ? (
                      <>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2rem', color: '#1C1917', lineHeight: 1.25, marginBottom: '28px' }}>
                          {statement}
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          {stepIdxs.map((stepIdx, si) => (
                            <div key={stepIdx} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#FEF3C7', border: '1.5px solid #F97316', color: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.9375rem' }}>
                                {si + 1}
                              </div>
                              <div>
                                <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.1875rem', color: '#1C1917', marginBottom: '5px' }}>
                                  {copy(`industry.${idx}.step${stepIdx}.title`, '')}
                                </p>
                                <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.65 }}>
                                  {copy(`industry.${idx}.step${stepIdx}.desc`, '')}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2rem', color: '#1C1917', lineHeight: 1.25, marginBottom: '16px' }}>
                          {copy(`industry.${idx}.question`, '')}
                        </h2>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: '#78716C', lineHeight: 1.75, marginBottom: '28px' }}>
                          {copy(`industry.${idx}.painpoint`, '')}
                        </p>
                        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.9375rem', color: '#F97316', marginBottom: '10px', letterSpacing: '0.01em' }}>
                          How Tasking helps
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: '#1C1917', lineHeight: 1.75 }}>
                          {copy(`industry.${idx}.solution`, '')}
                        </p>
                      </>
                    )}
                  </div>
                  {image ? (
                    <div style={{ width: '280px', height: '280px', flexShrink: 0, borderRadius: '24px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                      <img src={image} alt={copy(`industry.${idx}.badge`, '')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : isNewFormat ? (
                    <div style={{ width: '280px', height: '280px', flexShrink: 0, borderRadius: '24px', border: '1px dashed #D6D3D1', background: '#FBF9F4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 600, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', padding: '0 20px' }}>
                        Image placeholder — {copy(`industry.${idx}.badge`, '')}
                      </span>
                    </div>
                  ) : (
                    <div style={{ width: '280px', height: '280px', flexShrink: 0, background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                      {customIcon ? <MarketingIcon name={customIcon} size={120} /> : <Icon />}
                    </div>
                  )}
                </div>
                </div>
              </section>
            )
          })}
      </>
      )}

      {/* ============================= FINAL CTA SECTION ============================= */}
      {copy.visible('cta') && (
      <section style={{ background: '#F97316', padding: '80px 24px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.5rem', color: '#FFFFFF', marginBottom: '16px', lineHeight: 1.2 }}>
            {copy('cta.headline', 'Start managing your workforce')}
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, marginBottom: '36px' }}>
            {copy('cta.subheadline', 'No credit card. No setup fees. Just a smarter way to run your team.')}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href={copy('cta.button.url', '/get-started')} className="btn-press" style={{ display: 'inline-block', background: '#FFFFFF', color: '#F97316', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9375rem' }}>
              {copy('cta.button.label', 'Get Started Free')}
            </Link>
            <Link href={copy('cta.button2.url', '/pricing')} className="btn-press" style={{ display: 'inline-block', background: 'transparent', color: '#FFFFFF', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9375rem', border: '2px solid rgba(255,255,255,0.6)' }}>
              {copy('cta.button2.label', 'View Pricing')}
            </Link>
          </div>
        </div>
      </section>
      )}
    </>
  );
}
