'use client';

import Link from 'next/link';
import { useMarketingCopy } from '../../useMarketingCopy';

// Colours are identity-linked — kept hardcoded, not CMS-editable
const MEMBER_COLORS: Record<string, { color: string; bg: string }> = {
  '1': { color: '#F97316', bg: '#FEF3C7' },
  '2': { color: '#8B5CF6', bg: '#EDE9FE' },
  '3': { color: '#0EA5E9', bg: '#E0F2FE' },
  '4': { color: '#10B981', bg: '#D1FAE5' },
  '5': { color: '#EF4444', bg: '#FEE2E2' },
  '6': { color: '#F59E0B', bg: '#FEF3C7' },
};

export default function TeamPage() {
  const copy = useMarketingCopy('about-team');

  const memberNums = copy.keys('member.', '.name');

  return (
    <>
      {/* ========== HERO ========== */}
      {copy.visible('section.hero') && (
        <section style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
            <Link href="/about" style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: '16px', textDecoration: 'none' }}>
              ← Back
            </Link>
            <span style={{ display: 'inline-block', background: 'rgba(249,115,22,0.18)', color: '#FB923C', padding: '5px 14px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: '24px' }}>
              {copy('hero.badge', 'The Team')}
            </span>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', marginBottom: '20px' }}>
              {copy('hero.headline', 'The people behind Tasking.')}
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75 }}>
              {copy('hero.subheadline', 'A multidisciplinary team of six — covering design, frontend, backend, full-stack, and project management — working together to make casual workforce management genuinely simple.')}
            </p>
          </div>
        </section>
      )}

      {/* ========== TEAM GRID ========== */}
      {copy.visible('section.team') && (
        <section style={{ background: '#FFFBF5', padding: '80px 0' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
            <div className="grid-features-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
              {memberNums.map(n => {
                const { color, bg } = MEMBER_COLORS[n] ?? { color: '#F97316', bg: '#FEF3C7' };
                const name     = copy(`member.${n}.name`,     '');
                const role     = copy(`member.${n}.role`,     '');
                const initials = copy(`member.${n}.initials`, '');
                const desc     = copy(`member.${n}.desc`,     '');
                const focusStr = copy(`member.${n}.focus`,    '');
                const focus    = focusStr.split(',').map(f => f.trim()).filter(Boolean);

                return (
                  <div key={n} className="card-lift" style={{ background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '20px', padding: '32px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: bg, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color }}>{initials}</span>
                      </div>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1rem', color: '#1C1917', marginBottom: '2px', lineHeight: 1.3 }}>{name}</h3>
                        <span style={{ display: 'inline-block', background: bg, color, padding: '2px 10px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
                          {role}
                        </span>
                      </div>
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7, marginBottom: '20px', flex: 1 }}>{desc}</p>
                    <div>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Focus areas</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {focus.map(f => (
                          <span key={f} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '4px 10px', fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: '#374151' }}>{f}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ========== CLOSING CTA ========== */}
      {copy.visible('section.cta') && (
        <section style={{ background: '#F97316', padding: '72px 24px' }}>
          <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2rem', color: '#FFFFFF', lineHeight: 1.25 }}>
              {copy('cta.headline', 'Six people. One platform. Built for the businesses that need it most.')}
            </h2>
          </div>
        </section>
      )}
    </>
  );
}
