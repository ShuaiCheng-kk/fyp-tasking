'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// ─── Shared style constants ───────────────────────────────────────────────────

const heading2: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontWeight: 600,
  fontSize: '2.25rem',
  color: '#1C1917',
  marginBottom: '12px',
};

const sectionSubtitle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: '1.0625rem',
  color: '#78716C',
  lineHeight: 1.7,
  maxWidth: '560px',
  margin: '0 auto',
};

const btnPrimary: React.CSSProperties = {
  display: 'inline-block',
  background: '#F97316',
  color: '#FFFFFF',
  padding: '13px 28px',
  borderRadius: '10px',
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  fontSize: '0.9375rem',
};

const btnOutline: React.CSSProperties = {
  display: 'inline-block',
  background: 'transparent',
  color: '#1C1917',
  padding: '13px 28px',
  borderRadius: '10px',
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  fontSize: '0.9375rem',
  border: '2px solid #F0E8D8',
};

// ─── Animated section wrapper (Intersection Observer) ─────────────────────────

function AnimatedSection({
  children,
  delay = 0,
  style = {},
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Scroll-to-top button ─────────────────────────────────────────────────────

function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
      style={{
        position: 'fixed',
        bottom: '32px',
        right: '32px',
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        background: '#F97316',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 18px rgba(249,115,22,0.45)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.75)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: 40,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 13V3M3 8l5-5 5 5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// ─── USP Icons ────────────────────────────────────────────────────────────────

const UserIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="9" r="5" stroke="#F97316" strokeWidth="2" />
    <path d="M4 25c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const BuildingIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <rect x="3" y="5" width="22" height="19" rx="2" stroke="#F97316" strokeWidth="2" />
    <path d="M10 24V17h8v7" stroke="#F97316" strokeWidth="2" />
    <rect x="7" y="10" width="4" height="3" rx="0.5" stroke="#F97316" strokeWidth="1.5" />
    <rect x="17" y="10" width="4" height="3" rx="0.5" stroke="#F97316" strokeWidth="1.5" />
  </svg>
);

const SparkleIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path d="M14 3L16.5 11L24 14L16.5 17L14 25L11.5 17L4 14L11.5 11L14 3Z" stroke="#F97316" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

const ClockIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="10" stroke="#F97316" strokeWidth="2" />
    <path d="M14 8V14L17.5 16.5" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Module Icons ─────────────────────────────────────────────────────────────

const RecruitmentIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
    <circle cx="9" cy="7" r="4" stroke="#F97316" strokeWidth="2" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const AttendanceIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="18" rx="2" stroke="#F97316" strokeWidth="2" />
    <path d="M16 2v4M8 2v4M3 10h18" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
    <path d="M9 16l2 2 4-4" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AIIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" stroke="#F97316" strokeWidth="2" strokeLinejoin="round" />
    <path d="M19 15l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" stroke="#F97316" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const TeamIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="3" stroke="#F97316" strokeWidth="2" />
    <circle cx="5" cy="10" r="2.5" stroke="#F97316" strokeWidth="1.75" />
    <circle cx="19" cy="10" r="2.5" stroke="#F97316" strokeWidth="1.75" />
    <path d="M2 20c0-3 1.8-5 5-5" stroke="#F97316" strokeWidth="1.75" strokeLinecap="round" />
    <path d="M22 20c0-3-1.8-5-5-5" stroke="#F97316" strokeWidth="1.75" strokeLinecap="round" />
    <path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const BellIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// ─── Industry Icons ───────────────────────────────────────────────────────────

const ShoppingBagIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M10 14V10a6 6 0 0 1 12 0v4" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
    <rect x="4" y="13" width="24" height="15" rx="2" stroke="#F97316" strokeWidth="2" />
  </svg>
);

const UtensilsIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M10 6v6a4 4 0 0 0 4 4v10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
    <path d="M22 6v20" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
    <path d="M18 6c0 3.314 1.343 6 4 7" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
    <path d="M10 6v3M12 6v3M14 6v3" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const TruckIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <rect x="2" y="10" width="20" height="13" rx="2" stroke="#F97316" strokeWidth="2" />
    <path d="M22 15h5l3 5v3h-8V15z" stroke="#F97316" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="8" cy="24" r="2.5" stroke="#F97316" strokeWidth="2" />
    <circle cx="24" cy="24" r="2.5" stroke="#F97316" strokeWidth="2" />
  </svg>
);

const EventIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <rect x="4" y="6" width="24" height="22" rx="2" stroke="#F97316" strokeWidth="2" />
    <path d="M22 4v4M10 4v4M4 14h24" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
    <path d="M10 20h2v2h-2zM15 20h2v2h-2zM20 20h2v2h-2z" fill="#F97316" />
  </svg>
);



// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  // Hero headline staggered animation
  const [h0, setH0] = useState(false);
  const [h1, setH1] = useState(false);
  const [h2, setH2] = useState(false);
  const [h3, setH3] = useState(false);

  useEffect(() => {
    const t0 = setTimeout(() => setH0(true), 80);
    const t1 = setTimeout(() => setH1(true), 260);
    const t2 = setTimeout(() => setH2(true), 440);
    const t3 = setTimeout(() => setH3(true), 600);
    return () => [t0, t1, t2, t3].forEach(clearTimeout);
  }, []);

  const heroAnim = (visible: boolean, delay = 0): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
  });

  return (
    <>
      {/* ========== HERO SECTION ========== */}
      <section id="hero" className="page-section" style={{ background: '#FFFBF5', padding: '80px 0 100px' }}>
        <div
          className="hero-flex section-inner"
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '56px',
          }}
        >
          {/* Left content */}
          <div className="hero-left" style={{ flex: '1', minWidth: 0 }}>
            {/* Badge */}
            <div style={heroAnim(h0)}>
              <span
                style={{
                  display: 'inline-block',
                  background: '#FEF3C7',
                  color: '#92400E',
                  padding: '5px 14px',
                  borderRadius: '100px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  marginBottom: '28px',
                }}
              >
                Built for SMEs
              </span>
            </div>

            {/* Headline line 1 */}
            <div style={{ overflow: 'hidden' }}>
              <h1
                className="hero-heading"
                style={{
                  ...heroAnim(h1),
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 600,
                  fontSize: '3.5rem',
                  lineHeight: 1.12,
                  color: '#1C1917',
                  marginBottom: '4px',
                }}
              >
                Hire. Schedule. Track.
              </h1>
            </div>

            {/* Headline line 2 */}
            <div style={{ overflow: 'hidden', marginBottom: '22px' }}>
              <h1
                className="hero-heading"
                style={{
                  ...heroAnim(h2),
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 600,
                  fontSize: '3.5rem',
                  lineHeight: 1.12,
                  color: '#F97316',
                }}
              >
                All in One Place.
              </h1>
            </div>

            {/* Subheadline */}
            <p
              style={{
                ...heroAnim(h3),
                fontFamily: 'var(--font-body)',
                fontSize: '1.125rem',
                color: '#78716C',
                lineHeight: 1.75,
                maxWidth: '500px',
              }}
            >
              Tasking is the all-in-one casual workforce management platform
              that helps SMEs hire, schedule, and track their teams — without
              the complexity.
            </p>
          </div>

          {/* Right side – dashboard mockup placeholder */}
          <div
            className="hero-mockup"
            style={{
              flex: '1.1',
              minWidth: 0,
              background: '#F0E8D8',
              borderRadius: '20px',
              height: '440px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed #D6C9B0',
            }}
          >
            {/* TODO: Add dashboard mockup image here */}
            <p style={{ color: '#A8977E', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
              Dashboard Mockup
            </p>
          </div>
        </div>
      </section>

      {/* ========== HOW IT WORKS SECTION ========== */}
      <section id="how-it-works" className="page-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div
          className="section-inner"
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 24px',
            textAlign: 'center',
          }}
        >
          <AnimatedSection>
            <h2 style={heading2}>See Tasking in Action</h2>
            <p style={sectionSubtitle}>
              Watch how Tasking simplifies your entire casual workforce workflow
              in minutes.
            </p>
          </AnimatedSection>

          {/* Video player — file must be placed at /public/demo.mp4 */}
          <AnimatedSection delay={150}>
            <div
              style={{
                maxWidth: '840px',
                margin: '44px auto 0',
                borderRadius: '14px',
                overflow: 'hidden',
                boxShadow: '0 4px 40px rgba(0,0,0,0.1)',
                background: '#1C1917',
              }}
            >
              <video
                width="100%"
                controls
                autoPlay
                muted
                loop
                playsInline
                style={{ display: 'block' }}
              >
                <source src="/demo.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ========== UNIQUE SELLING POINT (USP) SECTION ========== */}
      <section id="why-tasking" className="page-section" style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div
          className="section-inner"
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 24px',
          }}
        >
          <AnimatedSection style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={heading2}>Why SMEs Choose Tasking</h2>
          </AnimatedSection>

          {/* 2×2 USP grid */}
          <div
            className="grid-usp"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '24px',
            }}
          >
            {[
              {
                Icon: UserIcon,
                title: 'Simple Enough for Anyone',
                desc: 'Designed for SME owners who need results without a learning curve. No technical knowledge needed — just set up and go. Replace your spreadsheets, messaging apps, and manual logs with one integrated platform.',
              },
              {
                Icon: BuildingIcon,
                title: 'Full Control, Department by Department',
                desc: 'Managers handle their own recruitment and scheduling while owners keep full visibility across all departments. The right level of control for everyone in your company.',
              },
              {
                Icon: SparkleIcon,
                title: 'Enterprise AI — Free for Everyone',
                desc: 'AI-powered job description generation, candidate recommendations, and anomaly detection are included in the free plan. No paywalls. Professional-grade automation from day one.',
              },
              {
                Icon: ClockIcon,
                title: 'Built for Casual Workforce Realities',
                desc: 'Photo-based clock-in verification, digital attendance records, and automated workflows are built specifically for businesses that rely on flexible, casual workers.',
              },
            ].map(({ Icon, title, desc }, i) => (
              <AnimatedSection key={title} delay={i * 80}>
                <div
                  className="card-lift"
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '16px',
                    padding: '36px',
                    border: '1px solid #F0E8D8',
                    height: '100%',
                  }}
                >
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      background: '#FEF3C7',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '20px',
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
                      marginBottom: '12px',
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
                    {desc}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ========== PRODUCTS PREVIEW SECTION ========== */}
      <section id="products" className="page-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div
          className="section-inner"
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 24px',
          }}
        >
          <AnimatedSection style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={heading2}>Everything You Need, In One Platform</h2>
            <p style={sectionSubtitle}>
              Tasking covers every aspect of casual workforce management across
              5 core modules.
            </p>
          </AnimatedSection>

          {/* 5 module cards */}
          <div
            className="grid-products"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '16px',
              marginBottom: '48px',
              alignItems: 'stretch',
            }}
          >
            {[
              { Icon: RecruitmentIcon, title: 'Recruitment', desc: 'Post jobs, shortlist candidates, and send invitations — powered by AI.', href: '/products/recruitment' },
              { Icon: AttendanceIcon, title: 'Attendance', desc: 'Photo-verified clock-in, AI auto-approval, and anomaly detection.', href: '/products/attendance' },
              { Icon: AIIcon, title: 'AI Features', desc: 'Intelligent automation built into every step of your workflow.', href: '/products/ai-features' },
              { Icon: TeamIcon, title: 'Team Management', desc: 'Manage roles, departments, and permissions with ease.', href: '/products/team-management' },
              { Icon: BellIcon, title: 'Smart Notifications', desc: 'Automated alerts that keep your team informed and on time.', href: '/products/smart-notifications' },
            ].map(({ Icon, title, desc, href }, i) => (
              <AnimatedSection key={href} delay={i * 70} style={{ height: '100%' }}>
                <Link
                  href={href}
                  className="card-lift"
                  style={{
                    background: '#FFFBF5',
                    borderRadius: '14px',
                    padding: '28px 22px',
                    border: '1px solid #F0E8D8',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                  }}
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      background: '#FEF3C7',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '16px',
                    }}
                  >
                    <Icon />
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1rem', color: '#1C1917', marginBottom: '8px' }}>
                    {title}
                  </h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#78716C', lineHeight: 1.65 }}>
                    {desc}
                  </p>
                </Link>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection style={{ textAlign: 'center' }}>
            <Link href="/products" className="btn-press" style={btnPrimary}>
              Explore All Features
            </Link>
          </AnimatedSection>
        </div>
      </section>

      {/* ========== INDUSTRIES PREVIEW SECTION ========== */}
      <section id="industries" className="page-section" style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div className="section-inner" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          <AnimatedSection style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={heading2}>Built for the Industries That Run on Casual Workers</h2>
            <p style={sectionSubtitle}>
              From retail floors to event venues, Tasking adapts to the way
              your industry works.
            </p>
          </AnimatedSection>

          {/* 4 industry cards */}
          <div
            className="grid-industries"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '20px',
              marginBottom: '48px',
            }}
          >
            {[
              { Icon: ShoppingBagIcon, name: 'Retail', href: '/industries/retail' },
              { Icon: UtensilsIcon, name: 'Food & Beverage', href: '/industries/fnb' },
              { Icon: TruckIcon, name: 'Logistics', href: '/industries/logistics' },
              { Icon: EventIcon, name: 'Event Management', href: '/industries/event-management' },
            ].map(({ Icon, name, href }, i) => (
              <AnimatedSection key={href} delay={i * 80}>
                <Link
                  href={href}
                  className="card-lift"
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '16px',
                    padding: '36px 24px',
                    border: '1px solid #F0E8D8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  <div
                    style={{
                      width: '60px',
                      height: '60px',
                      background: '#FEF3C7',
                      borderRadius: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon />
                  </div>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.0625rem', color: '#1C1917' }}>
                    {name}
                  </span>
                </Link>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection style={{ textAlign: 'center' }}>
            <Link href="/industries" className="btn-press" style={btnOutline}>
              Explore All Industries
            </Link>
          </AnimatedSection>
        </div>
      </section>

      {/* ========== FINAL CTA BANNER SECTION ========== */}
      <section id="get-started" className="page-section" style={{ background: '#F97316', padding: '80px 24px' }}>
        <AnimatedSection>
          <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: '2.5rem',
                color: '#FFFFFF',
                marginBottom: '16px',
                lineHeight: 1.2,
              }}
            >
              Ready to simplify your workforce?
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
              Join SMEs already using Tasking to hire smarter, schedule faster,
              and track with confidence.
            </p>

            <Link
              href="/get-started"
              className="btn-press"
              style={{
                display: 'inline-block',
                background: '#FFFFFF',
                color: '#F97316',
                padding: '14px 32px',
                borderRadius: '10px',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: '1rem',
              }}
            >
              Get Started Free
            </Link>

            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
                color: 'rgba(255,255,255,0.65)',
                marginTop: '14px',
              }}
            >
            </p>
          </div>
        </AnimatedSection>
      </section>

      {/* ── Scroll to top ── */}
      <ScrollToTop />
    </>
  );
}
