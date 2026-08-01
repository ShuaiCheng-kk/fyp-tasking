'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { getOwnerLandingHref } from '@/components/OwnerSidebar';
import { page as c } from './content';

const fH = 'var(--font-heading)';
const fB = 'var(--font-body)';

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 18 18" style={{ display: 'inline-block' }}>
      <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

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

const ROLE_ROUTES: Record<string, string> = {
  'Owner': '/owner/dashboard',
  'Partner': '/partner/dashboard',
  'Manager': '/manager/dashboard',
  'Employee': '/employee/dashboard',
  'Casual Worker': '/casual/dashboard',
  'Guest User': '/guest/applications',
  'Marketing Admin': '/admin/dashboard',
  'User Admin': '/useradmin/dashboard',
};

function clearTaskingAuthStorage() {
  localStorage.removeItem('tasking_user_id');
  localStorage.removeItem('tasking_user_role');
  localStorage.removeItem('tasking_company_id');
  localStorage.removeItem('tasking_active_session');
}

function SignInContent() {
  const searchParams = useSearchParams();
  const isRemoved = searchParams.get('removed') === 'true';
  const isConfirmed = searchParams.get('confirmed') === 'true';
  const isJoined = searchParams.get('joined') === 'true';
  // Present when the visitor came here from a job's Apply button.
  const jobIdParam = searchParams.get('job_id');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('Invalid email or password');
  // true = "don't know yet, show nothing" — only ever set false inside the effect below, once we
  // know for sure there's no active session to redirect away from (same pattern as Navbar.tsx's
  // authLoading). Without this, an already-logged-in visitor briefly saw the sign-in form (and the
  // navbar still showed Dashboard/Logout) instead of bouncing straight to their own dashboard.
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const redirectIfSignedIn = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session?.user) { if (!cancelled) setCheckingSession(false); return; }
      try {
        const res = await fetch('/api/user/me?user_id=' + session.user.id);
        const data = await res.json();
        const role: string = data.success ? (data.user?.role ?? '') : '';
        if (role) {
          const route = role === 'Owner' ? getOwnerLandingHref() : role === 'Partner' ? getOwnerLandingHref('partner') : (ROLE_ROUTES[role] || '/owner/dashboard');
          window.location.href = route;
          return;
        }
      } catch { /* fall through to showing the sign-in form */ }
      if (!cancelled) setCheckingSession(false);
    };
    void redirectIfSignedIn();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowError(false);
    setIsLoading(true);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const normalizedEmail = email.trim();

    try {
      // Sign in client-side so session lives in localStorage and is immediately
      // visible to all subsequent client-side getSession() calls on navigation.
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (authError || !authData.user) {
        const msg = authError?.message?.toLowerCase() ?? '';
        if (msg.includes('email not confirmed')) throw new Error('email not confirmed');
        throw new Error('invalid');
      }

      // Fetch role and company_id from our DB
      const res = await fetch('/api/user/me?user_id=' + authData.user.id);
      const data = await res.json();
      if (!data.success) throw new Error('invalid');

      const role: string = data.user?.role ?? '';
      const authUid = authData.user.id;
      localStorage.setItem('tasking_user_id', authUid);
      // Clears the Guest Applications "offer confirmed" banner (src/app/guest/applications/page.tsx,
      // CONFIRMED_BANNER_KEY) — it's only meant to carry through to THIS next sign-in, not beyond it.
      localStorage.removeItem('tasking_confirmed_banner');
      localStorage.removeItem('tasking_company_id');
      if (data.user?.company_id) {
        localStorage.setItem('tasking_company_id_' + authUid, data.user.company_id);
      }
      localStorage.setItem('tasking_user_role', role);

      // Came from the job board's Apply button: send them back to that posting so the apply modal
      // reopens in place. This only applies to a Guest User — an applicant with no home page yet,
      // who'd otherwise be stranded after signing in. A Casual Worker already has a workspace, and
      // their role is what decides where they land: signing in always drops them on their own
      // dashboard, never back into the applicant flow. They can re-open the job board themselves
      // to apply again.
      const jobId = searchParams.get('job_id') || localStorage.getItem('apply_job_id');
      if (jobId && role === 'Guest User') {
        window.location.href = `/job-board?job_id=${jobId}`;
        return;
      }
      // Anyone else: drop the stashed intent so a stale one can never hijack a later sign-in
      // (it outlives logout otherwise, and would bounce them to the board instead of their app).
      localStorage.removeItem('apply_job_id');

      const route = role === 'Owner' ? getOwnerLandingHref() : role === 'Partner' ? getOwnerLandingHref('partner') : (ROLE_ROUTES[role] || '/owner/dashboard');
      window.location.href = route;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('email not confirmed')) {
        setErrorMessage('Please confirm your email address before signing in. Check your inbox for the confirmation link.');
      } else {
        clearTaskingAuthStorage();
        setErrorMessage('Invalid email or password');
      }
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

  if (checkingSession) return <div style={{ flex: 1, background: '#FFFBF5' }} />;

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFBF5', padding: '40px 24px' }}>
      <div className="auth-card gs-card-enter" style={{ background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '20px', padding: '48px 44px', width: '100%', maxWidth: '440px', boxShadow: '0 4px 32px rgba(0,0,0,0.06)' }}>

        <TaskingLogo />

        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h1 style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.75rem', color: '#1C1917', marginBottom: '8px' }}>
            {c.headline}
          </h1>
          <p style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#78716C' }}>
            {c.subheadline}
          </p>
        </div>

        {isJoined && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px 16px', fontFamily: fB, fontSize: '0.875rem', color: '#15803D', lineHeight: 1.5, marginBottom: '20px' }}>
            Your account is ready. Please sign in to continue.
          </div>
        )}

        {isConfirmed && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px 16px', fontFamily: fB, fontSize: '0.875rem', color: '#15803D', lineHeight: 1.5, marginBottom: '20px' }}>
            Email confirmed! You can now sign in.
          </div>
        )}

        {isRemoved && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '12px 16px', fontFamily: fB, fontSize: '0.875rem', color: '#DC2626', lineHeight: 1.5, marginBottom: '20px' }}>
            Your account has been removed. Please contact your administrator or sign up with a new account.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label htmlFor="signin-email" style={labelStyle}>{c.emailLabel}</label>
            <input
              id="signin-email"
              type="email"
              placeholder={c.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="signin-password" style={labelStyle}>{c.passwordLabel}</label>
            <div style={{ position: 'relative' }}>
              <input
                id="signin-password"
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
                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center', padding: 0 }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div style={{ textAlign: 'right', marginTop: '8px' }}>
              <Link href={c.forgotPasswordHref} style={{ fontFamily: fB, fontSize: '0.875rem', color: '#F97316', fontWeight: 500 }}>
                {c.forgotPassword}
              </Link>
            </div>
          </div>

          {showError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '12px 16px', fontFamily: fB, fontSize: '0.875rem', color: '#DC2626', lineHeight: 1.5 }}>
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn-press"
            style={{ width: '100%', background: '#F97316', color: '#FFFFFF', padding: '14px', borderRadius: '10px', fontFamily: fB, fontWeight: 700, fontSize: '0.9375rem', border: 'none', cursor: isLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isLoading ? 0.85 : 1, transition: 'opacity 0.15s' }}
          >
            {isLoading ? <><Spinner /> Signing in…</> : c.submitButton}
          </button>
        </form>

        <p style={{ marginTop: '24px', textAlign: 'center', fontFamily: fB, fontSize: '0.9375rem', color: '#78716C' }}>
          Don&apos;t have an account?{' '}
          {/* Arriving here from a job's Apply button means they're an applicant — send them
              straight to the guest registration form, since the generic Get Started page only
              offers Business Owner / Invitation Code. */}
          <Link
            href={jobIdParam ? `/get-started?role=guest&job_id=${jobIdParam}` : '/get-started'}
            style={{ color: '#F97316', fontWeight: 600 }}
          >
            Get Started →
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}
