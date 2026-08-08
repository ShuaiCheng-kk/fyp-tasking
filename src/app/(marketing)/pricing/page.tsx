'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { hero, plans, comparisonTable, faqs } from './content';
import type { ComparisonModule } from './content';

const fontHeading = 'var(--font-heading)';
const fontBody = 'var(--font-body)';

function Cell({ value }: { value: boolean }) {
  return value ? (
    <span style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px',
      borderRadius: '50%', background: '#F97316', flexShrink: 0,
    }}>
      <Check size={14} color="#FFFFFF" strokeWidth={3} />
    </span>
  ) : (
    <span style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px',
      borderRadius: '50%', background: '#E7E5E4', flexShrink: 0,
    }}>
      <span style={{ width: '8px', height: '2px', background: '#A8A29E', borderRadius: '1px' }} />
    </span>
  );
}

function ComparisonModuleBlock({ mod, isOpen, onToggle }: { mod: ComparisonModule; isOpen: boolean; onToggle: () => void }) {
  return (
    <>
      <div
        onClick={onToggle}
        className="comparison-module-header"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#1C1917', padding: '14px 24px', border: 'none', borderTop: '1px solid #F0E8D8',
          textAlign: 'left', cursor: 'pointer',
        }}
      >
        <span style={{ fontFamily: fontHeading, fontSize: '0.9375rem', fontWeight: 700, color: '#FFFFFF' }}>
          {mod.title}
        </span>
        <ChevronDown
          size={18} color="#FFFFFF"
          style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
        />
      </div>
      <div style={{
        maxHeight: isOpen ? `${mod.rows.length * 60}px` : '0px',
        overflow: 'hidden', transition: 'max-height 0.35s ease',
      }}>
        {mod.rows.map((row, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 100px 100px',
            padding: '14px 24px', borderTop: '1px solid #F5F0E8', alignItems: 'center',
          }}>
            <span style={{ fontFamily: fontBody, fontSize: '0.9375rem', color: '#374151' }}>{row.feature}</span>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Cell value={row.free} /></div>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Cell value={row.pro} /></div>
          </div>
        ))}
      </div>
    </>
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

// ─── Upgrade confirmation modal ───────────────────────────────────────────────

