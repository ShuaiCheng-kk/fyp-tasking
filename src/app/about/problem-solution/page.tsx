import Link from 'next/link';
import { ArrowLeft, X, CheckCircle2 } from 'lucide-react';

// ─── Content ─────────────────────────────────────────────────────────────────

const problems = [
  {
    n: '01',
    title: 'No reliable way to verify attendance',
    body: 'Paper timesheets and WhatsApp check-ins are impossible to audit. When disputes arise, there\'s no evidence — just conflicting memories.',
  },
  {
    n: '02',
    title: 'Shift coordination is entirely manual',
    body: 'Managers spend hours every week posting jobs, chasing acceptances, and confirming shifts through personal messages — work the system should be doing.',
  },
  {
    n: '03',
    title: 'No structured hiring flow for casual roles',
    body: 'Job boards and generic HR tools weren\'t built for high-turnover casual hiring. There\'s no ranking, no deadline enforcement, no automated closure when a role is filled.',
  },
  {
    n: '04',
    title: 'Permissions and access are all or nothing',
    body: 'Most tools give everyone the same view or none at all. Managers see too much. Casual workers see nothing useful. There\'s no concept of role-based operational access.',
  },
  {
    n: '05',
    title: 'No single source of truth',
    body: 'Data lives in spreadsheets, messaging apps, email threads, and personal notes. There\'s no centralised record of who worked, when, what they were paid, or why they left.',
  },
];

const marketGaps = [
  { gap: 'Built for enterprises, not SMEs', detail: 'Most workforce tools assume you have an IT team, a dedicated HR department, and six-figure software budgets. SMEs have none of these.' },
  { gap: 'AI is a premium add-on', detail: 'Candidate ranking, job description generation, and anomaly detection are locked behind expensive tiers that SMEs simply can\'t justify.' },
  { gap: 'No photo-based verification', detail: 'Clock-in confirmation is still a text field or a button press — with nothing to prove who actually submitted it.' },
  { gap: 'Attendance records can\'t be audited', detail: 'When a record is modified, the original disappears. There\'s no chain of evidence, no history, no transparency.' },
  { gap: 'No clopening protection', detail: 'Back-to-back shifts with insufficient rest time get scheduled without any warning — creating burnout and legal risk that managers don\'t catch until it\'s too late.' },
  { gap: 'Scheduling is disconnected from hiring', detail: 'Recruitment and scheduling tools don\'t talk to each other. A job gets filled in one system; the shift gets assigned in another. Nothing is automatic.' },
  { gap: 'Casual workers are an afterthought', detail: 'Most tools don\'t model the casual worker experience at all. There\'s no public job portal, no visibility into their own history, no way to participate in the workflow without a full account.' },
];

