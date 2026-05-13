'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const faqs = [
  {
    q: 'Is Tasking free to use?',
    a: 'Yes. Tasking operates on a freemium model. The core platform — including all AI features — is free forever. AI candidate recommendation, job description generation, auto-approve timesheets, and anomaly detection are all included at no cost. There is no trial period, no credit card required, and no AI paywall.',
  },
  {
    q: 'What does the paid plan include?',
    a: 'The paid plan extends Tasking with compliance reporting tools, advanced skills management (certifications, role-specific requirements, expiry tracking), and performance tracking across casual workers over time. These are designed for SMEs that have outgrown the basics and need structured workforce data.',
  },
  {
    q: 'Who is Tasking built for?',
    a: 'Tasking is built for SMEs and startups with 5 to 50 employees that rely on casual or flexible workers — typically in retail, F&B, logistics, or event management. The platform supports five user roles: Owner, Manager, Employee, Casual Worker, and Guest User. Each role has exactly the access they need — nothing more.',
  },
  {
    q: 'Do casual workers need to create an account to apply for jobs?',
    a: 'No. Casual workers and job seekers can browse all open positions on the public recruitment portal without creating an account. An account is only required when they want to formally apply for a role and participate in the hiring process.',
  },
  {
    q: 'How does AI candidate recommendation work?',
    a: 'When applicants apply for a role, Tasking\'s AI analyses their submitted profile — including skills, stated availability, and work history — and generates a ranked shortlist. The manager sees the highest-fit candidates at the top of their applicant list, with no manual sorting required. The ranking updates as new applications come in.',
  },
  {
    q: 'How is data kept secure?',
    a: 'Tasking uses Supabase Auth for authentication, with secure session management and encrypted storage. Access to data is strictly role-based — each user can only read and write what their role permits. Attendance records include full modification history and preserve the original record permanently for audit purposes.',
  },
  {
    q: 'Is there a mobile app?',
    a: 'Tasking is a fully web-based platform — no app download required. It works on any modern browser across desktop, tablet, and mobile. Clock-ins, attendance submissions, and notifications all work through the browser, including the photo capture flow for verification.',
  },
  {
    q: 'What happens if a casual worker doesn\'t respond to an invitation?',
    a: 'Every invitation has a 12-hour acceptance window. If the casual worker hasn\'t responded, Tasking sends an automatic reminder before the deadline. If the window closes with no response, the manager receives a notification and can take action — whether that\'s extending the window, re-inviting someone else, or filling the role from another applicant.',
  },
];

// ─── Accordion item ───────────────────────────────────────────────────────────

function AccordionItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid',
      borderColor: isOpen ? '#F97316' : '#F0E8D8',
      borderRadius: '14px',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '22px 28px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          gap: '16px',
        }}
      >
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 600,
          fontSize: '1.0625rem',
          color: isOpen ? '#F97316' : '#1C1917',
          lineHeight: 1.4,
          transition: 'color 0.2s',
        }}>
          {q}
        </span>
        <ChevronDown
          size={20}
          color={isOpen ? '#F97316' : '#78716C'}
          style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}
        />
      </button>

      <div style={{
        maxHeight: isOpen ? '400px' : '0',
        overflow: 'hidden',
        transition: 'max-height 0.3s ease',
      }}>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.9375rem',
          color: '#78716C',
          lineHeight: 1.75,
          padding: '0 28px 24px',
        }}>
          {a}
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <>
      {/* ========== HERO ========== */}
      <section style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <Link href="/about" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: '32px', textDecoration: 'none' }}>

          </Link>
          <span style={{ display: 'inline-block', background: 'rgba(249,115,22,0.18)', color: '#FB923C', padding: '5px 14px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: '24px' }}>
            FAQ
          </span>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', marginBottom: '20px' }}>
            Questions we get all the time.
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75 }}>
            Honest answers about how Tasking works, what&apos;s free, and what to expect.
          </p>
        </div>
      </section>

      {/* ========== ACCORDION ========== */}
      <section style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faqs.map(({ q, a }, i) => (
              <AccordionItem
                key={i}
                q={q}
                a={a}
                isOpen={openIndex === i}
                onToggle={() => toggle(i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ========== STILL HAVE QUESTIONS ========== */}
      <section style={{ background: '#FFFFFF', padding: '60px 24px' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.75rem', color: '#1C1917', marginBottom: '12px' }}>
            Still have questions?
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: '#78716C', lineHeight: 1.7, marginBottom: '28px' }}>
            The best way to get answers is to try it. Everything in the core plan is free — no credit card, no commitment.
          </p>
          <Link href="/get-started" className="btn-press cta-shimmer" style={{ display: 'inline-block', background: '#F97316', color: '#FFFFFF', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9375rem' }}>
            Get Started Free
          </Link>
        </div>
      </section>
    </>
  );
}