function UpgradeModal({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  const [companyName, setCompanyName] = useState('your company');
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [membersRes] = await Promise.all([
          fetch(`/api/team/members?company_id=${companyId}`),
        ]);
        const membersData = await membersRes.json();
        if (!cancelled) {
          if (membersData.success) setMemberCount(membersData.members.length);
        }
        // Fetch company name from companies list
        const uid = typeof localStorage !== 'undefined' ? localStorage.getItem('tasking_user_id') : null;
        if (uid) {
          setUserId(uid);
          const [companiesRes, meRes] = await Promise.all([
            fetch(`/api/company/my-companies?owner_id=${uid}`),
            fetch(`/api/user/me?user_id=${uid}`),
          ]);
          const companiesData = await companiesRes.json();
          if (!cancelled && companiesData.success) {
            const match = companiesData.companies?.find((c: any) => c.id === companyId);
            if (match) setCompanyName(match.name);
          }
          const meData = await meRes.json();
          if (!cancelled && meData.success) setUserEmail(meData.user.email_address);
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
      const res = await fetch('/api/stripe/upgrade-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, userId, email: userEmail }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setConfirming(false);
    }
  };

  const monthlyCost = memberCount !== null ? memberCount * 6 : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(3px)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: '20px', padding: '36px',
          width: '100%', maxWidth: '460px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: '1.25rem', color: '#111827', margin: 0 }}>
            Upgrade to Pro?
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '4px', display: 'flex', borderRadius: '6px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <p style={{ fontFamily: fontBody, fontSize: '0.9375rem', color: '#6B7280', margin: '0 0 24px' }}>
            Loading details…
          </p>
        ) : (
          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontFamily: fontBody, fontSize: '0.9375rem', color: '#374151', margin: '0 0 16px', lineHeight: 1.6 }}>
              All members of <strong>{companyName}</strong> will be upgraded to Pro.
            </p>
            {monthlyCost !== null && (
              <div style={{
                background: '#FFFBF5', border: '1px solid #FED7AA',
                borderRadius: '12px', padding: '16px 20px',
                display: 'flex', flexDirection: 'column', gap: '6px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: fontBody, fontSize: '0.875rem', color: '#78716C' }}>Users</span>
                  <span style={{ fontFamily: fontBody, fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{memberCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: fontBody, fontSize: '0.875rem', color: '#78716C' }}>Price per user</span>
                  <span style={{ fontFamily: fontBody, fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>$6 / month</span>
                </div>
                <div style={{ height: '1px', background: '#FED7AA', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: fontBody, fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>Total</span>
                  <span style={{ fontFamily: fontHeading, fontSize: '1.125rem', fontWeight: 800, color: '#F97316' }}>
                    ${monthlyCost}/month
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '11px', background: 'none', border: '1.5px solid #E5E7EB',
              borderRadius: '10px', fontFamily: fontBody, fontWeight: 600, fontSize: '0.9375rem',
              color: '#6B7280', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming || loading}
            style={{
              flex: 1, padding: '11px', background: '#F97316', border: 'none',
              borderRadius: '10px', fontFamily: fontBody, fontWeight: 700, fontSize: '0.9375rem',
              color: '#FFFFFF', cursor: confirming || loading ? 'default' : 'pointer',
              opacity: confirming || loading ? 0.65 : 1,
            }}
          >
            {confirming ? 'Upgrading…' : 'Confirm Upgrade'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inner page (needs useSearchParams) ──────────────────────────────────────

function PricingInner() {
  const searchParams = useSearchParams();
  const isUpgradeFlow = searchParams.get('upgrade') === '1';
  const companyId = searchParams.get('company_id') ?? '';

  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const toggleFaq = (i: number) => setOpenFaq(openFaq === i ? null : i);

  const [openModules, setOpenModules] = useState<Set<string>>(
    () => new Set(comparisonTable.modules.slice(0, 2).map(m => m.title))
  );
  const [showAllModules, setShowAllModules] = useState(false);
  const toggleModule = (title: string) => {
    setOpenModules(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  };
  const toggleShowAllModules = () => {
    setShowAllModules(prev => {
      const next = !prev;
      if (next) setOpenModules(new Set(comparisonTable.modules.map(m => m.title)));
      return next;
    });
  };

  const handleProCta = (e: React.MouseEvent) => {
    if (isUpgradeFlow && companyId) {
      e.preventDefault();
      setShowModal(true);
    }
  };

  return (
    <>
      {showModal && (
        <UpgradeModal companyId={companyId} onClose={() => setShowModal(false)} />
      )}

      {/* ========== HERO SECTION ========== */}
      <section className="sub-section" style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div className="sub-inner" style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <h1 style={{
            fontFamily: fontHeading, fontWeight: 700, fontSize: '3rem',
            lineHeight: 1.15, color: '#FFFFFF', marginBottom: '20px',
          }}>
            {isUpgradeFlow ? 'Find the plan that fits your team.' : hero.headline}
          </h1>
          <p style={{
            fontFamily: fontBody, fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.75, maxWidth: '640px', margin: '0 auto',
          }}>
            {isUpgradeFlow
              ? 'Compare features below, then click Get Started on the Pro plan to upgrade.'
              : hero.subheadline}
          </p>
        </div>
      </section>

      {/* ========== PRICING CARDS SECTION ========== */}
      <section className="page-section" style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div className="section-inner" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          <div className="plans-grid">

            {/* Free card */}
            <div style={{
              background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '20px',
              padding: '40px', display: 'flex', flexDirection: 'column', position: 'relative',
            }}>
              <p style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: '1.5rem', color: '#1C1917', marginBottom: '12px' }}>
                {plans.free.name}
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '16px' }}>
                <span style={{ fontFamily: fontHeading, fontWeight: 800, fontSize: '3rem', color: '#1C1917' }}>{plans.free.price}</span>
                <span style={{ fontFamily: fontBody, fontSize: '1.0625rem', color: '#78716C' }}>{plans.free.priceSub}</span>
              </div>
              <p style={{ fontFamily: fontBody, fontSize: '0.9375rem', fontWeight: 600, color: '#9CA3AF', marginBottom: '14px', paddingTop: '20px', borderTop: '1px solid #F0E8D8' }}>
                {plans.free.featuresIntro}
              </p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', flex: 1 }}>
                {plans.free.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Check size={18} color="#9CA3AF" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                    <span style={{ fontFamily: fontBody, fontSize: '1.0625rem', color: '#374151' }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href={plans.free.ctaHref} className="btn-press" style={{
                display: 'block', textAlign: 'center', background: 'transparent', color: '#F97316',
                padding: '13px', borderRadius: '10px', fontFamily: fontBody, fontWeight: 700, fontSize: '1.0625rem',
                border: '2px solid #F97316',
              }}>
                {plans.free.cta}
              </Link>
            </div>

            {/* Pro card */}
            <div style={{
              background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '20px',
              padding: '40px', display: 'flex', flexDirection: 'column', position: 'relative',
              boxShadow: '0 8px 40px rgba(249,115,22,0.12)',
            }}>
              <span style={{
                position: 'absolute', top: '20px', right: '20px', background: '#F97316',
                color: '#FFFFFF', padding: '3px 12px', borderRadius: '100px',
                fontSize: '0.75rem', fontWeight: 700, fontFamily: fontBody,
              }}>
                {plans.pro.badge}
              </span>
              <p style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: '1.5rem', color: '#1C1917', marginBottom: '12px' }}>
                {plans.pro.name}
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '16px' }}>
                <span style={{ fontFamily: fontHeading, fontWeight: 800, fontSize: '3rem', color: '#F97316' }}>{plans.pro.price}</span>
                <span style={{ fontFamily: fontBody, fontSize: '1.0625rem', color: '#78716C' }}>{plans.pro.priceSub}</span>
              </div>
              <p style={{ fontFamily: fontBody, fontSize: '0.9375rem', fontWeight: 600, color: '#9CA3AF', marginBottom: '14px', paddingTop: '20px', borderTop: '1px solid #F0E8D8' }}>
                {plans.pro.featuresIntro}
              </p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', flex: 1 }}>
                {plans.pro.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Check size={18} color="#F97316" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                    <span style={{ fontFamily: fontBody, fontSize: '1.0625rem', color: '#374151' }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={isUpgradeFlow ? '#' : plans.pro.ctaHref}
                onClick={handleProCta}
                className="btn-press cta-shimmer"
                style={{
                  display: 'block', textAlign: 'center', background: '#F97316', color: '#FFFFFF',
                  padding: '14px', borderRadius: '10px', fontFamily: fontBody, fontWeight: 700, fontSize: '1.0625rem',
                }}
              >
                {isUpgradeFlow ? 'Get Started — Upgrade Now' : plans.pro.cta}
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ========== COMPARISON TABLE SECTION ========== */}
      <section className="page-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div className="section-inner" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: '2.25rem', color: '#1C1917' }}>
              {comparisonTable.sectionTitle}
            </h2>
          </div>
          <div style={{ maxWidth: '780px', margin: '0 auto' }}>
            <div style={{ borderRadius: '16px', overflow: 'clip' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 100px 100px', padding: '16px 24px', alignItems: 'center',
                position: 'sticky', top: '68px', zIndex: 5, background: '#FFFFFF', borderBottom: '1px solid #F0E8D8',
              }}>
                <span />
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span style={{
                    background: '#F3F4F6', color: '#374151', padding: '8px 22px', borderRadius: '100px',
                    fontFamily: fontBody, fontWeight: 700, fontSize: '1rem',
                  }}>
                    Free
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span style={{
                    background: '#F97316', color: '#FFFFFF', padding: '8px 22px', borderRadius: '100px',
                    fontFamily: fontBody, fontWeight: 700, fontSize: '1rem',
                  }}>
                    Pro
                  </span>
                </div>
              </div>
              {comparisonTable.modules.slice(0, 2).map((mod) => (
                <ComparisonModuleBlock
                  key={mod.title}
                  mod={mod}
                  isOpen={openModules.has(mod.title)}
                  onToggle={() => toggleModule(mod.title)}
                />
              ))}
              {showAllModules && comparisonTable.modules.slice(2).map((mod) => (
                <ComparisonModuleBlock
                  key={mod.title}
                  mod={mod}
                  isOpen={openModules.has(mod.title)}
                  onToggle={() => toggleModule(mod.title)}
                />
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '28px' }}>
            <button
              onClick={toggleShowAllModules}
              className="see-all-features-btn"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontFamily: fontBody, fontSize: '0.9375rem', fontWeight: 600, color: '#F97316',
                textDecoration: 'underline', textUnderlineOffset: '3px',
              }}
            >
              {showAllModules ? 'Hide additional features' : 'See all features'}
            </button>
          </div>
        </div>
      </section>

      {/* ========== FAQ SECTION ========== */}
      <section style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: '2.25rem', color: '#1C1917' }}>
              {faqs.sectionTitle}
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faqs.items.map(({ q, a }, i) => (
              <FaqItem key={i} q={q} a={a} isOpen={openFaq === i} onToggle={() => toggleFaq(i)} />
            ))}
          </div>
        </div>
      </section>

    </>
  );
}

// ─── Page (wraps in Suspense for useSearchParams) ─────────────────────────────

export default function PricingPage() {
  return (
    <Suspense>
      <PricingInner />
    </Suspense>
  );
}