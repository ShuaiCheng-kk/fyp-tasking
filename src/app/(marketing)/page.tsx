'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { CalendarDays, CheckSquare, UserPlus, ClipboardList, LayoutGrid, Unlock, Route, Building2 } from 'lucide-react';
import AiScheduleDemo from '@/components/home/AiScheduleDemo';
import RecurringShiftDemo from '@/components/home/RecurringShiftDemo';
import SplitShiftDemo from '@/components/home/SplitShiftDemo';
import AiTaskAssignDemo from '@/components/home/AiTaskAssignDemo';
import SubtasksDemo from '@/components/home/SubtasksDemo';
import WorkloadRebalanceDemo from '@/components/home/WorkloadRebalanceDemo';
import AiJobDescriptionDemo from '@/components/home/AiJobDescriptionDemo';
import AiCandidateRecommendationsDemo from '@/components/home/AiCandidateRecommendationsDemo';
import JobPublishingDemo from '@/components/home/JobPublishingDemo';
import AiDayOffDemo from '@/components/home/AiDayOffDemo';
import ShiftSwapDemo from '@/components/home/ShiftSwapDemo';
import ClockInOutDemo from '@/components/home/ClockInOutDemo';
import ReviewsSection from '@/components/home/ReviewsSection';

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

// ─── Sticky scroll-narrative section (Pitch-style: left text stack, right pinned preview) ─────

interface StickyScrollItem {
  Icon: React.FC;
  title: string;
  desc: string;
  image?: string;
}

