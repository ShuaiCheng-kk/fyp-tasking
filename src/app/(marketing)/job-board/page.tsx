'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap, Shield, Star, X } from 'lucide-react';
import { hero, search, listings, whyTasking } from './content';

// ─── Design tokens ────────────────────────────────────────────────────────────

const fH = 'var(--font-heading)';
const fB = 'var(--font-body)';

// ─── Icon map ─────────────────────────────────────────────────────────────────

const iconMap = { Zap, Shield, Star } as const;
type IconName = keyof typeof iconMap;

// ─── Dummy card data (6 placeholders) ─────────────────────────────────────────

const DUMMY_CARDS = Array.from({ length: 6 }, (_, i) => ({ id: i }));

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobBoardPage() {
  const [modalOpen, setModalOpen] = useState<number | null>(null);

  const closeModal = () => setModalOpen(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = modalOpen !== null ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [modalOpen]);

  return (
    <>
      {/* ========== HERO SECTION ========== */}
      <section className="sub-section" style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div className="sub-inner" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <h1 className="sub-hero-h1" style={{
            fontFamily: fH,
            fontWeight: 700,
            fontSize: '3.25rem',
            lineHeight: 1.15,
            color: '#FFFFFF',
            marginBottom: '24px',
          }}>
            {hero.headline}
          </h1>
          <p style={{
            fontFamily: fB,
            fontSize: '1.0625rem',
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.75,
            maxWidth: '620px',
            margin: '0 auto',
          }}>
            {hero.subheadline}
          </p>
        </div>
      </section>

      {/* ========== WHY TASKING SECTION ========== */}
      <section className="page-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div className="section-inner" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 className="sub-h2" style={{ fontFamily: fH, fontWeight: 700, fontSize: '2.25rem', color: '#1C1917' }}>
              {whyTasking.sectionTitle}
            </h2>
          </div>
          <div className="grid-features-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '28px' }}>
            {whyTasking.cards.map(({ iconName, title, body }) => {
              const Icon = iconMap[iconName as IconName];
              return (
                <div key={title} style={{
                  background: '#FFFBF5',
                  border: '1px solid #F0E8D8',
                  borderRadius: '16px',
                  padding: '32px',
                }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    background: 'rgba(249,115,22,0.1)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '20px',
                  }}>
                    <Icon size={22} color="#F97316" strokeWidth={2} />
                  </div>
                  <h3 style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.125rem', color: '#1C1917', marginBottom: '10px' }}>
                    {title}
                  </h3>
                  <p style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.75 }}>
                    {body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========== JOB LISTINGS SECTION ========== */}
      <section className="page-section" style={{ background: '#FFFBF5', padding: '40px 0 80px' }}>
        <div className="section-inner" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>

          {/* Section heading */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 className="sub-h2" style={{ fontFamily: fH, fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' }}>
              {listings.sectionTitle}
            </h2>
            <p style={{ fontFamily: fB, fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.7 }}>
              {listings.sectionSubtitle}
            </p>
          </div>

          {/* Placeholder banner */}
          <div style={{
            background: '#FFFBEB',
            border: '1px solid #FCD34D',
            borderRadius: '10px',
            padding: '14px 20px',
            marginBottom: '24px',
            fontFamily: fB,
            fontSize: '0.9375rem',
            color: '#92400E',
            lineHeight: 1.6,
          }}>
            {listings.placeholderBanner}
          </div>

          {/* Search & filter bar */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #F0E8D8',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '40px',
          }}>
            <p style={{
              fontFamily: fB,
              fontSize: '0.8125rem',
              color: '#9CA3AF',
              marginBottom: '12px',
              fontStyle: 'italic',
            }}>
              {search.devNote}
            </p>
            <div className="search-filter-row">
              <input
                type="text"
                placeholder={search.placeholder}
                style={{
                  flex: 1,
                  fontFamily: fB,
                  fontSize: '0.9375rem',
                  color: '#1C1917',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  background: '#FFFFFF',
                  outline: 'none',
                }}
              />
              {[
                { placeholder: 'Industry', options: search.industries },
                { placeholder: 'Job Type', options: search.jobTypes },
                { placeholder: 'Location', options: search.locations },
              ].map(({ placeholder, options }) => (
                <select
                  key={placeholder}
                  defaultValue={options[0]}
                  style={{
                    fontFamily: fB,
                    fontSize: '0.9375rem',
                    color: '#374151',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    background: '#FFFFFF',
                    cursor: 'pointer',
                    minWidth: '150px',
                    outline: 'none',
                  }}
                >
                  {options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ))}
              <button
                className="btn-press"
                style={{
                  background: '#F97316',
                  color: '#FFFFFF',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  fontFamily: fB,
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {search.button}
              </button>
            </div>
          </div>

          {/* 3-column cards grid */}
          <div className="grid-features-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {DUMMY_CARDS.map(({ id }) => (
              <div
                key={id}
                style={{
                  background: '#FFFFFF',
                  border: '2px dashed #D1D5DB',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <span style={{
                  display: 'inline-block',
                  alignSelf: 'flex-start',
                  background: '#F3F4F6',
                  color: '#6B7280',
                  fontFamily: fB,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '100px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  DUMMY — Status placeholder
                </span>

                <div style={{ borderBottom: '1px solid #F0E8D8', paddingBottom: '12px' }}>
                  <p style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.0625rem', color: '#9CA3AF' }}>
                    DUMMY — Job Title placeholder
                  </p>
                  <p style={{ fontFamily: fB, fontSize: '0.875rem', color: '#9CA3AF', marginTop: '4px' }}>
                    DUMMY — Company placeholder
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  {[
                    'DUMMY — Department placeholder',
                    'DUMMY — Location placeholder',
                    'DUMMY — Shift Hours placeholder',
                    'DUMMY — Date Posted placeholder',
                  ].map((text) => (
                    <p key={text} style={{ fontFamily: fB, fontSize: '0.8125rem', color: '#9CA3AF' }}>
                      {text}
                    </p>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button
                    onClick={() => setModalOpen(id)}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      background: 'transparent',
                      border: '1.5px solid #D1D5DB',
                      borderRadius: '8px',
                      fontFamily: fB,
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: '#374151',
                      cursor: 'pointer',
                    }}
                  >
                    View Details
                  </button>
                  <Link
                    href="/get-started"
                    className="btn-press"
                    style={{
                      flex: 1,
                      display: 'block',
                      textAlign: 'center',
                      padding: '10px 0',
                      background: '#F97316',
                      borderRadius: '8px',
                      fontFamily: fB,
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: '#FFFFFF',
                    }}
                  >
                    Apply Now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== VIEW DETAILS MODAL ========== */}
      {modalOpen !== null && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              borderRadius: '20px',
              padding: '40px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              position: 'relative',
            }}
          >
            <button
              onClick={closeModal}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: '#F3F4F6',
                border: 'none',
                borderRadius: '8px',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} color="#374151" />
            </button>

            <p style={{
              fontFamily: fB,
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#9CA3AF',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '12px',
            }}>
              DUMMY — Company placeholder
            </p>
            <h2 style={{
              fontFamily: fH,
              fontWeight: 700,
              fontSize: '1.5rem',
              color: '#9CA3AF',
              marginBottom: '24px',
            }}>
              DUMMY — Job Title placeholder
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
              {[
                { label: 'Description', value: 'DUMMY — Full job description placeholder' },
                { label: 'Requirements', value: 'DUMMY — Requirements placeholder' },
                { label: 'Shift Details', value: 'DUMMY — Shift details placeholder' },
                { label: 'Pay Rate', value: 'DUMMY — Pay rate placeholder' },
              ].map(({ label, value }) => (
                <div key={label} style={{ borderBottom: '1px solid #F0E8D8', paddingBottom: '16px' }}>
                  <p style={{ fontFamily: fB, fontWeight: 600, fontSize: '0.8125rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    {label}
                  </p>
                  <p style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#9CA3AF' }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <Link
              href="/get-started"
              className="btn-press cta-shimmer"
              style={{
                display: 'block',
                textAlign: 'center',
                background: '#F97316',
                color: '#FFFFFF',
                padding: '14px',
                borderRadius: '10px',
                fontFamily: fB,
                fontWeight: 700,
                fontSize: '0.9375rem',
              }}
            >
              Apply Now
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
