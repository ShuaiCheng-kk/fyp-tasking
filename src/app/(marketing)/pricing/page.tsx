'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { useMarketingCopy } from '../useMarketingCopy';

const fontHeading = 'var(--font-heading)';
const fontBody = 'var(--font-body)';

function Cell({ value }: { value: boolean }) {
  return value ? (
    <Check size={18} color="#F97316" strokeWidth={2.5} />
  ) : (
    <span style={{ fontFamily: fontBody, fontSize: '1rem', color: '#D1D5DB', fontWeight: 500 }}>—</span>
  );
}

function FaqItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid ${isOpen ? '#F97316' : '#F0E8D8'}`,
      borderRadius: '14px',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 28px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', gap: '16px',
        }}
      >
        <span style={{
          fontFamily: fontHeading, fontWeight: 600, fontSize: '1.0625rem',
          color: isOpen ? '#F97316' : '#1C1917', lineHeight: 1.4, transition: 'color 0.2s',
        }}>
          {q}
        </span>
        <ChevronDown
          size={20} color={isOpen ? '#F97316' : '#78716C'}
          style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}
        />
      </button>
      <div style={{ maxHeight: isOpen ? '300px' : '0', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
        <p style={{ fontFamily: fontBody, fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.75, padding: '0 28px 24px' }}>
          {a}
        </p>
      </div>
    </div>
  );
}

function UpgradeModal({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('your company');
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [membersRes] = await Promise.all([fetch(`/api/team/members?company_id=${companyId}`)]);
        const membersData = await membersRes.json();
        if (!cancelled && membersData.success) setMemberCount(membersData.members.length);
        const uid = typeof localStorage !== 'undefined' ? localStorage.getItem('tasking_user_id') : null;
        if (uid) {
          const companiesRes = await fetch(`/api/company/my-companies?owner_id=${uid}`);
          const companiesData = await companiesRes.json();
          if (!cancelled && companiesData.success) {
            const match = companiesData.companies?.find((c: any) => c.id === companyId);
            if (match) setCompanyName(match.name);
          }
        }
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [companyId]);

  const handleConfirm = async () => {
    setConfirming(true);
    setError('');
    try {
      const res = await fetch('/api/company/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, plan: 'Paid' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      router.push('/owner/settings?tab=subscription');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade plan');
      setConfirming(false);
    }
  };

  const monthlyCost = memberCount !== null ? memberCount * 6 : null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: '20px', padding: '36px', width: '100%', maxWidth: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: '1.25rem', color: '#111827', margin: 0 }}>Upgrade to Pro?</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '4px', display: 'flex', borderRadius: '6px' }}><X size={20} /></button>
        </div>
        {loading ? (
          <p style={{ fontFamily: fontBody, fontSize: '0.9375rem', color: '#6B7280', margin: '0 0 24px' }}>Loading details…</p>
        ) : (
          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontFamily: fontBody, fontSize: '0.9375rem', color: '#374151', margin: '0 0 16px', lineHeight: 1.6 }}>All members of <strong>{companyName}</strong> will be upgraded to Pro.</p>
            {monthlyCost !== null && (
              <div style={{ background: '#FFFBF5', border: '1px solid #FED7AA', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontFamily: fontBody, fontSize: '0.875rem', color: '#78716C' }}>Users</span><span style={{ fontFamily: fontBody, fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{memberCount}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontFamily: fontBody, fontSize: '0.875rem', color: '#78716C' }}>Price per user</span><span style={{ fontFamily: fontBody, fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>$6 / month</span></div>
                <div style={{ height: '1px', background: '#FED7AA', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontFamily: fontBody, fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>Total</span><span style={{ fontFamily: fontHeading, fontSize: '1.125rem', fontWeight: 800, color: '#F97316' }}>${monthlyCost}/month</span></div>
              </div>
            )}
          </div>
        )}
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626', marginBottom: '16px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontFamily: fontBody, fontWeight: 600, fontSize: '0.9375rem', color: '#6B7280', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleConfirm} disabled={confirming || loading} style={{ flex: 1, padding: '11px', background: '#F97316', border: 'none', borderRadius: '10px', fontFamily: fontBody, fontWeight: 700, fontSize: '0.9375rem', color: '#FFFFFF', cursor: confirming || loading ? 'default' : 'pointer', opacity: confirming || loading ? 0.65 : 1 }}>
            {confirming ? 'Upgrading…' : 'Confirm Upgrade'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PricingInner() {
  const searchParams = useSearchParams();
  const isUpgradeFlow = searchParams.get('upgrade') === '1';
  const companyId = searchParams.get('company_id') ?? '';
  const copy = useMarketingCopy('pricing');

  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const toggleFaq = (i: number) => setOpenFaq(openFaq === i ? null : i);

  const handleProCta = (e: React.MouseEvent) => {
    if (isUpgradeFlow && companyId) { e.preventDefault(); setShowModal(true); }
  };

  const freeFeatIdxs = copy.keys('plan.free.feature.', '')
  const proFeatIdxs = copy.keys('plan.pro.feature.', '')
  const faqIdxs = copy.keys('faq.', '.q')
  const compareRowIdxs = copy.keys('compare.row.', '.type')

  return (
    <>
      {showModal && <UpgradeModal companyId={companyId} onClose={() => setShowModal(false)} />}

      {/* ========== HERO ========== */}
      {copy.visible('hero') && (
      <section className="sub-section" style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div className="sub-inner" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <span style={{ display: 'inline-block', background: 'rgba(249,115,22,0.18)', color: '#FB923C', padding: '5px 14px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 600, fontFamily: fontBody, marginBottom: '24px' }}>
            {copy('hero.badge', 'Pricing')}
          </span>
          <h1 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', marginBottom: '20px' }}>
            {isUpgradeFlow ? 'Find the plan that fits your team.' : copy('hero.headline', 'Simple pricing. No surprises.')}
          </h1>
          <p style={{ fontFamily: fontBody, fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75 }}>
            {isUpgradeFlow ? 'Compare features below, then click Get Started on the Pro plan to upgrade.' : copy('hero.subheadline', "Start free. Scale when you're ready.")}
          </p>
        </div>
      </section>
      )}

      {/* ========== PRICING CARDS ========== */}
      {copy.visible('plans') && (
      <section className="page-section" style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div className="section-inner" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' }}>{copy('plans.title', 'Find the plan that fits your team.')}</h2>
            <p style={{ fontFamily: fontBody, fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.7 }}>{copy('plans.subtitle', 'Two plans. Zero hidden fees.')}</p>
          </div>
          <div className="plans-grid">
            {/* Free */}
            <div style={{ background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '20px', padding: '40px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <span style={{ position: 'absolute', top: '20px', right: '20px', background: '#F3F4F6', color: '#6B7280', padding: '3px 12px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 700, fontFamily: fontBody }}>
                {copy('plan.free.badge', 'Free Forever')}
              </span>
              <p style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: '1.25rem', color: '#1C1917', marginBottom: '12px' }}>{copy('plan.free.name', 'Free')}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontFamily: fontHeading, fontWeight: 800, fontSize: '3rem', color: '#1C1917' }}>{copy('plan.free.price', '$0')}</span>
              </div>
              <p style={{ fontFamily: fontBody, fontSize: '0.875rem', color: '#78716C', marginBottom: '16px' }}>{copy('plan.free.pricesub', 'per month, forever')}</p>
              <p style={{ fontFamily: fontBody, fontSize: '0.9375rem', color: '#78716C', marginBottom: '28px', paddingBottom: '28px', borderBottom: '1px solid #F0E8D8' }}>{copy('plan.free.tagline', 'Everything you need to get started.')}</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', flex: 1 }}>
                {freeFeatIdxs.map(idx => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Check size={16} color="#F97316" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                    <span style={{ fontFamily: fontBody, fontSize: '0.9375rem', color: '#374151' }}>{copy(`plan.free.feature.${idx}`, '')}</span>
                  </li>
                ))}
              </ul>
              <Link href={copy('plan.free.cta.url', '/get-started')} className="btn-press cta-shimmer" style={{ display: 'block', textAlign: 'center', background: '#F97316', color: '#FFFFFF', padding: '14px', borderRadius: '10px', fontFamily: fontBody, fontWeight: 700, fontSize: '0.9375rem' }}>
                {copy('plan.free.cta.label', 'Get Started Free')}
              </Link>
            </div>

            {/* Pro */}
            <div style={{ background: '#FFFFFF', border: '2px solid #F97316', borderRadius: '20px', padding: '40px', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 8px 40px rgba(249,115,22,0.12)' }}>
              <span style={{ position: 'absolute', top: '20px', right: '20px', background: '#F97316', color: '#FFFFFF', padding: '3px 12px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 700, fontFamily: fontBody }}>
                {copy('plan.pro.badge', 'Most Popular')}
              </span>
              <p style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: '1.25rem', color: '#1C1917', marginBottom: '12px' }}>{copy('plan.pro.name', 'Pro')}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontFamily: fontHeading, fontWeight: 800, fontSize: '3rem', color: '#F97316' }}>{copy('plan.pro.price', '$6')}</span>
              </div>
              <p style={{ fontFamily: fontBody, fontSize: '0.875rem', color: '#78716C', marginBottom: '16px' }}>{copy('plan.pro.pricesub', 'per user / month')}</p>
              <p style={{ fontFamily: fontBody, fontSize: '0.9375rem', color: '#78716C', marginBottom: '28px', paddingBottom: '28px', borderBottom: '1px solid #F0E8D8' }}>{copy('plan.pro.tagline', 'For teams that need more control.')}</p>
              <p style={{ fontFamily: fontBody, fontSize: '0.8125rem', fontWeight: 600, color: '#9CA3AF', marginBottom: '14px' }}>{copy('plan.pro.featuresintro', 'Includes everything in the Free Plan, plus:')}</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', flex: 1 }}>
                {proFeatIdxs.map(idx => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Check size={16} color="#F97316" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                    <span style={{ fontFamily: fontBody, fontSize: '0.9375rem', color: '#374151' }}>{copy(`plan.pro.feature.${idx}`, '')}</span>
                  </li>
                ))}
              </ul>
              <Link href={isUpgradeFlow ? '#' : copy('plan.pro.cta.url', '/get-started')} onClick={handleProCta} className="btn-press cta-shimmer" style={{ display: 'block', textAlign: 'center', background: '#F97316', color: '#FFFFFF', padding: '14px', borderRadius: '10px', fontFamily: fontBody, fontWeight: 700, fontSize: '0.9375rem' }}>
                {isUpgradeFlow ? 'Get Started — Upgrade Now' : copy('plan.pro.cta.label', 'Get Started')}
              </Link>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ========== COMPARISON TABLE ========== */}
      {copy.visible('compare') && (
      <section className="page-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div className="section-inner" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' }}>{copy('compare.title', 'Everything side by side.')}</h2>
            <p style={{ fontFamily: fontBody, fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.7 }}>{copy('compare.subtitle', "See exactly what's included in each plan.")}</p>
          </div>
          <div className="table-scroll" style={{ maxWidth: '780px', margin: '0 auto' }}>
            <div style={{ border: '1px solid #F0E8D8', borderRadius: '16px', overflow: 'hidden', minWidth: '500px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', background: '#1C1917', padding: '16px 28px' }}>
                <span style={{ fontFamily: fontHeading, fontWeight: 600, fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Feature</span>
                <span style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: '0.9375rem', color: '#FFFFFF', textAlign: 'center' }}>Free</span>
                <span style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: '0.9375rem', color: '#FB923C', textAlign: 'center' }}>Pro</span>
              </div>
              {compareRowIdxs.map((idx, i) => {
                const type = copy(`compare.row.${idx}.type`, 'row')
                if (type === 'group') return (
                  <div key={idx} style={{ background: '#F9FAFB', padding: '10px 28px', borderTop: i > 0 ? '1px solid #F0E8D8' : undefined }}>
                    <span style={{ fontFamily: fontBody, fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{copy(`compare.row.${idx}.label`, '')}</span>
                  </div>
                )
                return (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', padding: '14px 28px', borderTop: '1px solid #F5F0E8', alignItems: 'center' }}>
                    <span style={{ fontFamily: fontBody, fontSize: '0.9375rem', color: '#374151' }}>{copy(`compare.row.${idx}.feature`, '')}</span>
                    <div style={{ display: 'flex', justifyContent: 'center' }}><Cell value={copy(`compare.row.${idx}.free`, 'false') === 'true'} /></div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}><Cell value={copy(`compare.row.${idx}.pro`, 'false') === 'true'} /></div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ========== FAQ ========== */}
      {copy.visible('faq') && (
      <section style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: '2.25rem', color: '#1C1917' }}>{copy('faq.title', 'Pricing questions, answered.')}</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faqIdxs.map((idx, i) => (
              <FaqItem key={idx} q={copy(`faq.${idx}.q`, '')} a={copy(`faq.${idx}.a`, '')} isOpen={openFaq === i} onToggle={() => toggleFaq(i)} />
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ========== CTA ========== */}
      {copy.visible('cta') && (
      <section style={{ background: '#F97316', padding: '80px 24px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: '2.25rem', color: '#FFFFFF', marginBottom: '16px', lineHeight: 1.2 }}>{copy('cta.headline', 'Start free. No commitment.')}</h2>
          <p style={{ fontFamily: fontBody, fontSize: '1.0625rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, marginBottom: '36px' }}>{copy('cta.subheadline', 'Join SMEs already using Tasking.')}</p>
          <Link href={copy('cta.button.url', '/get-started')} className="btn-press" style={{ display: 'inline-block', background: '#FFFFFF', color: '#F97316', padding: '13px 28px', borderRadius: '10px', fontFamily: fontBody, fontWeight: 700, fontSize: '0.9375rem' }}>
            {copy('cta.button.label', 'Get Started Free')}
          </Link>
          <p style={{ fontFamily: fontBody, fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', marginTop: '20px' }}>{copy('cta.footnote', 'No credit card required. Cancel anytime.')}</p>
        </div>
      </section>
      )}
    </>
  );
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingInner />
    </Suspense>
  );
}
