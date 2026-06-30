'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useMarketingCopy } from '../../useMarketingCopy';

function AccordionItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid', borderColor: isOpen ? '#F97316' : '#F0E8D8', borderRadius: '14px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 28px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: '16px' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.0625rem', color: isOpen ? '#F97316' : '#1C1917', lineHeight: 1.4, transition: 'color 0.2s' }}>
          {q}
        </span>
        <ChevronDown size={20} color={isOpen ? '#F97316' : '#78716C'} style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }} />
      </button>
      <div style={{ maxHeight: isOpen ? '400px' : '0', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.75, padding: '0 28px 24px' }}>{a}</p>
      </div>
    </div>
  );
}

export default function FAQPage() {
  const copy = useMarketingCopy('about-faq');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqNums = copy.keys('faq.', '.q');

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
              {copy('hero.badge', 'FAQ')}
            </span>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', marginBottom: '20px' }}>
              {copy('hero.headline', 'Questions we get all the time.')}
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75 }}>
              {copy('hero.subheadline', "Honest answers about how Tasking works, what's free, and what to expect.")}
            </p>
          </div>
        </section>
      )}

      {/* ========== ACCORDION ========== */}
      {copy.visible('section.faq') && (
        <section style={{ background: '#FFFBF5', padding: '80px 0' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {faqNums.map((n, i) => (
                <AccordionItem
                  key={n}
                  q={copy(`faq.${n}.q`, '')}
                  a={copy(`faq.${n}.a`, '')}
                  isOpen={openIndex === i}
                  onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========== STILL HAVE QUESTIONS ========== */}
      {copy.visible('section.still') && (
        <section style={{ background: '#FFFFFF', padding: '60px 24px' }}>
          <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.75rem', color: '#1C1917', marginBottom: '12px' }}>
              {copy('still.headline', 'Still have questions?')}
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: '#78716C', lineHeight: 1.7, marginBottom: '28px' }}>
              {copy('still.body', 'The best way to get answers is to try it. Everything in the core plan is free.')}
            </p>
            <Link href={copy('still.button.url', '/get-started')} className="btn-press cta-shimmer" style={{ display: 'inline-block', background: '#F97316', color: '#FFFFFF', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9375rem' }}>
              {copy('still.button.label', 'Get Started Free')}
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
