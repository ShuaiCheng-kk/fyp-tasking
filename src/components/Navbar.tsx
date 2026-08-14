'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { CalendarDays, CheckSquare, Building2, MessageCircle, UserPlus, ClipboardList, BarChart2, ArrowRight } from 'lucide-react';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Logo ────────────────────────────────────────────────────────────────────

const LogoSVG = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="8" fill="#F97316" />
    <rect x="8" y="9" width="9" height="2.5" rx="1.25" fill="white" />
    <rect x="8" y="14.75" width="16" height="2.5" rx="1.25" fill="white" />
    <rect x="8" y="20.5" width="12" height="2.5" rx="1.25" fill="white" />
    <circle cx="22" cy="10.25" r="3.5" fill="#10B981" />
    <path
      d="M20.3 10.25L21.5 11.5L23.8 9"
      stroke="white"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronDown = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ marginTop: '1px' }}>
    <path
      d="M2.5 4.5L6.5 8.5L10.5 4.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MenuIcon = ({ stroke = '#FFFBF5' }: { stroke?: string }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M3 5.5h16M3 11h16M3 16.5h16" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

const CloseIcon = ({ stroke = '#FFFBF5' }: { stroke?: string }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M5 5l12 12M17 5L5 17" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

// ─── Types ───────────────────────────────────────────────────────────────────

// ─── Products mega menu ────────────────────────────────────────────────────

interface ProductModule {
  key: string;
  label: string;
  desc: string;
  href: string;
  Icon: React.FC<{ size?: number; color?: string; strokeWidth?: number }>;
  features: string[];
}

const PRODUCT_MODULES: ProductModule[] = [
  {
    key: 'shift',
    label: 'Shift Management',
    desc: 'Manage schedules and workforce availability.',
    href: '/products/shift-management',
    Icon: CalendarDays,
    features: [
      'Shift assignment',
      'Schedule publishing',
      'Recurring shifts',
      'Split shifts',
      'Bulk shift editing',
      'AI schedule generation',
    ],
  },
  {
    key: 'task',
    label: 'Task Management',
    desc: 'Organise, assign, and track work.',
    href: '/products/task-management',
    Icon: CheckSquare,
    features: [
      'Task assignment',
      'Recurring tasks',
      'Sub-task checklists',
      'AI task matching',
      'Workload rebalancing',
      'Task dependencies',
    ],
  },
  {
    key: 'company',
    label: 'Company Management',
    desc: 'Manage people, departments, roles, and company structure.',
    href: '/products/team-management',
    Icon: Building2,
    features: [
      'Department management',
      'Department transfers',
      'CSV bulk invites',
      'Company profile',
    ],
  },
  {
    key: 'communication',
    label: 'Communication',
    desc: 'Keep teams connected and information in one place.',
    href: '/products/communication',
    Icon: MessageCircle,
    features: [
      'Announcements',
      'Edit announcements',
      'Delete announcements',
      'Direct messaging',
    ],
  },
  {
    key: 'recruitment',
    label: 'Recruitment',
    desc: 'Manage hiring from job posting to candidate selection.',
    href: '/products/recruitment',
    Icon: UserPlus,
    features: [
      'Job postings',
      'AI job descriptions',
      'AI candidate ranking',
      'Offer invitations',
      'Application deadlines',
      'Job templates',
    ],
  },
  {
    key: 'attendance',
    label: 'Attendance',
    desc: 'Track working hours, attendance, and workforce records.',
    href: '/products/attendance',
    Icon: ClipboardList,
    features: [
      'Clock in / clock out',
      'Break tracking',
      'Shift swap requests',
      'Day-off requests',
      'Clock time edits',
      'AI day-off triage',
    ],
  },
  {
    key: 'reports',
    label: 'Reports & Insights',
    desc: 'Turn workforce data into useful business insights.',
    href: '/products/reports-insights',
    Icon: BarChart2,
    features: [
      'Workforce analytics',
      'AI anomaly detection',
    ],
  },
];

const ProductsMegaMenu = ({ isActive, light }: { isActive?: boolean; light?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState(PRODUCT_MODULES[0].key);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const activeModule = PRODUCT_MODULES.find((m) => m.key === activeKey) ?? PRODUCT_MODULES[0];
  const close = () => setOpen(false);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 12px',
          color: isActive || open ? '#F97316' : light ? '#44403C' : '#FFFBF5',
          fontSize: '1rem',
          fontFamily: 'var(--font-body)',
          borderRadius: '6px',
          fontWeight: isActive || open ? 600 : 400,
          transition: 'color 0.15s',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Features
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'flex' }}>
          <ChevronDown />
        </span>
      </button>
      {open && (
        <div
          style={{
            position: 'fixed',
            top: '68px',
            left: 0,
            right: 0,
            background: '#FFFFFF',
            borderTop: '1px solid #F0E8D8',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
            zIndex: 100,
          }}
        >
          <div
            style={{
              maxWidth: '1280px',
              margin: '0 auto',
              padding: '0 24px',
              display: 'flex',
              alignItems: 'stretch',
            }}
          >
            {/* Left column — module list, aligned with the logo */}
            <div style={{ width: '270px', flexShrink: 0, padding: '18px 0', borderRight: '1px solid #F0E8D8' }}>
              {PRODUCT_MODULES.map((m) => {
                const rowActive = m.key === activeKey;
                return (
                  <Link
                    key={m.key}
                    href={m.href}
                    onClick={close}
                    onMouseEnter={() => setActiveKey(m.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '11px 16px 11px 4px',
                      background: rowActive ? '#FEF3C7' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <m.Icon size={20} color="#F97316" strokeWidth={2} />
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: '1.0625rem', color: '#1C1917' }}>
                        {m.label}
                      </span>
                    </div>
                    {rowActive && <ArrowRight size={16} color="#F97316" strokeWidth={2} />}
                  </Link>
                );
              })}
            </div>

            {/* Right column — active module's highlight card + feature grid */}
            <div style={{ flex: 1, minWidth: 0, padding: '22px 0 26px 32px' }}>
              <div style={{ border: '1px solid #F0E8D8', borderRadius: '10px', padding: '18px 20px', marginBottom: '20px' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1875rem', color: '#1C1917', marginBottom: '5px' }}>
                  {activeModule.label}
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: '#78716C', lineHeight: 1.55 }}>
                  {activeModule.desc}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '24px', rowGap: '6px' }}>
                {activeModule.features.map((f) => (
                  <div
                    key={f}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 6px' }}
                  >
                    <activeModule.Icon size={16} color="#D6D3D1" strokeWidth={2} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#44403C' }}>
                      {f}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NavLink = ({
  label,
  href,
  isActive,
  light,
}: {
  label: string;
  href: string;
  isActive?: boolean;
  light?: boolean;
}) => (
  <Link
    href={href}
    style={{
      display: 'block',
      padding: '8px 12px',
      color: isActive ? '#F97316' : light ? '#44403C' : '#FFFBF5',
      fontSize: '1rem',
      fontFamily: 'var(--font-body)',
      borderRadius: '6px',
      fontWeight: isActive ? 600 : 400,
      transition: 'color 0.15s',
    }}
  >
    {label}
  </Link>
);

// ─── Mobile menu link (dark text on white) ────────────────────────────────────

const MobileNavLink = ({ label, href, onClick, indented = false }: { label: string; href: string; onClick: () => void; indented?: boolean }) => (
  <Link
    href={href}
    onClick={onClick}
    style={{
      display: 'block',
      padding: indented ? '12px 20px 12px 34px' : '12px 20px',
      color: '#1C1917',
      fontSize: '0.9375rem',
      fontFamily: 'var(--font-body)',
      fontWeight: 500,
      borderBottom: '1px solid #F0E8D8',
    }}
  >
    {label}
  </Link>
);

// Non-navigating group heading for the mobile menu — the counterpart of a desktop mega-menu
// trigger, which opens a submenu rather than going anywhere itself.
const MobileNavGroupLabel = ({ label }: { label: string }) => (
  <div
    style={{
      padding: '14px 20px 8px',
      color: '#A8A29E',
      fontSize: '0.75rem',
      fontFamily: 'var(--font-body)',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}
  >
    {label}
  </div>
);

const DASHBOARD_ROUTE_BY_ROLE: Record<string, string> = {
  Owner: '/owner/dashboard',
  Partner: '/partner/dashboard',
  Manager: '/manager/dashboard',
  Employee: '/employee/dashboard',
  'Casual Worker': '/casual/dashboard',
  'Guest User': '/guest/applications',
  'Marketing Admin': '/admin/dashboard',
  'User Admin': '/useradmin/dashboard',
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

function clearTaskingAuthStorage() {
  localStorage.removeItem('tasking_user_id')
  localStorage.removeItem('tasking_user_role')
  localStorage.removeItem('tasking_company_id')
  localStorage.removeItem('tasking_active_session')
}

export default function Navbar({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  const light = theme === 'light';
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  // true = "don't know yet, show nothing". Only ever set to false inside
  // a useEffect, which never runs during SSR or the hydration pass.
  const [authLoading, setAuthLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const acceptSession = async (nextSession: Session | null) => {
      if (!nextSession) {
        clearTaskingAuthStorage()
        setSession(null)
        return
      }

      const res = await fetch(`/api/user/me?user_id=${nextSession.user.id}`)
      if (!res.ok) {
        clearTaskingAuthStorage()
        await supabase.auth.signOut()
        setSession(null)
        return
      }

      const data = await res.json()
      if (!data.success) {
        clearTaskingAuthStorage()
        await supabase.auth.signOut()
        setSession(null)
        return
      }

      localStorage.setItem('tasking_user_id', nextSession.user.id)
      if (data.user?.role) localStorage.setItem('tasking_user_role', data.user.role)
      setSession(nextSession)
    }

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error?.message?.toLowerCase().includes('refresh token')) {
        clearTaskingAuthStorage()
        await supabase.auth.signOut()
        setSession(null)
      } else {
        await acceptSession(session)
      }
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' && !session) {
        clearTaskingAuthStorage()
        await supabase.auth.signOut()
        setSession(null)
      } else {
        await acceptSession(session)
      }
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, []);

  const handleDashboardClick = () => {
    if (session) {
      const role = typeof window !== 'undefined' ? localStorage.getItem('tasking_user_role') : null;
      const dest = (role && DASHBOARD_ROUTE_BY_ROLE[role]) || '/owner/dashboard';
      router.push(dest);
    } else {
      router.push('/signin');
    }
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const close = () => setMobileOpen(false);

  return (
    <header
      style={{
        background: light
          ? (scrolled ? '#FFFBF5' : 'rgba(255,251,245,0.85)')
          : (scrolled ? '#1C1917' : 'rgba(28,25,23,0.82)'),
        backdropFilter: scrolled ? 'none' : 'blur(14px)',
        WebkitBackdropFilter: scrolled ? 'none' : 'blur(14px)',
        boxShadow: scrolled ? '0 2px 24px rgba(0,0,0,0.1)' : 'none',
        transition: 'background 0.35s ease, box-shadow 0.35s ease',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        width: '100%',
      }}
    >
      {/* ── Main bar ── */}
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 24px',
          height: '68px',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
        }}
      >
        {/* Logo */}
        <Link href="/" className="logo-hover">
          <LogoSVG />
          <span
            style={{
              color: light ? '#1C1917' : '#FFFBF5',
              fontSize: '1.3125rem',
              fontWeight: 600,
              fontFamily: 'var(--font-heading)',
              marginLeft: '10px',
            }}
          >
            Tasking
          </span>
        </Link>

        {/* Center nav — hidden on mobile */}
        <nav className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ProductsMegaMenu isActive={isActive('/products')} light={light} />
          <NavLink label="Industries" href="/industries" isActive={isActive('/industries')} light={light} />
          <NavLink label="Pricing" href="/pricing" isActive={isActive('/pricing')} light={light} />
          <NavLink label="Job Board" href="/job-board" isActive={isActive('/job-board')} light={light} />
        </nav>

        {/* Right CTAs — hidden on mobile */}
        <div className="nav-cta" style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
          {authLoading ? null : session ? (
            <>
              <button
                className="btn-press"
                onClick={handleDashboardClick}
                style={{
                  padding: '8px 18px',
                  color: light ? '#1C1917' : '#FFFBF5',
                  fontSize: '0.9375rem',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  border: light ? '1px solid rgba(28,25,23,0.2)' : '1px solid rgba(255,251,245,0.25)',
                  borderRadius: '8px',
                  background: 'none',
                  cursor: 'pointer',
                }}
              >
                Dashboard
              </button>
              <button
                className="btn-press"
                onClick={async () => {
                  await supabase.auth.signOut()
                  clearTaskingAuthStorage()
                  window.location.href = '/signout';
                }}
                style={{
                  padding: '8px 18px',
                  background: '#F97316',
                  color: '#FFFFFF',
                  fontSize: '0.9375rem',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/signin"
                className="btn-press"
                style={{
                  padding: '8px 18px',
                  color: light ? '#1C1917' : '#FFFBF5',
                  fontSize: '0.9375rem',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  border: light ? '1px solid rgba(28,25,23,0.2)' : '1px solid rgba(255,251,245,0.25)',
                  borderRadius: '8px',
                }}
              >
                Sign In
              </Link>
              <Link
                href="/get-started"
                className="btn-press cta-shimmer"
                style={{
                  padding: '8px 18px',
                  background: '#F97316',
                  color: '#FFFFFF',
                  fontSize: '0.9375rem',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  borderRadius: '8px',
                }}
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Hamburger — shown on mobile only */}
        <button
          className="nav-mobile-btn"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {mobileOpen
            ? <CloseIcon stroke={light ? '#1C1917' : '#FFFBF5'} />
            : <MenuIcon stroke={light ? '#1C1917' : '#FFFBF5'} />}
        </button>
      </div>

      {/* ── Mobile slide-down menu ── */}
      <div
        style={{
          background: '#FFFFFF',
          borderTop: '1px solid #F0E8D8',
          overflow: 'hidden',
          // Cap only exists to animate the collapse — it must clear the tallest the menu can get
          // (11 rows + the Features group label + the CTA row), or the last items get cut off.
          maxHeight: mobileOpen ? '760px' : '0',
          transition: 'max-height 0.35s ease',
        }}
      >
        {/* "Features" is a mega-menu trigger on desktop (ProductsMegaMenu), never a link — the
            module pages below ARE that menu. It used to point at /products here, which is an
            orphaned overview page no other surface links to. */}
        <MobileNavGroupLabel label="Features" />
        <MobileNavLink label="Shift Management" href="/products/shift-management" onClick={close} indented />
        <MobileNavLink label="Task Management" href="/products/task-management" onClick={close} indented />
        <MobileNavLink label="Company Management" href="/products/team-management" onClick={close} indented />
        <MobileNavLink label="Communication" href="/products/communication" onClick={close} indented />
        <MobileNavLink label="Recruitment" href="/products/recruitment" onClick={close} indented />
        <MobileNavLink label="Attendance" href="/products/attendance" onClick={close} indented />
        <MobileNavLink label="Reports & Insights" href="/products/reports-insights" onClick={close} indented />
        <MobileNavLink label="Industries" href="/industries" onClick={close} />
        <MobileNavLink label="Pricing" href="/pricing" onClick={close} />
        <MobileNavLink label="Job Board" href="/job-board" onClick={close} />
        <div style={{ padding: '16px 20px', display: 'flex', gap: '10px' }}>
          {authLoading ? null : session ? (
            <>
              <button
                onClick={() => { close(); handleDashboardClick(); }}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '11px 0',
                  color: '#1C1917',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: '0.9375rem',
                  border: '1px solid #F0E8D8',
                  borderRadius: '8px',
                  background: 'none',
                  cursor: 'pointer',
                }}
              >
                Dashboard
              </button>
              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  clearTaskingAuthStorage()
                  window.location.href = '/signout';
                }}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '11px 0',
                  background: '#F97316',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/signin"
                onClick={close}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '11px 0',
                  color: '#1C1917',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: '0.9375rem',
                  border: '1px solid #F0E8D8',
                  borderRadius: '8px',
                }}
              >
                Sign In
              </Link>
              <Link
                href="/get-started"
                onClick={close}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '11px 0',
                  background: '#F97316',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  borderRadius: '8px',
                }}
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
