'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

const dropdownMenuStyle: React.CSSProperties = {
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
};

const NavDropdown = ({ label, href, items, isActive }: NavDropdownProps) => (
  <div className="group" style={{ position: 'relative' }}>
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
    <div className="hidden group-hover:block" style={dropdownMenuStyle}>
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
  </div>
);

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

// ─── Navbar ──────────────────────────────────────────────────────────────────

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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

        {/* Center nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
          <NavDropdown
            label="Industries"
            href="/industries"
            isActive={isActive('/industries')}
            items={[
              { label: 'Retail', href: '/industries/retail' },
              { label: 'F&B', href: '/industries/fnb' },
              { label: 'Logistics', href: '/industries/logistics' },
              { label: 'Event Management', href: '/industries/event-management' },
            ]}
          />
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

        {/* Right CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
        </div>

      </div>
    </header>
  );
}
