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

import { useMarketingCopy } from './useMarketingCopy';

export default function HomePage() {
  const copy = useMarketingCopy('home');
  const dashboardImageUrl = copy('hero.dashboard_image', '');
  const demoVideoUrl = copy('video.demo', '/demo.mp4');
  const videoTitle = copy('video.title', 'See Tasking in Action');
  const videoSubtitle = copy('video.subtitle', 'Watch how Tasking simplifies your entire casual workforce workflow in minutes.');

  // Hero headline staggered animation
  const [h0, setH0] = useState(false);
  const [h1, setH1] = useState(false);
  const [h2, setH2] = useState(false);
  const [h3, setH3] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token=') && hash.includes('type=signup')) {
      window.location.replace('/email-verified');
      return;
    }
    if (hash.includes('error=') && hash.includes('error_description=')) {
      window.location.replace('/email-verified?error=1');
      return;
    }
  }, []);

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
      {copy.visible('hero') && <section id="hero" className="page-section" style={{ background: '#1C1C1E', padding: '80px 0 120px' }}>
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
                  background: 'rgba(249,115,22,0.18)',
                  color: '#FB923C',
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
                  color: '#FFFFFF',
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
                color: 'rgba(255,255,255,0.65)',
                lineHeight: 1.75,
                maxWidth: '500px',
              }}
            >
              Tasking is the all-in-one casual workforce management platform
              that helps SMEs hire, schedule, and track their teams — without
              the complexity.
            </p>
          </div>

          {/* Right side – dashboard image or built-in mockup */}
          <div
            className="hero-mockup"
            style={{
              flex: '1.1',
              minWidth: 0,
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 0 80px rgba(249,115,22,0.22), 0 32px 80px rgba(0,0,0,0.55)',
              border: '1px solid #333',
              background: '#111',
              padding: dashboardImageUrl ? 0 : 3,
            }}
          >
          {dashboardImageUrl ? (
            <img
              src={dashboardImageUrl}
              alt="Dashboard preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 14 }}
            />
          ) : (<>
            {/* Inner rounded container */}
            <div style={{ background: '#1A1A1A', borderRadius: 14, overflow: 'hidden' }}>

              {/* Browser chrome */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#1A1A1A', borderBottom: '1px solid #2A2A2A' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28CA41' }} />
                <div style={{ flex: 1, background: '#2C2C2C', borderRadius: 5, padding: '3px 10px', textAlign: 'center', color: '#555', fontSize: 9 }}>tasking.app/dashboard</div>
              </div>

              {/* Dashboard body */}
              <div style={{ display: 'flex', height: 400 }}>

                {/* Sidebar */}
                <div style={{ width: 40, background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 14, borderRight: '1px solid #222', flexShrink: 0 }}>
                  <div style={{ width: 22, height: 22, background: '#F97316', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="white"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="white"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="white"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="white"/></svg>
                  </div>
                  {[
                    <svg key="cal" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
                    <svg key="task" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
                    <svg key="chart" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
                    <svg key="users" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
                    <svg key="msg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
                    <svg key="rec" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
                    <svg key="brief" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
                  ].map((icon, i) => <div key={i}>{icon}</div>)}
                </div>

                {/* Main */}
                <div style={{ flex: 1, background: '#F7F6F2', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                  {/* Top bar */}
                  <div style={{ background: '#fff', padding: '10px 14px', borderBottom: '1px solid #EEECE6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div>
                      <div style={{ fontSize: 7, color: '#F97316', fontWeight: 700, letterSpacing: '0.8px', marginBottom: 2 }}>SATURDAY, JUNE 13, 2026</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#111' }}>Today&apos;s Overview for Sunrise Café</div>
                      <div style={{ fontSize: 7, color: '#22C55E', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#22C55E' }} />
                        Updated just now
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <div style={{ fontSize: 8, color: '#333', background: '#F0EEE8', borderRadius: 20, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 3, border: '1px solid #E0DDD6' }}>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5"><path d="M2 20h20M5 20V10l7-7 7 7v10"/></svg>
                        Sarah Wong
                      </div>
                      <div style={{ fontSize: 8, color: '#fff', background: '#22C55E', borderRadius: 20, padding: '3px 8px', fontWeight: 600 }}>✓ Pro Plan</div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 4, padding: '7px 10px', background: '#fff', borderBottom: '1px solid #EEECE6', flexShrink: 0 }}>
                    {[
                      { label: 'STAFF ON SHIFT', val: '8', valCol: '#111' },
                      { label: 'CASUAL WORKERS', val: '5', valCol: '#111' },
                      { label: 'TOTAL TASKS', val: '12', valCol: '#111' },
                      { label: 'IN PROGRESS', val: '4', valCol: '#A855F7' },
                      { label: 'IN REVIEW', val: '2', valCol: '#F59E0B' },
                      { label: 'COMPLETE', val: '6', valCol: '#22C55E' },
                    ].map(s => (
                      <div key={s.label} style={{ background: '#F9F8F4', borderRadius: 7, padding: '7px 8px', border: '1px solid #E8E6DE' }}>
                        <div style={{ fontSize: 6, color: '#999', marginBottom: 4, fontWeight: 600, letterSpacing: '0.3px' }}>{s.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: s.valCol, lineHeight: 1 }}>{s.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Schedule */}
                  <div style={{ padding: '7px 10px', background: '#fff', borderBottom: '1px solid #EEECE6', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#111' }}>Schedule</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <div style={{ fontSize: 7, color: '#fff', background: '#F97316', borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>Today</div>
                        <div style={{ fontSize: 7, color: '#888', background: '#F0EEE8', borderRadius: 4, padding: '2px 6px', border: '1px solid #E0DDD6' }}>06/13/2026</div>
                      </div>
                    </div>
                    <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #E0DDD6' }}>
                      {/* Hour axis */}
                      <div style={{ background: '#111', display: 'flex', alignItems: 'center', padding: '4px 8px' }}>
                        <div style={{ width: 88, flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                          {['7am','9am','11am','1pm','3pm','5pm','7pm'].map(h => (
                            <span key={h} style={{ fontSize: 6, color: '#555' }}>{h}</span>
                          ))}
                        </div>
                      </div>
                      {[
                        { name: 'Sarah Manager', icon: 'manager', left: '20%', width: '48%', color: '#F97316', label: '9am – 5pm' },
                        { name: 'James Employee', icon: 'employee', left: '20%', width: '48%', color: '#F97316', label: '9am – 5pm' },
                        { name: 'Mia (CW)', icon: 'casual', left: '26%', width: '28%', color: '#A855F7', label: '10am – 2pm' },
                      ].map((row, i) => (
                        <div key={row.name} style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderBottom: i < 2 ? '1px solid #F0EEE8' : 'none', background: '#fff' }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={row.icon === 'manager' ? '#F97316' : '#888'} strokeWidth="2.5" style={{ marginRight: 3, flexShrink: 0 }}><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0116 0"/></svg>
                          <div style={{ width: 80, fontSize: 7, fontWeight: 600, color: '#111', flexShrink: 0 }}>{row.name}</div>
                          <div style={{ flex: 1, position: 'relative', height: 13, background: '#F7F6F2', borderRadius: 4 }}>
                            <div style={{ position: 'absolute', left: row.left, width: row.width, height: 13, background: row.color, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 6, color: '#fff', fontWeight: 700 }}>{row.label}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Dept tags */}
                    <div style={{ display: 'flex', gap: 3, marginTop: 5, alignItems: 'center' }}>
                      <span style={{ fontSize: 6, color: '#999', fontWeight: 600, letterSpacing: '0.3px', lineHeight: '16px' }}>DEPTS</span>
                      {[
                        { label: '● Front of House 3', bg: '#FFF0E5', color: '#C2410C', border: '#FED7AA' },
                        { label: '● Kitchen 3', bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
                        { label: '● Delivery 2', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
                      ].map(d => (
                        <span key={d.label} style={{ fontSize: 6, background: d.bg, color: d.color, borderRadius: 4, padding: '1px 6px', border: `1px solid ${d.border}`, fontWeight: 600 }}>{d.label}</span>
                      ))}
                    </div>
                  </div>

                  {/* Bottom 4 panels */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, padding: '7px 10px', flex: 1, minHeight: 0 }}>

                    {/* Focus */}
                    <div style={{ background: '#fff', borderRadius: 7, border: '1px solid #E8E6DE', padding: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 6 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/></svg>
                        <span style={{ fontSize: 8, fontWeight: 700, color: '#111' }}>Focus</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 5 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #F0EEE8', borderTopColor: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#111', lineHeight: 1 }}>12</div>
                          <div style={{ fontSize: 5, color: '#999', marginTop: 1 }}>tasks</div>
                        </div>
                      </div>
                      {[['Assigned','#999','4'],['In Progress','#A855F7','4'],['Review','#F97316','2'],['Complete','#22C55E','6']].map(([l,c,v]) => (
                        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 6, color: c as string }}>● {l}</span>
                          <span style={{ fontSize: 6, fontWeight: 700, color: '#111' }}>{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Team */}
                    <div style={{ background: '#fff', borderRadius: 7, border: '1px solid #E8E6DE', padding: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                        <span style={{ fontSize: 8, fontWeight: 700, color: '#111' }}>Team</span>
                      </div>
                      <div style={{ fontSize: 6, fontWeight: 700, color: '#F97316', marginBottom: 4, paddingBottom: 3, borderBottom: '1px solid #F0EEE8', letterSpacing: '0.3px' }}>● FRONT OF HOUSE</div>
                      {[['Sarah M.','#F97316'],['James E.','#888'],['Mia C.','#888']].map(([name, col]) => (
                        <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={col as string} strokeWidth="2.5"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0116 0"/></svg>
                            <span style={{ fontSize: 7, color: '#111', fontWeight: 500 }}>{name}</span>
                          </div>
                          <div style={{ width: 10, height: 10, borderRadius: 2, border: '1px solid #DDD' }} />
                        </div>
                      ))}
                    </div>

                    {/* Live Feed */}
                    <div style={{ background: '#fff', borderRadius: 7, border: '1px solid #E8E6DE', padding: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                          <span style={{ fontSize: 8, fontWeight: 700, color: '#111' }}>Live Feed</span>
                        </div>
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
                      </div>
                      {[
                        { msg: 'Mia clocked in', sub: '10:02 AM · Front of House', bg: '#F0FDF4', border: '#22C55E', col: '#15803D' },
                        { msg: 'Task updated', sub: '9:45 AM · James E.', bg: '#FFF7ED', border: '#F97316', col: '#C2410C' },
                        { msg: 'New applicant', sub: '9:30 AM · Weekend Barista', bg: '#EFF6FF', border: '#3B82F6', col: '#1D4ED8' },
                      ].map(f => (
                        <div key={f.msg} style={{ background: f.bg, borderRadius: 5, padding: '4px 5px', borderLeft: `2px solid ${f.border}`, marginBottom: 3 }}>
                          <div style={{ fontSize: 6, color: f.col, fontWeight: 700 }}>{f.msg}</div>
                          <div style={{ fontSize: 5, color: '#999', marginTop: 1 }}>{f.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Tasks */}
                    <div style={{ background: '#fff', borderRadius: 7, border: '1px solid #E8E6DE', padding: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                        <span style={{ fontSize: 8, fontWeight: 700, color: '#111' }}>Tasks</span>
                      </div>
                      {[
                        { title: 'Open Cash Register', who: 'James E. · 9:00 AM', badge: 'High', badgeBg: '#FEF3C7', badgeCol: '#92400E', bg: '#FFF7ED', border: '#FED7AA' },
                        { title: 'Prep Station Setup', who: 'Mia C. · 10:00 AM', badge: 'Done', badgeBg: '#DCFCE7', badgeCol: '#166534', bg: '#F0FDF4', border: '#BBF7D0' },
                        { title: 'Stock Check', who: 'Sarah M. · 2:00 PM', badge: 'Assigned', badgeBg: '#F1F5F9', badgeCol: '#475569', bg: '#F9F8F4', border: '#E8E6DE' },
                      ].map(t => (
                        <div key={t.title} style={{ background: t.bg, borderRadius: 5, padding: '4px 6px', border: `1px solid ${t.border}`, marginBottom: 3 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 6, fontWeight: 700, color: '#111' }}>{t.title}</span>
                            <span style={{ fontSize: 5, background: t.badgeBg, color: t.badgeCol, borderRadius: 3, padding: '1px 4px', fontWeight: 700 }}>{t.badge}</span>
                          </div>
                          <div style={{ fontSize: 5, color: '#999', marginTop: 1 }}>{t.who}</div>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </>)}
          </div>
        </div>
      </section>}

      {/* ========== HOW IT WORKS SECTION ========== */}
      {copy.visible('how-it-works') && <section id="how-it-works" className="page-section" style={{ background: '#F97316', padding: '80px 0' }}>
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
            <h2 style={{ ...heading2, color: '#FFFFFF' }}>{videoTitle}</h2>
            <p style={{ ...sectionSubtitle, color: 'rgba(255,255,255,0.8)' }}>
              {videoSubtitle}
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
                <source src={demoVideoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </AnimatedSection>
        </div>
      </section>}

      {/* ========== UNIQUE SELLING POINT (USP) SECTION ========== */}
      {copy.visible('why') && <section id="why-tasking" className="page-section" style={{ background: '#FFFBF5', padding: '80px 0' }}>
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
      </section>}

      {/* ========== PRODUCTS PREVIEW SECTION ========== */}
      {copy.visible('products') && <section id="products" className="page-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div
          className="section-inner"
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 24px',
          }}
        >
          <AnimatedSection style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={heading2}>{copy('products.title', 'Everything You Need, In One Platform')}</h2>
            <p style={sectionSubtitle}>
              {copy('products.subtitle', 'Tasking covers every aspect of casual workforce management across 5 core modules.')}
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
              { Icon: RecruitmentIcon, title: 'Recruitment', desc: copy('products.card.recruitment.desc', 'Post jobs, shortlist candidates, and send invitations — powered by AI.'), href: '/products/recruitment' },
              { Icon: AttendanceIcon, title: 'Attendance', desc: copy('products.card.attendance.desc', 'Photo-verified clock-in, AI auto-approval, and anomaly detection.'), href: '/products/attendance' },
              { Icon: AIIcon, title: 'AI Features', desc: copy('products.card.ai.desc', 'Intelligent automation built into every step of your workflow.'), href: '/products/ai-features' },
              { Icon: TeamIcon, title: 'Team Management', desc: copy('products.card.team.desc', 'Manage roles, departments, and permissions with ease.'), href: '/products/team-management' },
              { Icon: BellIcon, title: 'Smart Notifications', desc: copy('products.card.notifications.desc', 'Automated alerts that keep your team informed and on time.'), href: '/products/smart-notifications' },
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
      </section>}

      {/* ========== INDUSTRIES PREVIEW SECTION ========== */}
      {copy.visible('industries') && <section id="industries" className="page-section" style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div className="section-inner" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          <AnimatedSection style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={heading2}>{copy('industries.title', 'Built for the Industries That Run on Casual Workers')}</h2>
            <p style={sectionSubtitle}>
              {copy('industries.subtitle', 'From retail floors to event venues, Tasking adapts to the way your industry works.')}
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
              { Icon: ShoppingBagIcon, name: copy('industries.card.retail', 'Retail') },
              { Icon: UtensilsIcon, name: copy('industries.card.food', 'Food & Beverage') },
              { Icon: TruckIcon, name: copy('industries.card.logistics', 'Logistics') },
              { Icon: EventIcon, name: copy('industries.card.events', 'Event Management') },
            ].map(({ Icon, name }, i) => (
              <AnimatedSection key={name} delay={i * 80}>
                <div
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
                </div>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection style={{ textAlign: 'center' }}>
            <Link href="/industries" className="btn-press" style={btnOutline}>
              Explore All Industries
            </Link>
          </AnimatedSection>
        </div>
      </section>}

      {/* ========== FINAL CTA BANNER SECTION ========== */}
      {copy.visible('cta') && <section id="get-started" className="page-section" style={{ background: '#F97316', padding: '80px 24px' }}>
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
              href={copy('cta.button.url', '/get-started')}
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
              {copy('cta.button.label', 'Get Started Free')}
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
      </section>}

      {/* ── Scroll to top ── */}
      <ScrollToTop />
    </>
  );
}
