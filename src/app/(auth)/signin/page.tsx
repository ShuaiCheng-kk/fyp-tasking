'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { page as c } from './content';
import { createClient } from '@/lib/supabase';

// ─── Design tokens ────────────────────────────────────────────────────────────

const fH = 'var(--font-heading)';
const fB = 'var(--font-body)';

// ─── Small spinner ─────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      style={{ display: 'inline-block' }}
    >
      <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function TaskingLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '32px' }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#F97316" />
        <rect x="8" y="9" width="9" height="2.5" rx="1.25" fill="white" />
        <rect x="8" y="14.75" width="16" height="2.5" rx="1.25" fill="white" />
        <rect x="8" y="20.5" width="12" height="2.5" rx="1.25" fill="white" />
        <circle cx="22" cy="10.25" r="3.5" fill="#10B981" />
        <path d="M20.3 10.25L21.5 11.5L23.8 9" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.25rem', color: '#1C1917' }}>
        {c.logo}
      </span>
    </div>
  );
}

// ─── Role-based redirect map ───────────────────────────────────────────────────

const ROLE_ROUTES: Record<string, string> = {
  'Owner': '/owner/dashboard',
  'Manager': '/manager/dashboard',
  'Employee': '/employee/dashboard',
  'Casual Worker': '/casual/dashboard',
  'Guest User': '/job-board',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('Invalid email or password');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowError(false);
    setIsLoading(true);
    try {
      // Sign in via Supabase client so the browser session cookie is set
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw new Error(authError.message);

      // Fetch user profile (role, id) from API
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_address: email, password }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      localStorage.setItem('tasking_user_id', data.user.id);
      if (data.user.company_id) localStorage.setItem('tasking_company_id', data.user.company_id);
      localStorage.setItem('tasking_user_role', data.user.role);
      localStorage.setItem('tasking_active_session', 'true');
      sessionStorage.setItem('tasking_session_active', 'true');
      const route = ROLE_ROUTES[data.user.role] || '/owner/dashboard';
      window.location.href = route;
    } catch {
      setErrorMessage('Invalid email or password');
      setIsLoading(false);
      setShowError(true);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: fB,
    fontWeight: 600,
    fontSize: '0.875rem',
    color: '#374151',
    marginBottom: '8px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontFamily: fB,
    fontSize: '0.9375rem',
    color: '#1C1917',
    border: '1.5px solid #E5E7EB',
    borderRadius: '10px',
    padding: '12px 14px',
    background: '#FFFFFF',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FFFBF5',
      padding: '40px 24px',
    }}>
      <div className="auth-card" style={{
        background: '#FFFFFF',
        border: '1px solid #F0E8D8',
        borderRadius: '20px',
        padding: '48px 44px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.06)',
      }}>

        <TaskingLogo />

        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h1 style={{
            fontFamily: fH,
            fontWeight: 700,
            fontSize: '1.75rem',
            color: '#1C1917',
            marginBottom: '8px',
          }}>
            {c.headline}
          </h1>
          <p style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#78716C' }}>
            {c.subheadline}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Email field */}
          <div>
            <label style={labelStyle}>{c.emailLabel}</label>
            <input
              type="email"
              placeholder={c.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={inputStyle}
            />
          </div>

          {/* Password field */}
          <div>
            <label style={labelStyle}>{c.passwordLabel}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={c.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ ...inputStyle, paddingRight: '48px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9CA3AF',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0,
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div style={{ textAlign: 'right', marginTop: '8px' }}>
              <Link
                href={c.forgotPasswordHref}
                style={{ fontFamily: fB, fontSize: '0.875rem', color: '#F97316', fontWeight: 500 }}
              >
                {c.forgotPassword}
              </Link>
            </div>
          </div>

          {/* Error banner */}
          {showError && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              padding: '12px 16px',
              fontFamily: fB,
              fontSize: '0.875rem',
              color: '#DC2626',
              lineHeight: 1.5,
            }}>
              {errorMessage}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-press"
            style={{
              width: '100%',
              background: '#F97316',
              color: '#FFFFFF',
              padding: '14px',
              borderRadius: '10px',
              fontFamily: fB,
              fontWeight: 700,
              fontSize: '0.9375rem',
              border: 'none',
              cursor: isLoading ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: isLoading ? 0.85 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {isLoading ? <><Spinner /> Signing in…</> : c.submitButton}
          </button>
        </form>

        {/* Get started link */}
        <p style={{ marginTop: '24px', textAlign: 'center', fontFamily: fB, fontSize: '0.9375rem', color: '#78716C' }}>
          Don&apos;t have an account?{' '}
          <Link href="/get-started" style={{ color: '#F97316', fontWeight: 600 }}>
            Get Started →
          </Link>
        </p>
      </div>
    </div>
  );
}
