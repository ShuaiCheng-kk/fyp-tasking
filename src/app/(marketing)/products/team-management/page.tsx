'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMarketingCopy } from '../../useMarketingCopy';
import { MarketingIcon } from '../../marketingIcons';

const inner: React.CSSProperties = { maxWidth: '1280px', margin: '0 auto', padding: '0 24px' };
const h2style: React.CSSProperties = { fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' };
const subtitleStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.75, maxWidth: '560px', margin: '0 auto' };

const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M20 6L9 17l-5-5" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function FeatureCard({ name, desc, image, icon, points }: { name: string; desc: string; image: string; icon: string; points: string[] }) {
  return (
    <div className="card-lift" style={{ height: '100%', background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {image ? (
        <img src={image} alt={name} style={{ display: 'block', width: '100%', height: '190px', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: '190px', background: '#F0E8D8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(28,25,23,0.08)' }}>
            <MarketingIcon name={icon} size={30} color="#F97316" />
          </div>
        </div>
      )}
      <div style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1875rem', color: '#1C1917', marginBottom: '8px' }}>{name}</h3>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.6, marginBottom: '18px' }}>{desc}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {points.filter(Boolean).map((point) => (
            <div key={point} style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <CheckIcon />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#44403C' }}>{point}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CARD_WIDTH = 280;
const CARD_GAP = 24;
const CARDS_VISIBLE = 5;
const CAROUSEL_MAX_WIDTH = 1560;

function CarouselArrow({ direction, onClick, disabled }: { direction: 'left' | 'right'; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'left' ? 'Previous features' : 'Next features'}
      style={{
        position: 'absolute', top: '50%', [direction]: '-22px', transform: 'translateY(-50%)',
        width: '44px', height: '44px', borderRadius: '50%', background: '#FFFFFF', border: '1px solid #F0E8D8',
        boxShadow: '0 8px 20px rgba(28,25,23,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#1C1917', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1, zIndex: 5,
      } as React.CSSProperties}
    >
      {direction === 'left' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
    </button>
  );
}

function FeatureCarousel({ featureIdxs, copy, pointDefaults, iconDefaults }: { featureIdxs: string[]; copy: (key: string, fallback: string) => string; pointDefaults: Record<string, string[]>; iconDefaults: Record<string, string> }) {
  const [index, setIndex] = useState(0);
  const maxIndex = Math.max(0, featureIdxs.length - CARDS_VISIBLE);

  return (
    <div style={{ maxWidth: `${CAROUSEL_MAX_WIDTH}px`, margin: '0 auto', padding: '0 24px', position: 'relative' }}>
      <div style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: maxIndex === 0 ? 'center' : 'flex-start', gap: `${CARD_GAP}px`, transform: `translateX(-${index * (CARD_WIDTH + CARD_GAP)}px)`, transition: 'transform 0.45s cubic-bezier(0.16,1,0.3,1)' }}>
          {featureIdxs.map((idx) => (
            <div key={idx} style={{ width: `${CARD_WIDTH}px`, flexShrink: 0 }}>
              <FeatureCard
                name={copy(`feature.${idx}.name`, 'Feature')}
                desc={copy(`feature.${idx}.desc`, '')}
                image={copy(`feature.${idx}.image`, '')}
                icon={copy(`feature.${idx}.icon`, iconDefaults[idx] ?? 'calendar')}
                points={[
                  copy(`feature.${idx}.point1`, pointDefaults[idx]?.[0] ?? ''),
                  copy(`feature.${idx}.point2`, pointDefaults[idx]?.[1] ?? ''),
                  copy(`feature.${idx}.point3`, pointDefaults[idx]?.[2] ?? ''),
                ]}
              />
            </div>
          ))}
        </div>
      </div>
      {maxIndex > 0 && (
        <>
          <CarouselArrow direction="left" onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0} />
          <CarouselArrow direction="right" onClick={() => setIndex(i => Math.min(maxIndex, i + 1))} disabled={index === maxIndex} />
        </>
      )}
    </div>
  );
}

