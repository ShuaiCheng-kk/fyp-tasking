'use client';

import Link from 'next/link';
import { AlertTriangle, Rocket, Heart } from 'lucide-react';
import { useMarketingCopy } from '../../useMarketingCopy';

const inner     = { maxWidth: '800px',  margin: '0 auto', padding: '0 24px' } as const;
const wideInner = { maxWidth: '1280px', margin: '0 auto', padding: '0 24px' } as const;

export default function MissionPage() {
  const copy = useMarketingCopy('about-mission');

  const painNums  = copy.keys('why.pain.', '');
  const goalNums  = copy.keys('goals.',    '.title');
  const valueNums = copy.keys('values.',   '.badge');

  return (
    <>
      {/* ========== HERO ========== */}
      {copy.visible('section.hero') && (
        <section style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
          <div style={{ ...inner, textAlign: 'center' }}>
            <Link href="/about" style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: '16px', textDecoration: 'none' }}>
              ← Back
            </Link>
            <span style={{ display: 'inline-block', background: 'rgba(249,115,22,0.18)', color: '#FB923C', padding: '5px 14px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: '24px' }}>
              {copy('hero.badge', 'Mission')}
            </span>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', marginBottom: '20px' }}>
              {copy('hero.headline', 'We built Tasking because SMEs deserve better.')}
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75 }}>
              {copy('hero.subheadline', 'Not a watered-down version of enterprise software. Not another spreadsheet wrapper. A platform built from scratch for the way SMEs actually operate.')}
            </p>
          </div>
        </section>
      )}

      {/* ========== WHY WE BUILT IT ========== */}
      {copy.visible('section.why') && (
        <section style={{ background: '#FFFFFF', padding: '80px 0' }}>
          <div style={wideInner}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ width: '44px', height: '44px', background: '#FEF3C7', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={22} color="#F97316" strokeWidth={1.75} />
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.75rem', color: '#1C1917' }}>
                    {copy('why.headline', 'Why we built it')}
                  </h2>
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: '#78716C', lineHeight: 1.8, marginBottom: '16px' }}>
                  {copy('why.para1', '')}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: '#78716C', lineHeight: 1.8 }}>
                  {copy('why.para2', '')}
                </p>
              </div>
              <div style={{ background: '#FFFBF5', border: '1px solid #F0E8D8', borderRadius: '20px', padding: '36px' }}>
                {painNums.map((n, i) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: i < painNums.length - 1 ? '16px' : '0' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#FEF3C7', border: '2px solid #F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.6875rem', fontWeight: 700, color: '#F97316' }}>{i + 1}</span>
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#1C1917', lineHeight: 1.65 }}>
                      {copy(`why.pain.${n}`, '')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========== WHAT WE SET OUT TO DO ========== */}
      {copy.visible('section.goals') && (
        <section style={{ background: '#FFFBF5', padding: '80px 0' }}>
          <div style={wideInner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
              <div style={{ width: '44px', height: '44px', background: '#FEF3C7', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Rocket size={22} color="#F97316" strokeWidth={1.75} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.75rem', color: '#1C1917' }}>
                {copy('goals.headline', 'What we set out to do')}
              </h2>
            </div>
            <div className="grid-features-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
              {goalNums.map(n => (
                <div key={n} className="card-lift" style={{ background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '16px', padding: '32px' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.125rem', color: '#1C1917', marginBottom: '10px' }}>
                    {copy(`goals.${n}.title`, '')}
                  </h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7 }}>
                    {copy(`goals.${n}.body`, '')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========== WHAT WE STAND FOR ========== */}
      {copy.visible('section.values') && (
        <section style={{ background: '#FFFFFF', padding: '80px 0' }}>
          <div style={wideInner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
              <div style={{ width: '44px', height: '44px', background: '#FEF3C7', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Heart size={22} color="#F97316" strokeWidth={1.75} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.75rem', color: '#1C1917' }}>
                {copy('values.headline', 'What we stand for')}
              </h2>
            </div>
            <div className="grid-features-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              {valueNums.map(n => (
                <div key={n} style={{ background: '#FFFBF5', border: '1px solid #F0E8D8', borderRadius: '16px', padding: '32px' }}>
                  <span style={{ display: 'inline-block', background: '#FEF3C7', color: '#92400E', padding: '4px 12px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'var(--font-body)', marginBottom: '16px' }}>
                    {copy(`values.${n}.badge`, '')}
                  </span>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.125rem', color: '#1C1917', marginBottom: '10px' }}>
                    {copy(`values.${n}.title`, '')}
                  </h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7 }}>
                    {copy(`values.${n}.body`, '')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========== CTA ========== */}
      {copy.visible('section.cta') && (
        <section style={{ background: '#F97316', padding: '72px 24px' }}>
          <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.25rem', color: '#FFFFFF', marginBottom: '16px', lineHeight: 1.2 }}>
              {copy('cta.headline', 'Ready to see it for yourself?')}
            </h2>
            <Link href={copy('cta.button.url', '/get-started')} className="btn-press" style={{ display: 'inline-block', background: '#FFFFFF', color: '#F97316', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9375rem' }}>
              {copy('cta.button.label', 'Get Started Free')}
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
