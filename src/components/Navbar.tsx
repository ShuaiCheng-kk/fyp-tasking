'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';

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

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M3 5.5h16M3 11h16M3 16.5h16" stroke="#FFFBF5" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M5 5l12 12M17 5L5 17" stroke="#FFFBF5" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

// ─── Types ───────────────────────────────────────────────────────────────────

interface DropdownItem {
  label: string;
  href: string;
}

interface NavDropdownProps {
  label: string;
  href: string;
  items: DropdownItem[];
  isActive?: boolean;
}

// ─── Nav Sub-Components ───────────────────────────────────────────────────────

const NavDropdown = ({ label, href, items, isActive }: NavDropdownProps) => {
  const [open, setOpen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setOpen(true);
  };

  const handleLeave = () => {
    hideTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <Link
        href={href}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 12px',
          color: isActive ? '#F97316' : '#FFFBF5',
          fontSize: '0.875rem',
          fontFamily: 'var(--font-body)',
          borderRadius: '6px',
          fontWeight: isActive ? 600 : 400,
          transition: 'color 0.15s',
        }}
      >
        {label}
        <ChevronDown />
      </Link>
      {/* invisible bridge fills the gap between trigger and panel */}
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, height: '8px' }} />
      )}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: '0',
            minWidth: '210px',
            background: '#FFFFFF',
            borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            border: '1px solid #F0E8D8',
            padding: '6px 0',
            zIndex: 100,
          }}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:bg-[#FEF3C7]"
              style={{
                display: 'block',
                padding: '10px 16px',
                color: '#1C1917',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-body)',
                transition: 'background 0.15s',
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const NavLink = ({
  label,
  href,
  isActive,
}: {
  label: string;
  href: string;
  isActive?: boolean;
}) => (
  <Link
    href={href}
    style={{
      display: 'block',
      padding: '8px 12px',
      color: isActive ? '#F97316' : '#FFFBF5',
      fontSize: '0.875rem',
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

const MobileNavLink = ({ label, href, onClick }: { label: string; href: string; onClick: () => void }) => (
  <Link
    href={href}
    onClick={onClick}
    style={{
      display: 'block',
      padding: '12px 20px',
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

// ─── Navbar ──────────────────────────────────────────────────────────────────

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session)
      setAuthReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsLoggedIn(!!session)
        setAuthReady(true)
      }
    )

    return () => subscription.unsubscribe()
  }, []);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const close = () => setMobileOpen(false);

  return (
    <header
      style={{
        background: scrolled
          ? '#1C1917'
          : 'rgba(28,25,23,0.82)',
        backdropFilter: scrolled ? 'none' : 'blur(14px)',
        WebkitBackdropFilter: scrolled ? 'none' : 'blur(14px)',
        boxShadow: scrolled ? '0 2px 24px rgba(0,0,0,0.28)' : 'none',
        borderBottom: '1px solid rgba(255,251,245,0.06)',
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
              color: '#FFFBF5',
              fontSize: '1.125rem',
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
          <NavDropdown
            label="Products"
            href="/products"
            isActive={isActive('/products')}
            items={[
              { label: 'AI Features', href: '/products/ai-features' },
              { label: 'Recruitment', href: '/products/recruitment' },
              { label: 'Attendance', href: '/products/attendance' },
              { label: 'Team Management', href: '/products/team-management' },
              { label: 'Smart Notifications', href: '/products/smart-notifications' },
            ]}
          />
          <NavLink label="Industries" href="/industries" isActive={isActive('/industries')} />
          <NavLink label="Pricing" href="/pricing" isActive={isActive('/pricing')} />
          <NavDropdown
            label="About"
            href="/about"
            isActive={isActive('/about')}
            items={[
              { label: 'Mission', href: '/about/mission' },
              { label: 'Problem & Solution', href: '/about/problem-solution' },
              { label: 'Team', href: '/about/team' },
              { label: 'FAQ', href: '/about/faq' },
            ]}
          />
          <NavLink label="Job Board" href="/job-board" isActive={isActive('/job-board')} />
        </nav>

        {/* Right CTAs — hidden on mobile */}
        <div className="nav-cta" style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
          {!authReady ? null : isLoggedIn ? (
            <>
              <Link
                href="/owner/dashboard"
                className="btn-press"
                style={{
                  padding: '8px 18px',
                  color: '#FFFBF5',
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  border: '1px solid rgba(255,251,245,0.25)',
                  borderRadius: '8px',
                }}
              >
                Dashboard
              </Link>
              <button
                className="btn-press"
                onClick={async () => {
                  const supabase = createClient()
                  await supabase.auth.signOut()
                  localStorage.removeItem('tasking_user_id');
                  localStorage.removeItem('tasking_company_id');
                  localStorage.removeItem('tasking_active_session');
                  window.location.href = '/signout';
                }}
                style={{
                  padding: '8px 18px',
                  background: '#F97316',
                  color: '#FFFFFF',
                  fontSize: '0.875rem',
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
                  color: '#FFFBF5',
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  border: '1px solid rgba(255,251,245,0.25)',
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
                  fontSize: '0.875rem',
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
          {mobileOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* ── Mobile slide-down menu ── */}
      <div
        style={{
          background: '#FFFFFF',
          borderTop: '1px solid #F0E8D8',
          overflow: 'hidden',
          maxHeight: mobileOpen ? '600px' : '0',
          transition: 'max-height 0.35s ease',
        }}
      >
        <MobileNavLink label="Products" href="/products" onClick={close} />
        <MobileNavLink label="AI Features" href="/products/ai-features" onClick={close} />
        <MobileNavLink label="Recruitment" href="/products/recruitment" onClick={close} />
        <MobileNavLink label="Attendance" href="/products/attendance" onClick={close} />
        <MobileNavLink label="Team Management" href="/products/team-management" onClick={close} />
        <MobileNavLink label="Smart Notifications" href="/products/smart-notifications" onClick={close} />
        <MobileNavLink label="Industries" href="/industries" onClick={close} />
        <MobileNavLink label="Pricing" href="/pricing" onClick={close} />
        <MobileNavLink label="About" href="/about" onClick={close} />
        <MobileNavLink label="Job Board" href="/job-board" onClick={close} />
        <div style={{ padding: '16px 20px', display: 'flex', gap: '10px' }}>
          {!authReady ? null : isLoggedIn ? (
            <>
              <Link
                href="/owner/dashboard"
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
                Dashboard
              </Link>
              <button
                onClick={async () => {
                  const supabase = createClient()
                  await supabase.auth.signOut()
                  localStorage.removeItem('tasking_user_id');
                  localStorage.removeItem('tasking_company_id');
                  localStorage.removeItem('tasking_active_session');
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
