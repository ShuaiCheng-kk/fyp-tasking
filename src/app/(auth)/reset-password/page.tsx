'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabaseBrowser';

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
      <span style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.25rem', color: '#1C1917' }}>Tasking</span>
    </div>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [success, setSuccess] = useState(false);
  const [recoveryUserId, setRecoveryUserId] = useState('');
  // A used/expired reset link doesn't fire PASSWORD_RECOVERY at all — Supabase instead redirects
  // here with an error in the URL hash (#error=access_denied&error_code=otp_expired&...), which the
  // page previously never looked at, so it sat on "Verifying reset link…" forever with no
  // indication anything was wrong (BUG-070).
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
    const params = new URLSearchParams(hash);
    const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    // PKCE puts the failure in the query string, the implicit flow puts it in the hash.
    const errorDescription = params.get('error_description') ?? search.get('error_description');
    if (errorDescription) {
      setLinkError(errorDescription.replace(/\+/g, ' '));
      return;
    }
    const pkceCode = search.get('code');
    let settled = false;
    const accept = (userId: string) => {
      if (settled) return;
      settled = true;
      setRecoveryUserId(userId);
      setSessionReady(true);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session?.user) accept(session.user.id);
    });

    // The Supabase client consumes the recovery token from the URL during its own initialisation,
    // which routinely finishes before this effect subscribes. PASSWORD_RECOVERY then fires with no
    // listener attached, and since the client also strips the hash there is nothing left to parse —
    // the page sat on "Verifying reset link…" forever. Read the session it already established.
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) { accept(session.user.id); return; }

      // supabaseBrowser uses @supabase/ssr's createBrowserClient, which defaults to the PKCE flow —
      // so the recovery link arrives as ?code=… and is NOT a session until it is exchanged. Nothing
      // here ever did that exchange, so PASSWORD_RECOVERY never fired, getSession stayed null, and
      // the page could only ever end up on the timeout branch. That was the real cause behind both
      // "Verifying reset link…" forever and the bogus "link has expired".
      if (!pkceCode || settled) return;
      const { data, error } = await supabase.auth.exchangeCodeForSession(pkceCode);
      if (error) { setLinkError(error.message); return; }
      if (data.session?.user) accept(data.session.user.id);
    })();

    // Neither path yielded a session and Supabase surfaced no error_description, so something is
    // wrong — but do NOT call the link expired, because a slow network reaching this branch means
    // a perfectly good link. Wait long enough that a slow verification isn't mistaken for a dead
    // one, then describe what actually happened.
    const timer = setTimeout(() => {
      if (!settled) setLinkError('Could not verify this reset link in time. Check your connection and open the link again, or request a new one.');
    }, 20000);

    return () => { settled = true; clearTimeout(timer); subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!recoveryUserId) {
      setError('This reset link is invalid or has expired. Request a new one from the sign-in page.');
      return;
    }
    setIsLoading(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: recoveryUserId, password }),
    });
    const data = await res.json();
    if (!data.success) {
      setError(data.message || 'Failed to reset password');
      setIsLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => router.push('/signin'), 2000);
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

  const eyeButtonStyle: React.CSSProperties = {
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
          <h1 style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.75rem', color: '#1C1917', marginBottom: '8px' }}>
            Set a new password
          </h1>
          <p style={{ fontFamily: fB, fontSize: '0.9375rem', color: '#78716C' }}>
            Enter your new password below.
          </p>
        </div>

        {linkError ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              padding: '16px',
              fontFamily: fB,
              fontSize: '0.9375rem',
              color: '#DC2626',
              lineHeight: 1.5,
              marginBottom: '20px',
            }}>
              {/* Show the actual reason. This used to be a hardcoded "invalid or has expired"
                  regardless of what linkError held, so a slow verification and a genuinely dead
                  link were indistinguishable — and a working link that merely took a while to
                  verify was reported to the user as expired. */}
              {linkError}
            </div>
            <a href="/forgot-password" style={{ fontFamily: fB, fontWeight: 600, fontSize: '0.9375rem', color: '#F97316', textDecoration: 'none' }}>
              Request a new reset link
            </a>
          </div>
        ) : !sessionReady ? (
          <div style={{ textAlign: 'center', fontFamily: fB, fontSize: '0.9375rem', color: '#78716C', padding: '20px 0' }}>
            Verifying reset link…
          </div>
        ) : success ? (
          <div style={{
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: '10px',
            padding: '16px',
            fontFamily: fB,
            fontSize: '0.9375rem',
            color: '#15803D',
            textAlign: 'center',
            lineHeight: 1.5,
          }}>
            Password updated successfully. Redirecting to sign in…
          </div>
        ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={labelStyle}>New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={{ ...inputStyle, paddingRight: '48px' }}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} style={eyeButtonStyle}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={{ ...inputStyle, paddingRight: '48px' }}
              />
              <button type="button" onClick={() => setShowConfirm((v) => !v)} style={eyeButtonStyle}>
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
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
              {error}
            </div>
          )}

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
            {isLoading ? <><Spinner /> Updating…</> : 'Update Password'}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
