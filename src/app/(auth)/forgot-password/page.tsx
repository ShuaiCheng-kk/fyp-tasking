'use client';

import { useState } from 'react';
import Link from 'next/link';

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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Something went wrong');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
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
          <h1 style={{ fontFamily: fH, fontWeight: 700, fontSize: '1.75rem', color: '#1C1917', marginBottom: '8px' }}>
            Reset your password
          </h1>
        </div>

        {success ? (
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
            Check your email for a reset link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={inputStyle}
              />
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
              {isLoading ? <><Spinner /> Sending…</> : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <Link
            href="/signin"
            style={{ fontFamily: fB, fontSize: '0.875rem', color: '#F97316', fontWeight: 500 }}
          >
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