function StickyScrollSection({ items }: { items: StickyScrollItem[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handler = () => {
      const triggerY = window.innerHeight * 0.5;
      let closestIdx = 0;
      let closestDist = Infinity;
      refs.current.forEach((el, i) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const dist = Math.abs(center - triggerY);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      });
      setActive(closestIdx);
    };
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
    };
  }, []);

  const ActiveIcon = items[active].Icon;

  return (
    <div style={{ display: 'flex', gap: '48px', alignItems: 'flex-start' }} className="sticky-scroll-row">
      {/* Left — stacked text, one tall block per item so scrolling through them takes a beat */}
      <div style={{ flex: '0 1 420px', minWidth: 0 }}>
        {items.map(({ Icon, title, desc }, i) => (
          <div
            key={title}
            ref={(el) => { refs.current[i] = el; }}
            className="sticky-scroll-item"
            style={{
              minHeight: '52vh',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              paddingBottom: '40px',
              opacity: active === i ? 1 : 0.35,
              transition: 'opacity 0.35s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                <Icon />
              </span>
              <h3
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 600,
                  fontSize: '1.5rem',
                  color: '#F97316',
                  margin: 0,
                  whiteSpace: 'pre-line',
                }}
              >
                {title}
              </h3>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
                color: '#1C1917',
                lineHeight: 1.7,
                maxWidth: '460px',
              }}
            >
              {desc}
            </p>
          </div>
        ))}
      </div>

      {/* Right — pinned preview, swaps content to match whichever left item is active */}
      <div style={{ flex: 1, minWidth: 0, position: 'sticky', top: '270px' }} className="sticky-scroll-preview">
        {items[active].image ? (
          <div
            key={active}
            style={{
              borderRadius: '20px',
              background: '#1C1917',
              padding: '20px',
            }}
          >
            <img
              src={items[active].image}
              alt={items[active].title}
              style={{ display: 'block', width: '100%', height: 'auto', borderRadius: '10px' }}
            />
          </div>
        ) : (
          <div
            style={{
              borderRadius: '20px',
              border: '1px dashed #D6D3D1',
              background: '#FBF9F4',
              height: '440px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
            }}
          >
            <div
              key={active}
              style={{
                width: '120px',
                height: '120px',
                background: '#FEF3C7',
                borderRadius: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ display: 'inline-flex', transform: 'scale(1.8)' }}>
                <ActiveIcon />
              </span>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#A8A29E',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                textAlign: 'center',
                maxWidth: '280px',
              }}
            >
              Image placeholder — {items[active].title}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tabbed accordion section (tabs = modules, accordion = that module's key features) ────

interface AccordionFeature {
  title: string;
  desc: string;
  demo?: React.ReactNode;
}

interface TabbedAccordionModule {
  Icon: React.FC;
  label: string;
  href: string;
  features: AccordionFeature[];
}

function TabbedAccordionSection({ modules }: { modules: TabbedAccordionModule[] }) {
  const [activeTab, setActiveTab] = useState(0);
  const [openIndex, setOpenIndex] = useState(0);
  const activeModule = modules[activeTab];
  const ActiveIcon = activeModule.Icon;
  const activeFeature = activeModule.features[openIndex] ?? activeModule.features[0];

  const selectTab = (i: number) => {
    setActiveTab(i);
    setOpenIndex(0);
  };

  const renderTabButton = (mod: TabbedAccordionModule, i: number) => {
    const { Icon, label } = mod;
    return (
      <button
        key={label}
        onClick={() => selectTab(i)}
        className="btn-press"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          borderRadius: '100px',
          border: 'none',
          cursor: 'pointer',
          background: activeTab === i ? '#FFFFFF' : 'transparent',
          boxShadow: activeTab === i ? '0 2px 10px rgba(0,0,0,0.08)' : 'none',
          color: activeTab === i ? '#1C1917' : '#78716C',
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          fontSize: '1.0625rem',
          transition: 'background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <Icon />
        </span>
        {label}
      </button>
    );
  };

  // Only split into two rows once there are enough modules that a single row would wrap awkwardly.
  const topRow = modules.length > 4 ? modules.slice(0, 3) : modules;
  const bottomRow = modules.length > 4 ? modules.slice(3) : [];

  return (
    <>
      {/* Tab pills — one per module, laid out 3 on top / rest below once there are more than 4 */}
      <AnimatedSection style={{ display: 'flex', justifyContent: 'center', marginBottom: '48px' }}>
        <div
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            background: '#F5F0E8',
            borderRadius: '28px',
            padding: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
            {topRow.map((mod, i) => renderTabButton(mod, i))}
          </div>
          {bottomRow.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
              {bottomRow.map((mod, i) => renderTabButton(mod, i + topRow.length))}
            </div>
          )}
        </div>
      </AnimatedSection>

      {/* Accordion (left) — the active module's 2–3 standout features — + pinned preview (right) */}
      <div className="products-accordion-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center' }}>
        <div>
          {activeModule.features.map(({ title, desc }, i) => {
            const open = openIndex === i;
            return (
              <div key={title} style={{ borderBottom: '1px solid #F0E8D8' }}>
                <button
                  onClick={() => setOpenIndex(i)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    padding: '18px 0',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.25rem', color: '#1C1917' }}>
                    {title}
                  </span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    fill="none"
                    style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }}
                  >
                    <path d="M4.5 7l4.5 4.5L13.5 7" stroke="#78716C" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div style={{ maxHeight: open ? '160px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingBottom: '22px' }}>
                    {desc}
                  </p>
                </div>
              </div>
            );
          })}

          <div style={{ paddingTop: '22px' }}>
            <Link href={activeModule.href} style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 600, color: '#F97316' }}>
              Learn more about {activeModule.label} →
            </Link>
          </div>
        </div>

        <div className="products-accordion-preview">
          {activeFeature.demo ? (
            <div style={{ height: '440px' }}>{activeFeature.demo}</div>
          ) : (
            <div
              style={{
                borderRadius: '20px',
                border: '1px dashed #D6D3D1',
                background: '#FBF9F4',
                height: '440px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
              }}
            >
              <div
                key={activeTab}
                style={{
                  width: '100px',
                  height: '100px',
                  background: '#FEF3C7',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ display: 'inline-flex', transform: 'scale(1.6)' }}>
                  <ActiveIcon />
                </span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#A8A29E',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  textAlign: 'center',
                  maxWidth: '280px',
                }}
              >
                Image placeholder — {activeFeature.title}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Industries carousel (horizontal slide, dot navigation) ───────────────────

interface IndustryCarouselItem {
  Icon: React.FC;
  name: string;
  desc: string;
}

function IndustryCarousel({ items }: { items: IndustryCarouselItem[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const posRef = useRef(0);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One clone of the first card appended at the end — scrolling onto it looks identical to
  // being back at item 0, so the loop can snap back there instantly with no visible jump.
  const displayItems = [...items, items[0]];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = itemRefs.current.findIndex((el) => el === entry.target);
            if (idx !== -1) setActive(idx % items.length);
          }
        });
      },
      { root: track, threshold: 0.6 },
    );
    itemRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [items.length]);

  const scrollToIndex = (i: number, instant = false) => {
    const track = trackRef.current;
    const item = itemRefs.current[i];
    if (!track || !item) return;
    // Scroll the track's own scrollLeft directly (not scrollIntoView) so this never drags
    // the page's vertical scroll position along with it when the section is off-screen.
    const target = item.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
    track.scrollTo({ left: target, behavior: instant ? 'auto' : 'smooth' });
  };

  const goTo = (i: number) => {
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    posRef.current = i;
    scrollToIndex(i);
  };

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      const next = posRef.current + 1;
      scrollToIndex(next);
      if (next === items.length) {
        // reached the clone of item 0 — once the scroll settles, snap back invisibly and keep going right
        resetTimeoutRef.current = setTimeout(() => {
          posRef.current = 0;
          scrollToIndex(0, true);
        }, 550);
      } else {
        posRef.current = next;
      }
    }, 3000);
    return () => {
      clearInterval(timer);
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, [paused, items.length]);

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div
        ref={trackRef}
        className="industry-carousel-track"
        style={{
          display: 'flex',
          gap: '48px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          paddingBottom: '8px',
          marginBottom: '32px',
        }}
      >
        {displayItems.map(({ Icon, name, desc }, i) => (
          <Link
            key={`${name}-${i}`}
            href="/industries"
            ref={(el) => { itemRefs.current[i] = el; }}
            className="industry-slide-item industry-carousel-item"
            style={{
              scrollSnapAlign: 'start',
              flex: '0 0 calc(25% - 36px)',
              minWidth: '220px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '16px',
              textDecoration: 'none',
            }}
          >
            <div
              className="industry-slide-icon"
              style={{
                width: '64px',
                height: '64px',
                background: '#FEF3C7',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s ease',
              }}
            >
              <Icon />
            </div>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.0625rem', color: '#1C1917' }}>
              {name}
            </span>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.6, margin: 0 }}>
              {desc}
            </p>
            <svg className="industry-slide-arrow" width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ transition: 'transform 0.2s ease' }}>
              <path d="M3 9h12M11 4.5L15.5 9 11 13.5" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
        {items.map((item, i) => (
          <button
            key={item.name}
            type="button"
            aria-label={`Go to ${item.name}`}
            onClick={() => goTo(i)}
            style={{
              width: active === i ? '24px' : '8px',
              height: '8px',
              borderRadius: '4px',
              background: active === i ? '#F97316' : '#E7DFCE',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── USP Icons ────────────────────────────────────────────────────────────────

const UserIcon = () => <LayoutGrid color="#F97316" size={28} strokeWidth={2} />;
const BuildingIcon = () => <Unlock color="#F97316" size={28} strokeWidth={2} />;
const SparkleIcon = () => <Route color="#F97316" size={28} strokeWidth={2} />;
const ClockIcon = () => <Building2 color="#F97316" size={28} strokeWidth={2} />;

// ─── Module Icons — same lucide-react icons the app sidebar uses for these pages
//     (see the `items` array in OwnerSidebar.tsx), so the marketing site and the
//     product itself point at the same visual language for each module. ─────────

const RecruitmentIcon = () => <UserPlus color="#F97316" size={20} strokeWidth={2} />;
const AttendanceIcon = () => <ClipboardList color="#F97316" size={20} strokeWidth={2} />;
const ShiftIcon = () => <CalendarDays color="#F97316" size={20} strokeWidth={2} />;
const TaskListIcon = () => <CheckSquare color="#F97316" size={20} strokeWidth={2} />;

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

const HospitalityIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M4 24c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
    <path d="M4 24h20" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
    <path d="M14 14V8" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
    <circle cx="14" cy="6" r="2" stroke="#F97316" strokeWidth="2" />
  </svg>
);

const CleaningIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M13 4l11 11a4 4 0 0 1 0 5.66l-.34.34a4 4 0 0 1-5.66 0L7 10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 12l-5 5a3 3 0 0 0 0 4.24l1.76 1.76A3 3 0 0 0 10 23l5-5" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 28h24" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
  </svg>
);



// ─── Page ─────────────────────────────────────────────────────────────────────

import { useMarketingCopy } from './useMarketingCopy';

export default function HomePage() {
  const copy = useMarketingCopy('home');
  const demoVideoUrl = copy('video.demo', '/demo.mp4');

  // Hero headline staggered animation
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
    const t1 = setTimeout(() => setH1(true), 80);
    const t2 = setTimeout(() => setH2(true), 260);
    const t3 = setTimeout(() => setH3(true), 440);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, []);

  const heroAnim = (visible: boolean, delay = 0): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
  });

  return (
    <>
      {/* ========== HERO SECTION ========== */}
      {copy.visible('hero') && <section
        id="hero"
        className="page-section"
        style={{
          background: '#1C1917',
          minHeight: 'calc(100vh - 68px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          padding: '140px 0 260px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Curved fade into the next section, shaped to match the reference (flat-ish center, dropping at the edges) */}
        <svg
          viewBox="0 0 1440 260"
          preserveAspectRatio="none"
          style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '260px', pointerEvents: 'none' }}
        >
          <defs>
            <filter id="heroCurveBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="18" />
            </filter>
          </defs>
          {/* The path runs well past the left/right viewBox edges: a Gaussian blur samples outward,
              so a path that stops exactly at x=0 / x=1440 fades to translucent there and lets the
              dark background bleed through at the corners. The overhang gives it material to sample. */}
          <path
            d="M-300,170 L0,170 C 260,110 480,60 720,60 C 960,60 1180,110 1440,170 L1740,170 L1740,340 L-300,340 Z"
            fill="#FFFBF5"
            filter="url(#heroCurveBlur)"
          />
        </svg>
        {/* Solid strip guarantees a true seamless join at the very bottom edge, since the blurred
            SVG path above can leave a faint translucent seam right where it gets clipped */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '40px', background: '#FFFBF5', pointerEvents: 'none' }} />

        {/* Scroll hint — points to the next section, sits in the cream area under the curve */}
        <button
          onClick={() => {
            // Land just below the fixed navbar (68px) instead of using scrollIntoView(), which
            // would tuck the heading right under it.
            const heading = document.querySelector('#products h2');
            if (!heading) return;
            const targetY = window.scrollY + heading.getBoundingClientRect().top - 68;
            window.scrollTo({ top: targetY, behavior: 'smooth' });
          }}
          aria-label="Scroll to next section"
          className="hero-scroll-hint"
          style={{
            position: 'absolute',
            bottom: '115px',
            left: '50%',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: '#F97316',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 18px rgba(249,115,22,0.45)',
            zIndex: 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 3v10M3 8l5 5 5-5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div
          className="section-inner"
          style={{
            maxWidth: '1000px',
            margin: '0 auto',
            padding: '0 24px',
            textAlign: 'center',
          }}
        >
          {/* Headline line 1 */}
          <div style={{ overflow: 'hidden' }}>
            <h1
              className="hero-heading"
              style={{
                ...heroAnim(h1),
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: '5rem',
                lineHeight: 1.08,
                color: '#FFFFFF',
                marginBottom: '4px',
              }}
            >
              {copy('hero.headline.line1', 'Hire. Schedule. Allocate.')}
            </h1>
          </div>

          {/* Headline line 2 */}
          <div style={{ overflow: 'hidden' }}>
            <h1
              className="hero-heading"
              style={{
                ...heroAnim(h2),
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: '5rem',
                lineHeight: 1.08,
                color: '#F97316',
              }}
            >
              {copy('hero.headline.line2', 'All in One Place.')}
            </h1>
          </div>
        </div>

        {/* Hero video — file must be placed at /public/demo.mp4 (30s marketing video) */}
        <AnimatedSection delay={250} style={{ maxWidth: '900px', margin: '36px auto 0', padding: '0 24px', width: '100%' }}>
          <div
            style={{
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 0 60px rgba(249,115,22,0.25), 0 24px 60px rgba(0,0,0,0.45)',
              border: '1px solid rgba(255,255,255,0.15)',
              background: '#111',
            }}
          >
            <video
              width="100%"
              height={440}
              autoPlay
              muted
              loop
              playsInline
              style={{ display: 'block', width: '100%', height: '440px', objectFit: 'cover' }}
            >
              <source src={demoVideoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </AnimatedSection>

        {/* Subheadline */}
        <div style={{ maxWidth: '720px', margin: '44px auto 0', padding: '0 24px', textAlign: 'center' }}>
          <p
            style={{
              ...heroAnim(h3),
              fontFamily: 'var(--font-body)',
              fontSize: '1.125rem',
              color: 'rgba(255,255,255,0.65)',
              lineHeight: 1.75,
              margin: 0,
            }}
          >
            {copy('hero.subheadline', 'Tasking is the all-in-one workforce management platform that helps SMEs hire, schedule, and manage their teams without the complexity.')}
          </p>
        </div>
      </section>}

      {/* ========== PRODUCTS PREVIEW SECTION ========== */}
      {copy.visible('products') && <section id="products" className="page-section" style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div
          className="section-inner"
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 24px',
          }}
        >
          <AnimatedSection style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ ...heading2, fontSize: '2.75rem', maxWidth: '760px', margin: '0 auto' }}>
              {copy('products.title', 'Everything You Need, In One Platform')}
            </h2>
          </AnimatedSection>

          <TabbedAccordionSection
            modules={[
              {
                Icon: ShiftIcon,
                label: 'Shift Management',
                href: '/products/shift-management',
                features: [
                  { title: copy('products.module.shift.feature1.title', 'AI Schedule Suggestions'), desc: copy('products.module.shift.feature1.desc', 'Build smarter schedules with AI based on your workforce needs.'), demo: <AiScheduleDemo /> },
                  { title: copy('products.module.shift.feature2.title', 'Recurring Shifts'), desc: copy('products.module.shift.feature2.desc', 'Set shifts to repeat automatically and save time.'), demo: <RecurringShiftDemo /> },
                  { title: copy('products.module.shift.feature3.title', 'Split Shifts'), desc: copy('products.module.shift.feature3.desc', 'Create flexible split shifts for different working periods.'), demo: <SplitShiftDemo /> },
                ],
              },
              {
                Icon: TaskListIcon,
                label: 'Task Management',
                href: '/products/task-management',
                features: [
                  { title: copy('products.module.task.feature1.title', 'AI Task Assignment'), desc: copy('products.module.task.feature1.desc', 'Get AI suggestions for assigning tasks to the right people.'), demo: <AiTaskAssignDemo /> },
                  { title: copy('products.module.task.feature2.title', 'Subtasks'), desc: copy('products.module.task.feature2.desc', 'Break complex work into smaller, manageable tasks.'), demo: <SubtasksDemo /> },
                  { title: copy('products.module.task.feature3.title', 'Workload Rebalancing'), desc: copy('products.module.task.feature3.desc', 'Redistribute tasks when workloads become uneven.'), demo: <WorkloadRebalanceDemo /> },
                ],
              },
              {
                Icon: RecruitmentIcon,
                label: 'Recruitment',
                href: '/products/recruitment',
                features: [
                  { title: copy('products.module.recruitment.feature1.title', 'AI Job Description'), desc: copy('products.module.recruitment.feature1.desc', 'Create clear job postings faster with AI.'), demo: <AiJobDescriptionDemo /> },
                  { title: copy('products.module.recruitment.feature2.title', 'AI Candidate Recommendations'), desc: copy('products.module.recruitment.feature2.desc', 'Find the most suitable candidates with AI-powered suggestions.'), demo: <AiCandidateRecommendationsDemo /> },
                  { title: copy('products.module.recruitment.feature3.title', 'Job Publishing'), desc: copy('products.module.recruitment.feature3.desc', 'Publish job openings and start hiring with ease.'), demo: <JobPublishingDemo /> },
                ],
              },
              {
                Icon: AttendanceIcon,
                label: 'Attendance',
                href: '/products/attendance',
                features: [
                  { title: copy('products.module.attendance.feature1.title', 'AI Day-Off Suggestions'), desc: copy('products.module.attendance.feature1.desc', 'Get smarter suggestions for managing employee days off.'), demo: <AiDayOffDemo /> },
                  { title: copy('products.module.attendance.feature2.title', 'Shift Swap & Day-Off Requests'), desc: copy('products.module.attendance.feature2.desc', 'Handle schedule changes and requests in one place.'), demo: <ShiftSwapDemo /> },
                  { title: copy('products.module.attendance.feature3.title', 'Clock In & Clock Out'), desc: copy('products.module.attendance.feature3.desc', 'Track the full attendance cycle from start to finish.'), demo: <ClockInOutDemo /> },
                ],
              },
            ]}
          />
        </div>
      </section>}

      {/* ========== UNIQUE SELLING POINT (USP) SECTION ========== */}
      {copy.visible('why') && <section id="why-tasking" className="page-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div
          className="section-inner"
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 24px',
          }}
        >
          <div
            style={{
              position: 'sticky',
              top: '68px',
              background: '#FFFFFF',
              zIndex: 2,
              paddingTop: '48px',
              paddingBottom: '24px',
            }}
          >
            <AnimatedSection style={{ textAlign: 'center' }}>
              <h2 style={heading2}>{copy('why.title', 'Why SMEs Choose Tasking')}</h2>
            </AnimatedSection>
          </div>

          <StickyScrollSection
            items={[
              {
                Icon: UserIcon,
                title: copy('why.card.simple.title', 'One Platform for Everything'),
                desc: copy('why.card.simple.desc', 'Tasking brings workforce management into one connected platform. Manage your everyday operations in one place instead of switching between multiple tools.'),
                image: copy('why.card.simple.image', '/USP1.png'),
              },
              {
                Icon: BuildingIcon,
                title: copy('why.card.control.title', 'Free to Run Your Business,\nNot Just to Try It'),
                desc: copy('why.card.control.desc', 'The Free Plan supports complete day to day workflows without essential features locked behind a paywall. Paid features simply give you more automation, efficiency, and convenience.'),
                image: copy('why.card.control.image', '/USP2.png'),
              },
              {
                Icon: SparkleIcon,
                title: copy('why.card.ai.title', 'From Hiring to the Last Shift'),
                desc: copy('why.card.ai.desc', 'Tasking manages the complete casual worker journey, from recruitment to the end of their engagement. Every stage stays connected in one continuous workflow.'),
                image: copy('why.card.ai.image', '/USP3.png'),
              },
              {
                Icon: ClockIcon,
                title: copy('why.card.casual.title', 'Built Around How SMEs Work'),
                desc: copy('why.card.casual.desc', 'Tasking is designed around the practical needs of SMEs, without unnecessary enterprise complexity. Simple workflows make it easy to manage operations without a dedicated HR or operations team.'),
                image: copy('why.card.casual.image', '/USP4.png'),
              },
            ]}
          />
        </div>
      </section>}

      {/* ========== INDUSTRIES PREVIEW SECTION ========== */}
      {copy.visible('industries') && <section id="industries" className="page-section" style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div className="section-inner" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          <AnimatedSection style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={heading2}>{copy('industries.title', 'Built for the Industries That Run on Casual Workers')}</h2>
          </AnimatedSection>

          <IndustryCarousel
            items={[
              { Icon: ShoppingBagIcon, name: copy('industries.card.retail', 'Retail'), desc: copy('industries.card.retail.desc', 'Manage flexible staff across busy stores and changing shifts.') },
              { Icon: UtensilsIcon, name: copy('industries.card.food', 'Food & Beverage'), desc: copy('industries.card.food.desc', 'Coordinate casual teams across shifts, peak hours, and daily operations.') },
              { Icon: EventIcon, name: copy('industries.card.events', 'Events'), desc: copy('industries.card.events.desc', 'Organise temporary teams for events with changing staffing needs.') },
              { Icon: TruckIcon, name: copy('industries.card.logistics', 'Logistics'), desc: copy('industries.card.logistics.desc', 'Manage flexible workers across schedules, tasks, and operational demands.') },
              { Icon: HospitalityIcon, name: copy('industries.card.hospitality', 'Hospitality'), desc: copy('industries.card.hospitality.desc', 'Keep staff scheduling, attendance, and daily workforce operations organised.') },
              { Icon: CleaningIcon, name: copy('industries.card.cleaning', 'Cleaning & Facilities'), desc: copy('industries.card.cleaning.desc', 'Coordinate distributed teams across locations, shifts, and recurring tasks.') },
            ]}
          />
        </div>
      </section>}

      {/* ========== REVIEWS SECTION ========== */}
      <ReviewsSection />

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
              {copy('cta.headline', 'Ready to Simplify Your Workforce?')}
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
              {copy('cta.subheadline', 'Get started with a complete workforce management platform, free from day one.')}
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
    </>
  );
}
