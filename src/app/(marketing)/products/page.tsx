'use client';

import Link from 'next/link';
import { useMarketingCopy } from '../useMarketingCopy';

// ─── Shared styles ────────────────────────────────────────────────────────────

const h1Style: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontWeight: 700,
  fontSize: '3rem',
  lineHeight: 1.15,
  color: '#1C1917',
  marginBottom: '20px',
};

const h2Style: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontWeight: 600,
  fontSize: '2.25rem',
  color: '#1C1917',
  marginBottom: '12px',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: '1.0625rem',
  color: '#78716C',
  lineHeight: 1.75,
  maxWidth: '600px',
  margin: '0 auto',
};

const sectionBase: React.CSSProperties = {
  padding: '80px 0',
};

const inner: React.CSSProperties = {
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '0 24px',
};

// ─── Module icon SVGs ─────────────────────────────────────────────────────────

const RecruitmentIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
    <circle cx="9" cy="7" r="4" stroke="#F97316" strokeWidth="2" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const AttendanceIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="18" rx="2" stroke="#F97316" strokeWidth="2" />
    <path d="M16 2v4M8 2v4M3 10h18" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
    <path d="M9 16l2 2 4-4" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TeamIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="3" stroke="#F97316" strokeWidth="2" />
    <circle cx="5" cy="10" r="2.5" stroke="#F97316" strokeWidth="1.75" />
    <circle cx="19" cy="10" r="2.5" stroke="#F97316" strokeWidth="1.75" />
    <path d="M2 20c0-3 1.8-5 5-5M22 20c0-3-1.8-5-5-5M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#F97316" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

const BellIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const AIIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" stroke="#F97316" strokeWidth="2" strokeLinejoin="round" />
    <path d="M19 15l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" stroke="#F97316" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

// ─── Check / Cross marks ──────────────────────────────────────────────────────

