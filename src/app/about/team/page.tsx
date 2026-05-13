import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// ─── Team data ────────────────────────────────────────────────────────────────

const team = [
  {
    name: 'Pei Shuai Cheng',
    role: 'Project Manager',
    initials: 'SC',
    color: '#F97316',
    bg: '#FEF3C7',
    desc: 'Oversees project timeline, milestones, and cross-team coordination to keep Tasking on track from concept to deployment.',
    focus: ['Timeline & milestones', 'Stakeholder communication', 'Risk management'],
  },
  {
    name: 'Nadiyah D/O Mohamed Asaref',
    role: 'UI/UX Designer',
    initials: 'NA',
    color: '#8B5CF6',
    bg: '#EDE9FE',
    desc: 'Designing intuitive, accessible interfaces across all 5 user roles — ensuring every interaction feels natural for SME operators and casual workers alike.',
    focus: ['User research', 'Wireframing & prototyping', '5-role interface design'],
  },
  {
    name: 'Nan Phyu Sin Maung',
    role: 'Frontend Developer',
    initials: 'NP',
    color: '#0EA5E9',
    bg: '#E0F2FE',
    desc: 'Building the user interface with Next.js and React, translating design specifications into a fast, accessible, and responsive web application.',
    focus: ['Next.js / React', 'Component architecture', 'Responsive UI'],
  },
  {
    name: 'Neha Tanmayi',
    role: 'Backend Developer',
    initials: 'NT',
    color: '#10B981',
    bg: '#D1FAE5',
    desc: 'Architecting the server-side logic, database schema, and API layer — ensuring data integrity and performance across all Tasking operations.',
    focus: ['Server-side logic', 'Database design', 'API development'],
  },
  {
    name: 'Phatcharin Ng Hui Lin',
    role: 'Backend Developer',
    initials: 'PH',
    color: '#EF4444',
    bg: '#FEE2E2',
    desc: 'Building the recruitment, attendance, and smart notification systems that form the operational core of the Tasking platform.',
    focus: ['Recruitment module', 'Attendance systems', 'Notification engine'],
  },
  {
    name: 'Sandy Tan Ying Hui',
    role: 'Full Stack Developer',
    initials: 'ST',
    color: '#F59E0B',
    bg: '#FEF3C7',
    desc: 'Leading AI integration across the platform and ensuring the modules work seamlessly together — from the job posting flow through to the approved attendance record.',
    focus: ['AI feature integration', 'Full-stack module cohesion', 'Platform architecture'],
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  return (
    <>
      {/* ========== HERO ========== */}
      <section style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <Link href="/about" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: '32px', textDecoration: 'none' }}>

          </Link>
          <span style={{ display: 'inline-block', background: 'rgba(249,115,22,0.18)', color: '#FB923C', padding: '5px 14px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: '24px' }}>
            The Team
          </span>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', marginBottom: '20px' }}>
            The people behind Tasking.
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75 }}>
            A multidisciplinary team of six — covering design, frontend, backend, full-stack, and project management — working together to make casual workforce management genuinely simple.
          </p>
        </div>
      </section>

      {/* ========== TEAM GRID ========== */}
      <section style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {team.map(({ name, role, initials, color, bg, desc, focus }) => (
              <div
                key={name}
                className="card-lift"
                style={{ background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '20px', padding: '32px', display: 'flex', flexDirection: 'column' }}
              >
                {/* Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: bg, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color }}>{initials}</span>
                  </div>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1rem', color: '#1C1917', marginBottom: '2px', lineHeight: 1.3 }}>{name}</h3>
                    <span style={{ display: 'inline-block', background: bg, color, padding: '2px 10px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
                      {role}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7, marginBottom: '20px', flex: 1 }}>{desc}</p>

                {/* Focus areas */}
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Focus areas</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {focus.map(f => (
                      <span key={f} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '4px 10px', fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: '#374151' }}>{f}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== CLOSING ========== */}
      <section style={{ background: '#F97316', padding: '72px 24px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>

          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2rem', color: '#FFFFFF', lineHeight: 1.25 }}>
            Six people. One platform. Built for the businesses that need it most.
          </h2>
        </div>
      </section>
    </>
  );
}
