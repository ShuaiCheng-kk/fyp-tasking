import Link from 'next/link';

const inner: React.CSSProperties = { maxWidth: '1280px', margin: '0 auto', padding: '0 24px' };
const h2style: React.CSSProperties = { fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' };
const subtitleStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.75, maxWidth: '560px', margin: '0 auto' };

const IcoDept = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="8" height="5" rx="1" stroke="#F97316" strokeWidth="2" /><rect x="14" y="3" width="8" height="5" rx="1" stroke="#F97316" strokeWidth="2" /><rect x="8" y="16" width="8" height="5" rx="1" stroke="#F97316" strokeWidth="2" /><path d="M6 8v4h12V8M12 12v4" stroke="#F97316" strokeWidth="2" strokeLinecap="round" /></svg>);
const IcoLink = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoPerm = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoBlock = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#F97316" strokeWidth="2" /><path d="M4.93 4.93l14.14 14.14" stroke="#F97316" strokeWidth="2" strokeLinecap="round" /></svg>);
const IcoDash = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="#F97316" strokeWidth="2" /><rect x="14" y="3" width="7" height="7" rx="1" stroke="#F97316" strokeWidth="2" /><rect x="3" y="14" width="7" height="7" rx="1" stroke="#F97316" strokeWidth="2" /><rect x="14" y="14" width="7" height="7" rx="1" stroke="#F97316" strokeWidth="2" /></svg>);
const IcoEye = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke="#F97316" strokeWidth="2" /></svg>);
const IcoHistory = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 3v5h5" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 7v5l3 3" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const IconBox = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: '48px', height: '48px', background: '#FEF3C7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>{children}</div>
);

function FeatureCard({ icon, name, desc }: { icon: React.ReactNode; name: string; desc: string }) {
  return (
    <div className="card-lift" style={{ background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '16px', padding: '28px' }}>
      <IconBox>{icon}</IconBox>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.0625rem', color: '#1C1917', marginBottom: '8px' }}>{name}</h3>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7 }}>{desc}</p>
    </div>
  );
}

function CtaBanner({ headline, sub }: { headline: string; sub: string }) {
  return (
    <section className="cta-banner" style={{ background: '#F97316', padding: '80px 24px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.5rem', color: '#FFFFFF', marginBottom: '16px', lineHeight: 1.2 }}>{headline}</h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, marginBottom: '36px' }}>{sub}</p>
        <Link href="/get-started" className="btn-press" style={{ display: 'inline-block', background: '#FFFFFF', color: '#F97316', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9375rem' }}>Get Started Free</Link>
      </div>
    </section>
  );
}

export default function TeamManagementPage() {
  const features = [
    { icon: <IcoDept />, name: 'Company & Department Setup', desc: 'Get your organisation structured from day one. Create departments, assign managers, and set the foundation for everything else to run smoothly.' },
    { icon: <IcoLink />, name: 'Flexible User Invitations', desc: 'Bring your team in fast — send a direct invitation link to new managers or share a digital code to onboard a co-owner with full access.' },
    { icon: <IcoPerm />, name: 'Manager Permissions & Assignment', desc: 'Define exactly what each manager can and can\'t do. Reassign them to different departments anytime without losing any historical data.' },
    { icon: <IcoBlock />, name: 'Casual Worker Account Control', desc: 'Set accounts to inactive to pause activity, or block them entirely — tied to their phone number to prevent re-registration.' },
    { icon: <IcoDash />, name: 'Company Overview Dashboard', desc: 'See all departments, active casual workers, open job postings, and attendance performance across your entire organisation in one place.' },
    { icon: <IcoEye />, name: 'Role-based Data Access', desc: 'Every role only sees what\'s relevant to them. Employees can view peer manager data in read-only mode. Casual workers see only their own work and history.' },
    { icon: <IcoHistory />, name: 'CW Performance History', desc: 'Track each casual worker\'s job history and past performance — so every hiring decision is backed by real data.' },
  ];

  const roles = [
    { name: 'Owner', badge: '#92400E', badgeBg: '#FEF3C7', desc: 'Full visibility across all departments. Sets the structure and defines what each Manager can do.' },
    { name: 'Manager', badge: '#1E3A5F', badgeBg: '#DBEAFE', desc: 'Full control over their department\'s recruitment, casual workers, and attendance. Read-only access to other departments.' },
    { name: 'Employee', badge: '#065F46', badgeBg: '#D1FAE5', desc: 'Sees their assigned work and the casual workers under their supervision. Confirms and submits attendance records.' },
    { name: 'Casual Worker', badge: '#374151', badgeBg: '#F3F4F6', desc: 'Sees their own shifts, job history, and profile. Nothing else.' },
    { name: 'Guest User', badge: '#4B3A2A', badgeBg: '#F0E8D8', desc: 'Browses the public recruitment page and applies for open roles. No internal access.' },
  ];

  return (
    <>
      {/* ========== HERO ========== */}
      <section className="sub-section" style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div className="sub-inner" style={{ ...inner, textAlign: 'center' }}>
          <span style={{ display: 'inline-block', background: 'rgba(249,115,22,0.18)', color: '#FB923C', padding: '5px 14px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: '24px' }}>Team Management</span>
          <h1 className="sub-hero-h1" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', maxWidth: '720px', margin: '0 auto 20px' }}>
            Your company structure, exactly how you need it.
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, maxWidth: '500px', margin: '0 auto 36px' }}>
            Full control from the top. Focused access for everyone else.
          </p>
          <Link href="/get-started" className="btn-press cta-shimmer" style={{ display: 'inline-block', background: '#F97316', color: '#FFFFFF', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9375rem' }}>
            Get Started Free
          </Link>
        </div>
      </section>

      {/* ========== FEATURES GRID ========== */}
      <section className="sub-section" style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div className="sub-inner" style={inner}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 className="sub-h2" style={h2style}>Everything you need to run your organisation</h2>
            <p style={subtitleStyle}>Structure, permissions, and access — all in one place.</p>
          </div>
          <div className="grid-features-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {features.slice(0, 6).map(f => <FeatureCard key={f.name} {...f} />)}
          </div>
          <div className="grid-features-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '20px' }}>
            <div />
            <FeatureCard {...features[6]} />
            <div />
          </div>
        </div>
      </section>

      {/* ========== ROLE BREAKDOWN ========== */}
      <section className="sub-section" style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div className="sub-inner" style={inner}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 className="sub-h2" style={h2style}>The right access for every role.</h2>
            <p style={subtitleStyle}>Tasking is built around five roles, each with exactly the visibility and control they need — nothing more.</p>
          </div>

          {/* 5 roles in a single equal row */}
          <div className="grid-roles" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
            {roles.map(({ name, badge, badgeBg, desc }) => (
              <div key={name} className="card-lift" style={{ background: '#FFFBF5', border: '1px solid #F0E8D8', borderRadius: '16px', padding: '24px' }}>
                <span style={{ display: 'inline-block', background: badgeBg, color: badge, padding: '4px 12px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'var(--font-body)', marginBottom: '14px' }}>
                  {name}
                </span>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <CtaBanner headline="Get your team set up in minutes." sub="No IT team. No training programme. Just a clean system your whole organisation can use from day one." />
    </>
  );
}
