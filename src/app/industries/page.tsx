import Link from 'next/link';
import { hero, intro, industries, closing, cta } from './content';

// ─── Design tokens ────────────────────────────────────────────────────────────

const maxW: React.CSSProperties = { maxWidth: '1280px', margin: '0 auto', padding: '0 48px' };
const maxWNarrow: React.CSSProperties = { maxWidth: '800px', margin: '0 auto', padding: '0 48px' };

// ─── Industry icons (inline SVG — lucide-react not installed) ─────────────────

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

const iconMap: Record<string, React.FC> = {
  retail: RetailIcon,
  fnb: FnbIcon,
  logistics: LogisticsIcon,
  'event-management': EventIcon,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IndustriesPage() {
  return (
    <>
      {/* ============================= HERO SECTION ============================= */}
      <section style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div style={{ ...maxWNarrow, textAlign: 'center' }}>
          <span style={{
            display: 'inline-block',
            background: 'rgba(249,115,22,0.18)',
            color: '#FB923C',
            padding: '5px 14px',
            borderRadius: '100px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            marginBottom: '24px',
          }}>
            Industries
          </span>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '3rem',
            lineHeight: 1.15,
            color: '#FFFFFF',
            marginBottom: '20px',
          }}>
            {hero.headline}
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.0625rem',
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.75,
            maxWidth: '620px',
            margin: '0 auto 36px',
          }}>
            {hero.subheadline}
          </p>
          <Link
            href="/get-started"
            className="btn-press cta-shimmer"
            style={{
              display: 'inline-block',
              background: '#F97316',
              color: '#FFFFFF',
              padding: '13px 30px',
              borderRadius: '10px',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: '0.9375rem',
            }}
          >
            {hero.cta}
          </Link>
        </div>
      </section>

      {/* ============================= INTRO SECTION ============================= */}
      <section style={{ background: '#FFFFFF', padding: '72px 0' }}>
        <div style={{ ...maxWNarrow, textAlign: 'center' }}>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '1.875rem',
            color: '#1C1917',
            lineHeight: 1.3,
            marginBottom: '20px',
          }}>
            {intro.title}
          </h2>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.0625rem',
            color: '#78716C',
            lineHeight: 1.75,
          }}>
            {intro.body}
          </p>
        </div>
      </section>

      {/* ============================= INDUSTRIES SECTION ============================= */}
      <section style={{ background: '#FFFBF5', padding: '40px 0 80px' }}>
        <div style={maxW}>
          {industries.map((industry, idx) => {
            const Icon = iconMap[industry.id];
            const isEven = idx % 2 === 0;

            return (
              <div key={industry.id}>
                {/* Industry row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '80px',
                  padding: '64px 0',
                  flexDirection: isEven ? 'row' : 'row-reverse',
                }}>
                  {/* Text side */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Badge */}
                    <span style={{
                      display: 'inline-block',
                      background: '#FEF3C7',
                      color: '#92400E',
                      padding: '4px 14px',
                      borderRadius: '100px',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-body)',
                      marginBottom: '20px',
                    }}>
                      {industry.badge}
                    </span>

                    {/* Opening question */}
                    <h2 style={{
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 700,
                      fontSize: '2rem',
                      color: '#1C1917',
                      lineHeight: 1.25,
                      marginBottom: '16px',
                    }}>
                      {industry.question}
                    </h2>

                    {/* Pain point */}
                    <p style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '1rem',
                      color: '#78716C',
                      lineHeight: 1.75,
                      marginBottom: '28px',
                    }}>
                      {industry.painPoint}
                    </p>

                    {/* How Tasking helps heading */}
                    <p style={{
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 600,
                      fontSize: '0.9375rem',
                      color: '#F97316',
                      marginBottom: '10px',
                      letterSpacing: '0.01em',
                    }}>
                      {industry.solutionHeading}
                    </p>

                    {/* Solution */}
                    <p style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '1rem',
                      color: '#1C1917',
                      lineHeight: 1.75,
                    }}>
                      {industry.solution}
                    </p>
                  </div>

                  {/* Icon side */}
                  <div style={{
                    width: '280px',
                    height: '280px',
                    flexShrink: 0,
                    background: '#FFFFFF',
                    border: '1px solid #F0E8D8',
                    borderRadius: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                  }}>
                    <Icon />
                  </div>
                </div>

                {/* Divider — not after last item */}
                {idx < industries.length - 1 && (
                  <div style={{ height: '1px', background: '#F0E8D8', width: '100%' }} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================= CLOSING STATEMENT SECTION ============================= */}
      <section style={{ background: '#F5F0E8', padding: '80px 0' }}>
        <div style={{ ...maxWNarrow, textAlign: 'center' }}>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '2.25rem',
            color: '#1C1917',
            marginBottom: '16px',
            lineHeight: 1.25,
          }}>
            {closing.title}
          </h2>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.0625rem',
            color: '#78716C',
            lineHeight: 1.75,
          }}>
            {closing.body}
          </p>
        </div>
      </section>

      {/* ============================= FINAL CTA SECTION ============================= */}
      <section style={{ background: '#F97316', padding: '80px 24px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '2.5rem',
            color: '#FFFFFF',
            marginBottom: '16px',
            lineHeight: 1.2,
          }}>
            {cta.headline}
          </h2>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.0625rem',
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.7,
            marginBottom: '36px',
          }}>
            {cta.subheadline}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/get-started"
              className="btn-press"
              style={{
                display: 'inline-block',
                background: '#FFFFFF',
                color: '#F97316',
                padding: '13px 30px',
                borderRadius: '10px',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: '0.9375rem',
              }}
            >
              {cta.primaryBtn}
            </Link>
            <Link
              href="/pricing"
              className="btn-press"
              style={{
                display: 'inline-block',
                background: 'transparent',
                color: '#FFFFFF',
                padding: '13px 30px',
                borderRadius: '10px',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '0.9375rem',
                border: '2px solid rgba(255,255,255,0.6)',
              }}
            >
              {cta.secondaryBtn}
            </Link>
          </div>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.875rem',
            color: 'rgba(255,255,255,0.6)',
            marginTop: '16px',
          }}>
            {cta.footnote}
          </p>
        </div>
      </section>
    </>
  );
}