const Check = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="10" fill="#FEF3C7" />
    <path d="M6 10l3 3 5-5" stroke="#F97316" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Cross = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="10" fill="#FEE2E2" />
    <path d="M7 7l6 6M13 7l-6 6" stroke="#EF4444" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const copy = useMarketingCopy('products');

  const scrollToModules = () => {
    const url = copy('hero.button.url', '#modules');
    if (url.startsWith('#')) {
      document.getElementById(url.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.href = url;
    }
  };

  return (
    <>
      {/* ========== HERO ========== */}
      {copy.visible('hero') && (
      <section className="sub-section" style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div className="sub-inner" style={{ ...inner, textAlign: 'center' }}>
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
            {copy('hero.badge', 'Products')}
          </span>
          <h1 style={{ ...h1Style, color: '#FFFFFF', maxWidth: '760px', margin: '0 auto 20px' }}>
            {copy('hero.headline', 'One platform. Every tool your casual workforce needs.')}
          </h1>
          <p style={{ ...subtitleStyle, color: 'rgba(255,255,255,0.65)', maxWidth: '640px' }}>
            {copy('hero.subheadline', 'Tasking brings recruitment, attendance, team management, and AI automation together in one place — so you can stop juggling tools and start running your business.')}
          </p>
          <button
            onClick={scrollToModules}
            className="btn-press cta-shimmer"
            style={{
              marginTop: '36px',
              display: 'inline-block',
              background: '#F97316',
              color: '#FFFFFF',
              padding: '13px 30px',
              borderRadius: '10px',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: '0.9375rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {copy('hero.button.label', 'Explore Our Modules')}
          </button>
        </div>
      </section>
      )}

      {/* ========== WHY ONLY 5 MODULES ========== */}
      {copy.visible('why') && (
      <section style={{ ...sectionBase, background: '#FFFFFF' }}>
        <div style={inner}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#9CA3AF',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '12px',
              }}
            >
              {copy('why.eyebrow', 'What we left out')}
            </p>
            <h2 style={h2Style}>{copy('why.title', 'We kept it simple. On purpose.')}</h2>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1.0625rem',
              color: '#78716C',
              lineHeight: 1.75,
              maxWidth: '720px',
              margin: '0 auto 52px',
              textAlign: 'center',
            }}
          >
            {copy('why.intro', "Most workforce tools were built for corporations with dedicated IT teams and six-figure software budgets. They come packed with modules that look impressive on a features list — but for an SME trying to manage a casual workforce, they just get in the way. Here’s what we left out, and why.")}
          </p>

          <div
            className="grid-features-2"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '20px',
              marginBottom: '40px',
            }}
          >
            {[
              {
                title: copy('why.card.payroll.title',      'Payment & Payroll'),
                body:  copy('why.card.payroll.body',       "Payroll is a legal minefield — tax filings, CPF calculations, regional compliance. It belongs in dedicated payroll software, not a workforce management tool. We stay in our lane so you're not exposed to the risks."),
              },
              {
                title: copy('why.card.integrations.title', 'Integrations'),
                body:  copy('why.card.integrations.body',  "Enterprise API connectors exist for companies with full-time IT departments. If you're running an SME, you don't need a 12-week implementation just to get your team scheduled."),
              },
              {
                title: copy('why.card.reporting.title',    'Reporting & Analytics'),
                body:  copy('why.card.reporting.body',     'Labour forecasting and sales-based scheduling sound great. But they require months of historical data and dedicated analysts to be useful. We give you what actually matters — who showed up, when, and whether the record is accurate.'),
              },
              {
                title: copy('why.card.onboarding.title',   'Support & Onboarding'),
                body:  copy('why.card.onboarding.body',    "If you need a 3-day onboarding programme to use a scheduling tool, something's already gone wrong. Tasking is designed so your team picks it up on day one."),
              },
            ].map(({ title, body }) => (
              <div
                key={title}
                style={{
                  background: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderRadius: '16px',
                  padding: '32px',
                  position: 'relative',
                }}
              >
                {/* "Not included" badge — top right */}
                <span
                  style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    background: '#F3F4F6',
                    color: '#9CA3AF',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    fontFamily: 'var(--font-body)',
                    padding: '3px 10px',
                    borderRadius: '100px',
                    letterSpacing: '0.04em',
                  }}
                >
                  Not included
                </span>
                <h3
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 600,
                    fontSize: '1.125rem',
                    color: '#6B7280',
                    marginBottom: '10px',
                    paddingRight: '100px',
                  }}
                >
                  {title}
                </h3>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.9375rem',
                    color: '#78716C',
                    lineHeight: 1.7,
                  }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>

          <p
            style={{
              textAlign: 'center',
              fontFamily: 'var(--font-body)',
              fontSize: '1rem',
              fontWeight: 600,
              color: '#1C1917',
            }}
          >
            {copy('why.footer', 'Less bloat. More clarity. Everything your team needs to run a casual workforce — nothing that slows you down.')}
          </p>
        </div>
      </section>
      )}

      {/* ========== COMPARISON TABLE ========== */}
      {copy.visible('comparison') && (
      <section style={{ ...sectionBase, background: '#FFFBF5' }}>
        <div style={inner}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={h2Style}>Built different. Here&apos;s the proof.</h2>
            <p style={subtitleStyle}>Features that exist in Tasking and nowhere else.</p>
          </div>

          <div className="table-scroll" style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div
            style={{
              border: '1px solid #F0E8D8',
              borderRadius: '16px',
              overflow: 'hidden',
              minWidth: '480px',
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 180px 180px',
                background: '#1C1917',
                padding: '14px 24px',
              }}
            >
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.875rem', color: '#FFFBF5' }}>
                Feature
              </span>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.875rem', color: '#FFFBF5', textAlign: 'center' }}>
                Current Workforce Tools
              </span>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.875rem', color: '#F97316', textAlign: 'center' }}>
                Tasking
              </span>
            </div>

            {/* Table rows */}
            {[
              'Split shift timeline',
              'Shift acceptance deadlines',
              'Clopening detection',
              'Reverse actions',
              'Support sub-tasks',
              'Recurring job posting',
              'Duplicate job posting',
              'Archive job posting',
              'Photo-based clock-in verification',
              'AI candidate recommendation',
              'AI job description generator',
              'AI anomaly detection',
            ].map((feature, i) => (
              <div
                key={feature}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 180px 180px',
                  padding: '14px 24px',
                  background: i % 2 === 0 ? '#FFFFFF' : '#FFFBF5',
                  borderTop: '1px solid #F0E8D8',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.9375rem',
                    color: '#1C1917',
                  }}
                >
                  {feature}
                </span>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Cross />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Check />
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>
      </section>
      )}

      {/* ========== MODULE OVERVIEW ========== */}
      {copy.visible('modules') && (
      <section id="modules" style={{ ...sectionBase, background: '#FFFFFF' }}>
        <div style={inner}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={h2Style}>{copy('modules.title', 'Five modules. One workflow. Zero gaps.')}</h2>
            <p style={subtitleStyle}>
              {copy('modules.subtitle', 'Every module in Tasking is designed to work together — from the moment you post a job to the moment the shift ends.')}
            </p>
          </div>

          {/* Row 1: 3 cards */}
          <div
            className="grid-features-3"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px',
              marginBottom: '20px',
            }}
          >
            {[
              {
                Icon: RecruitmentIcon,
                name: 'Recruitment',
                tagline: copy('module.recruitment.tagline', 'Find the right people. Fast.'),
                body: copy('module.recruitment.body', 'Hiring casual workers shouldn\'t feel like a full-time job. Tasking gives you a public-facing recruitment page, an AI-powered applicant ranking system, and a one-click invitation flow — so you spend less time sorting through applications and more time running your operations.'),
                link: copy('module.recruitment.link', 'See how Recruitment works →'),
                href: '/products/recruitment',
              },
              {
                Icon: AttendanceIcon,
                name: 'Attendance',
                tagline: copy('module.attendance.tagline', 'Every clock-in. Verified. Every record. Protected.'),
                body: copy('module.attendance.body', 'Manual timesheets get lost. WhatsApp confirmations get disputed. Tasking replaces all of that with photo-verified clock-ins, employee-signed attendance records, and AI that automatically approves clean records and flags suspicious ones.'),
                link: copy('module.attendance.link', 'See how Attendance works →'),
                href: '/products/attendance',
              },
              {
                Icon: TeamIcon,
                name: 'Team Management',
                tagline: copy('module.team.tagline', 'Your company structure, exactly how you need it.'),
                body: copy('module.team.body', 'Set up departments, assign managers, and define who can do what — all from one place. Owners have full visibility across the entire organisation while managers stay focused on their own teams.'),
                link: copy('module.team.link', 'See how Team Management works →'),
                href: '/products/team-management',
              },
            ].map(({ Icon, name, tagline, body, link, href }) => (
              <ModuleCard key={href} Icon={Icon} name={name} tagline={tagline} body={body} link={link} href={href} />
            ))}
          </div>

          {/* Row 2: 2 cards centered */}
          <div
            className="grid-features-2"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '20px',
              maxWidth: '860px',
              margin: '0 auto',
            }}
          >
            {[
              {
                Icon: BellIcon,
                name: 'Smart Notifications',
                tagline: copy('module.notifications.tagline', 'No more chasing people for updates.'),
                body: copy('module.notifications.body', 'Tasking handles the follow-ups automatically. Shift reminders go out before deadlines. Managers get notified the moment an attendance record is submitted. Your team stays in sync without you having to send a single message.'),
                link: copy('module.notifications.link', 'See how Smart Notifications works →'),
                href: '/products/smart-notifications',
              },
              {
                Icon: AIIcon,
                name: 'AI Features',
                tagline: copy('module.ai.tagline', 'Enterprise-grade AI. Free for everyone.'),
                body: copy('module.ai.body', 'Four AI tools built directly into your workflow — and none of them are locked behind a paywall. Generate a job description in seconds. Let the system rank your applicants. Auto-approve timesheets that check out. Get alerted the moment something looks off.'),
                link: copy('module.ai.link', 'See how AI Features works →'),
                href: '/products/ai-features',
              },
            ].map(({ Icon, name, tagline, body, link, href }) => (
              <ModuleCard key={href} Icon={Icon} name={name} tagline={tagline} body={body} link={link} href={href} />
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ========== FINAL CTA ========== */}
      {copy.visible('cta') && (
      <section style={{ background: '#F97316', padding: '80px 24px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '2.5rem',
              color: '#FFFFFF',
              marginBottom: '16px',
              lineHeight: 1.2,
            }}
          >
            {copy('cta.headline', 'Ready to see it in action?')}
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1.0625rem',
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.7,
              marginBottom: '36px',
            }}
          >
            {copy('cta.subheadline', 'Join SMEs already using Tasking to hire smarter, schedule faster, and track with confidence.')}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href={copy('cta.button.url', '/get-started')}
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
              {copy('cta.button.label', 'Get Started Free')}
            </Link>
            <Link
              href={copy('cta.button2.url', '/pricing')}
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
              {copy('cta.button2.label', 'View Pricing')}
            </Link>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
              color: 'rgba(255,255,255,0.6)',
              marginTop: '16px',
            }}
          >
            {copy('cta.note', 'No credit card required. Free forever.')}
          </p>
        </div>
      </section>
      )}
    </>
  );
}

// ─── Module Card Component ─────────────────────────────────────────────────────

function ModuleCard({
  Icon,
  name,
  tagline,
  body,
  link,
  href,
}: {
  Icon: React.FC;
  name: string;
  tagline: string;
  body: string;
  link?: string;
  href: string;
}) {
  return (
    <div
      className="card-lift"
      style={{
        background: '#FFFBF5',
        border: '1px solid #F0E8D8',
        borderRadius: '16px',
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          background: '#FEF3C7',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          flexShrink: 0,
        }}
      >
        <Icon />
      </div>
      <h3
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 600,
          fontSize: '1.1875rem',
          color: '#1C1917',
          marginBottom: '6px',
        }}
      >
        {name}
      </h3>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#F97316',
          marginBottom: '14px',
        }}
      >
        {tagline}
      </p>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.9375rem',
          color: '#78716C',
          lineHeight: 1.7,
          flex: 1,
          marginBottom: '20px',
        }}
      >
        {body}
      </p>
      <Link
        href={href}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#F97316',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {link ?? `See how ${name} works →`}
      </Link>
    </div>
  );
}
