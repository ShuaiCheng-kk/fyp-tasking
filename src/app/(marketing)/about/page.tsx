import Link from 'next/link';
import { Target, Lightbulb, Users, HelpCircle, ArrowRight } from 'lucide-react';

// ─── Nav cards data ───────────────────────────────────────────────────────────

const cards = [
  {
    icon: Target,
    label: 'Mission',
    desc: 'Why we built Tasking and what we stand for.',
    href: '/about/mission',
  },
  {
    icon: Lightbulb,
    label: 'Problem & Solution',
    desc: 'The real problems SMEs face, and exactly how we fix them.',
    href: '/about/problem-solution',
  },
  {
    icon: Users,
    label: 'Meet the Team',
    desc: 'The people behind Tasking.',
    href: '/about/team',
  },
  {
    icon: HelpCircle,
    label: 'FAQ',
    desc: 'Answers to the questions we get most often.',
    href: '/about/faq',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <>
      {/* ========== HERO ========== */}
      <section style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <span style={{
            display: 'inline-block',
            background: 'rgba(249,115,22,0.18)',
            color: '#FB923C',
            padding: '5px 14px',
            borderRadius: '100px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            marginBottom: '24px',
          }}>
            About
          </span>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '3rem',
            lineHeight: 1.15,
            color: '#FFFFFF',
            maxWidth: '720px',
            margin: '0 auto 20px',
          }}>
            Built by people who&apos;ve seen the chaos firsthand.
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.0625rem',
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.75,
            maxWidth: '580px',
            margin: '0 auto',
          }}>
            Tasking was born out of a simple frustration — watching SMEs struggle with casual workforce
            management using tools that were never built for them.
          </p>
        </div>
      </section>

      {/* ========== NAV CARDS ========== */}
      <section style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '2.25rem',
              color: '#1C1917',
              marginBottom: '12px',
            }}>
              Learn more about us
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1.0625rem',
              color: '#78716C',
              lineHeight: 1.7,
            }}>
              Everything you need to know about why Tasking exists and the people behind it.
            </p>
          </div>

          <div className="grid-features-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            {cards.map(({ icon: Icon, label, desc, href }) => (
              <Link
                key={href}
                href={href}
                className="card-lift"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '20px',
                  background: '#FFFFFF',
                  border: '1px solid #F0E8D8',
                  borderRadius: '16px',
                  padding: '32px',
                  textDecoration: 'none',
                }}
              >
                <div style={{
                  width: '52px',
                  height: '52px',
                  background: '#FEF3C7',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={24} color="#F97316" strokeWidth={1.75} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h3 style={{
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 600,
                      fontSize: '1.125rem',
                      color: '#1C1917',
                    }}>
                      {label}
                    </h3>
                    <ArrowRight size={18} color="#F97316" />
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.9375rem',
                    color: '#78716C',
                    lineHeight: 1.65,
                  }}>
                    {desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ========== CLOSING QUOTE ========== */}
      <section style={{ background: '#F97316', padding: '72px 24px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '1.875rem',
            color: '#FFFFFF',
            lineHeight: 1.3,
            marginBottom: '20px',
          }}>
            &ldquo;We didn&apos;t build another HR tool. We built the thing SMEs actually needed.&rdquo;
          </p>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.9375rem',
            color: 'rgba(255,255,255,0.75)',
          }}>
            — The Tasking Team
          </p>
        </div>
      </section>
    </>
  );
}