const fixes = [
  {
    problem: 'Unverifiable attendance',
    solution: 'Photo-verified clock-ins + signed submission + AI anomaly detection',
    detail: 'Every clock-in includes a live photo. Employees sign before submitting. AI flags mismatches and unusual patterns before managers even open the record.',
  },
  {
    problem: 'Manual shift coordination',
    solution: 'Automated reminders, deadlines, and closure',
    detail: '12-hour acceptance windows start automatically. Reminders fire without manual intervention. Jobs close the moment a candidate accepts. Managers only act when something actually needs them.',
  },
  {
    problem: 'Unstructured casual hiring',
    solution: 'Public portal + AI ranking + one-click invitation',
    detail: 'Casual workers browse and apply without an account. AI ranks every applicant by fit. The manager selects, invites, and the system handles everything else.',
  },
  {
    problem: 'All-or-nothing access',
    solution: 'Five distinct roles with scoped visibility',
    detail: 'Owners see everything. Managers see their department. Employees see their assigned work. Casual workers see their own history. Guests browse and apply. Nothing more, nothing less.',
  },
  {
    problem: 'No single source of truth',
    solution: 'One platform for recruitment, attendance, and team management',
    detail: 'Every action — job posting, clock-in, record submission, approval — lives in the same system with a complete, tamper-evident audit trail.',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProblemSolutionPage() {
  return (
    <>
      {/* ========== HERO ========== */}
      <section style={{ background: '#1C1C1E', padding: '96px 0 80px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <Link href="/about" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: '32px', textDecoration: 'none' }}>

          </Link>
          <span style={{ display: 'inline-block', background: 'rgba(249,115,22,0.18)', color: '#FB923C', padding: '5px 14px', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: '24px' }}>
            Problem & Solution
          </span>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '3rem', lineHeight: 1.15, color: '#FFFFFF', marginBottom: '20px' }}>
            The problem is real. The fixes are already built.
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75 }}>
            Here&apos;s an honest breakdown of what&apos;s broken in casual workforce management, where existing tools fall short, and exactly how Tasking addresses it.
          </p>
        </div>
      </section>

      {/* ========== THE PROBLEM ========== */}
      <section style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>The problem</p>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' }}>
              What SMEs are dealing with every day
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.7, maxWidth: '560px', margin: '0 auto' }}>
              These aren&apos;t edge cases. They&apos;re the daily reality for any SME relying on casual workers.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '860px', margin: '0 auto' }}>
            {problems.map(({ n, title, body }) => (
              <div key={n} style={{ display: 'flex', gap: '24px', background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '16px', padding: '28px', alignItems: 'flex-start' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#FEF3C7', border: '2px solid #F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.875rem', color: '#F97316' }}>{n}</span>
                </div>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.0625rem', color: '#1C1917', marginBottom: '6px' }}>{title}</h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== WHAT THE MARKET GOT WRONG ========== */}
      <section style={{ background: '#FFFFFF', padding: '80px 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>What the market got wrong</p>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' }}>
              Existing tools weren&apos;t built for this
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.7, maxWidth: '560px', margin: '0 auto' }}>
              Seven specific gaps in the tools SMEs are currently using — and paying for.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', maxWidth: '960px', margin: '0 auto' }}>
            {marketGaps.map(({ gap, detail }) => (
              <div key={gap} style={{ display: 'flex', gap: '16px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '24px', alignItems: 'flex-start' }}>
                <X size={20} color="#EF4444" strokeWidth={2} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1rem', color: '#6B7280', marginBottom: '6px' }}>{gap}</h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#78716C', lineHeight: 1.65 }}>{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== HOW TASKING FIXES IT ========== */}
      <section style={{ background: '#FFFBF5', padding: '80px 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 600, color: '#F97316', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>How Tasking fixes it</p>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.25rem', color: '#1C1917', marginBottom: '12px' }}>
              Every problem. Directly addressed.
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: '#78716C', lineHeight: 1.7, maxWidth: '560px', margin: '0 auto' }}>
              Not workarounds. Not partial fixes. Specific features built to solve each problem.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '900px', margin: '0 auto' }}>
            {fixes.map(({ problem, solution, detail }) => (
              <div key={problem} style={{ background: '#FFFFFF', border: '1px solid #F0E8D8', borderRadius: '16px', padding: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '12px' }}>
                  <CheckCircle2 size={22} color="#F97316" strokeWidth={1.75} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8125rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                      Problem: {problem}
                    </p>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.0625rem', color: '#F97316' }}>{solution}</h3>
                  </div>
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#78716C', lineHeight: 1.7, paddingLeft: '38px' }}>{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== CTA ========== */}
      <section style={{ background: '#F97316', padding: '72px 24px' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.25rem', color: '#FFFFFF', marginBottom: '16px', lineHeight: 1.2 }}>
            See it working. For free.
          </h2>
          <Link href="/get-started" className="btn-press" style={{ display: 'inline-block', background: '#FFFFFF', color: '#F97316', padding: '13px 30px', borderRadius: '10px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9375rem' }}>
            Get Started Free
          </Link>
        </div>
      </section>
    </>
  );
}