const pointDefaults: Record<string, string[]> = {
  '1': ['Create or edit a department', 'Matches your company structure', 'Owner-only to keep it consistent'],
  '3': ['Every role sees only their scope', 'Owner down to Casual Worker', 'No extra menus to hide manually'],
  '4': ['Toggle active or inactive', 'Stops future scheduling', 'Full history stays on record'],
  '5': ['Name, address, and details', 'Kept accurate for every member', 'Owner-only to edit'],
  '7': ['One CSV, whole team invited', 'Or set up every department', 'No manual one-by-one entry'],
};

const iconDefaults: Record<string, string> = {
  '1': 'org',
  '3': 'lock',
  '4': 'ban',
  '5': 'store',
  '7': 'list',
};

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

  const featureIdxs = copy.keys('feature.', '.name');
  const roleIdxs = copy.keys('role.', '.name');

  return (
    <>
      {/* ========== HERO ========== */}
      {copy.visible('hero') && (
      <section className="sub-section" style={{ background: '#1C1C1E', padding: '96px 0 80px', overflow: 'visible', position: 'relative', zIndex: 2 }}>
        <svg
          viewBox="0 0 1440 180"
          preserveAspectRatio="none"
          style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '180px', pointerEvents: 'none' }}
        >
          <defs>
            <filter id="teamHeroCurveBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
          </defs>
          <path
            d="M-300,118 L0,118 C 260,90 480,42 720,42 C 960,42 1180,90 1440,118 L1740,118 L1740,236 L-300,236 Z"
            fill="#FFFBF5"
            filter="url(#teamHeroCurveBlur)"
          />
        </svg>
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '30px', background: '#FFFBF5', pointerEvents: 'none' }} />

        <div className="sub-inner" style={{ ...inner, textAlign: 'center', position: 'relative' }}>
          <span style={{ display: 'inline-block', background: 'rgba(249,115,22,0.18)', color: '#FB923C', padding: '5px 14px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: '24px' }}>
            {copy('hero.badge', 'Company Management')}
          </span>
          <h1 className="sub-hero-h1" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', maxWidth: '720px', margin: '0 auto 36px' }}>
            {copy('hero.headline', 'Your company structure, exactly how you need it.')}
          </h1>
          <Link href={copy('hero.button.url', '/get-started')} className="btn-press cta-shimmer" style={{ display: 'inline-block', background: '#F97316', color: '#FFFFFF', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9375rem' }}>
            {copy('hero.button.label', 'Get Started Free')}
          </Link>
          <div style={{ maxWidth: '1100px', margin: '56px auto -160px' }}>
            <video
              width="100%"
              autoPlay
              muted
              loop
              playsInline
              style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 30px 80px rgba(0,0,0,0.35)' }}
            >
              <source src={copy('hero.video', '/Company.mkv')} type="video/x-matroska" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </section>
      )}

      {/* ========== FEATURES GRID ========== */}
      {copy.visible('intro') && (
      <section className="sub-section" style={{ background: '#FFFBF5', padding: '220px 0 80px' }}>
        <div className="sub-inner" style={{ ...inner, marginBottom: '52px' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 className="sub-h2" style={h2style}>{copy('features.title', 'Everything you need to run your organisation')}</h2>
            <p style={subtitleStyle}>{copy('features.subtitle', 'Structure, permissions, and access, all in one place.')}</p>
          </div>
        </div>
        <FeatureCarousel featureIdxs={featureIdxs} copy={copy} pointDefaults={pointDefaults} iconDefaults={iconDefaults} />
      </section>
      )}

      {/* ========== ROLE BREAKDOWN ========== */}
      {copy.visible('content') && (
      <section className="sub-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div className="sub-inner" style={inner}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 className="sub-h2" style={h2style}>{copy('roles.title', 'The right access for every role.')}</h2>
            <p style={subtitleStyle}>{copy('roles.subtitle', 'Tasking is built around five roles, each with exactly the visibility and control they need, nothing more.')}</p>
          </div>
          <div className="grid-roles" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(roleIdxs.length || 5, 5)}, 1fr)`, gap: '16px' }}>
            {roleIdxs.map(idx => (
              <RoleCard key={idx} name={copy(`role.${idx}.name`, 'Role')} desc={copy(`role.${idx}.desc`, '')} />
            ))}
          </div>
        </div>
      </section>
      )}

    </>
  );
}
