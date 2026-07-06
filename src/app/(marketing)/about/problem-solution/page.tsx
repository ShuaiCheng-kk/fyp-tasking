'use client';

import Link from 'next/link';
import { X, CheckCircle2 } from 'lucide-react';
import { useMarketingCopy } from '../../useMarketingCopy';

export default function ProblemSolutionPage() {
  const copy = useMarketingCopy('about-problem-solution');

  const problemNums = copy.keys('problems.', '.title');
  const gapNums     = copy.keys('gaps.',     '.title');
  const fixNums     = copy.keys('fixes.',    '.problem');

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
              {copy('hero.badge', 'Problem & Solution')}
            </span>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', marginBottom: '20px' }}>
              {copy('hero.headline', 'The problem is real. The fixes are already built.')}
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75 }}>
              {copy('hero.subheadline', "Here's an honest breakdown of what's broken in casual workforce management, where existing tools fall short, and exactly how Tasking addresses it.")}
            </p>
          </div>
        </section>
      )}

      {/* ========== THE PROBLEM ========== */}
      {copy.visible('section.problems') && (
        <section style={{ background: '#FFFBF5', padding: '80px 0' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '52px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>The problem</p>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' }}>
                {copy('problems.title', 'What SMEs are dealing with every day')}
              </h2>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.7, maxWidth: '560px', margin: '0 auto' }}>
                {copy('problems.subtitle', "These aren't edge cases. They're the daily reality for any SME relying on casual workers.")}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '860px', margin: '0 auto' }}>
              {problemNums.map((n, i) => (
                <div key={n} style={{ display: 'flex', gap: '24px', background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '16px', padding: '28px', alignItems: 'flex-start' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#FEF3C7', border: '2px solid #F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.875rem', color: '#F97316' }}>{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.0625rem', color: '#1C1917', marginBottom: '6px' }}>
                      {copy(`problems.${n}.title`, '')}
                    </h3>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7 }}>
                      {copy(`problems.${n}.body`, '')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========== WHAT THE MARKET GOT WRONG ========== */}
      {copy.visible('section.gaps') && (
        <section style={{ background: '#FFFFFF', padding: '80px 0' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '52px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>What the market got wrong</p>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' }}>
                {copy('gaps.title', "Existing tools weren't built for this")}
              </h2>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.7, maxWidth: '560px', margin: '0 auto' }}>
                {copy('gaps.subtitle', 'Seven specific gaps in the tools SMEs are currently using — and paying for.')}
              </p>
            </div>
            <div className="grid-features-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', maxWidth: '960px', margin: '0 auto' }}>
              {gapNums.map(n => (
                <div key={n} style={{ display: 'flex', gap: '16px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '24px', alignItems: 'flex-start' }}>
                  <X size={20} color="#EF4444" strokeWidth={2} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1rem', color: '#6B7280', marginBottom: '6px' }}>
                      {copy(`gaps.${n}.title`, '')}
                    </h3>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#78716C', lineHeight: 1.65 }}>
                      {copy(`gaps.${n}.detail`, '')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========== HOW TASKING FIXES IT ========== */}
      {copy.visible('section.fixes') && (
        <section style={{ background: '#FFFBF5', padding: '80px 0' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '52px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 600, color: '#F97316', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>How Tasking fixes it</p>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' }}>
                {copy('fixes.title', 'Every problem. Directly addressed.')}
              </h2>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.7, maxWidth: '560px', margin: '0 auto' }}>
                {copy('fixes.subtitle', 'Not workarounds. Not partial fixes. Specific features built to solve each problem.')}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '900px', margin: '0 auto' }}>
              {fixNums.map(n => (
                <div key={n} style={{ background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '16px', padding: '28px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '12px' }}>
                    <CheckCircle2 size={22} color="#F97316" strokeWidth={1.75} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8125rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                        Problem: {copy(`fixes.${n}.problem`, '')}
                      </p>
                      <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.0625rem', color: '#F97316' }}>
                        {copy(`fixes.${n}.solution`, '')}
                      </h3>
                    </div>
                  </div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7, paddingLeft: '38px' }}>
                    {copy(`fixes.${n}.detail`, '')}
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
              {copy('cta.headline', 'See it working. For free.')}
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
