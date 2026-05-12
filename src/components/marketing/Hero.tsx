import Link from 'next/link'

const SIDEBAR_ITEMS = ['Dashboard', 'Workers', 'Recruitment', 'Attendance', 'Notifications']

const STATS = [
  { label: 'Active Workers', value: '24', sub: '+3 this week' },
  { label: 'Open Jobs', value: '8', sub: '2 closing soon' },
  { label: 'Check-ins Today', value: '19', sub: '79% rate' },
]

const ATTENDANCE_ROWS = [
  { name: 'Ahmad Razif', dept: 'Kitchen', status: 'Present', dot: 'bg-emerald-400', badge: 'bg-emerald-900/50 text-emerald-400' },
  { name: 'Siti Hajar', dept: 'Service', status: 'Present', dot: 'bg-emerald-400', badge: 'bg-emerald-900/50 text-emerald-400' },
  { name: 'Lee Wei Ming', dept: 'Cashier', status: 'Late', dot: 'bg-yellow-400', badge: 'bg-yellow-900/50 text-yellow-400' },
  { name: 'Priya Nair', dept: 'Service', status: 'Absent', dot: 'bg-red-400', badge: 'bg-red-900/50 text-red-400' },
]

function DashboardMockup() {
  return (
    <div
      className="relative mt-14 overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-900 shadow-2xl shadow-indigo-950/50"
      style={{ boxShadow: '0 25px 80px -12px rgba(79, 70, 229, 0.25), 0 0 0 1px rgba(255,255,255,0.05)' }}
      aria-label="Dashboard preview"
      role="img"
    >
      {/* Browser chrome */}
      <div className="flex h-9 items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-3">
        <div className="flex gap-1.5" aria-hidden="true">
          <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        </div>
        <div className="mx-3 flex h-5 flex-1 items-center rounded bg-zinc-800 px-2.5">
          <span className="text-[10px] text-zinc-500">app.tasking.io/dashboard</span>
        </div>
      </div>

      {/* App shell */}
      <div className="flex" style={{ height: '300px' }}>
        {/* Sidebar */}
        <aside className="hidden w-44 flex-shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 p-3 sm:flex">
          <p className="mb-3 px-2.5 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
            Menu
          </p>
          {SIDEBAR_ITEMS.map((item, i) => (
            <div
              key={item}
              className={`mb-0.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium ${
                i === 0
                  ? 'bg-indigo-600/20 text-indigo-400'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {item}
            </div>
          ))}
        </aside>

        {/* Main content */}
        <div className="flex-1 overflow-hidden p-3">
          {/* Stat cards */}
          <div className="mb-3 grid grid-cols-3 gap-2">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-2.5"
              >
                <p className="text-[9px] font-medium text-zinc-500">{s.label}</p>
                <p className="mt-1 text-xl font-bold text-white">{s.value}</p>
                <p className="mt-0.5 text-[9px] text-indigo-400">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Attendance table */}
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <div className="border-b border-zinc-800 bg-zinc-800/40 px-3 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Today's Attendance
              </p>
            </div>
            {ATTENDANCE_ROWS.map((row) => (
              <div
                key={row.name}
                className="flex items-center border-b border-zinc-800/40 px-3 py-2 last:border-0"
              >
                <div className="mr-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600/20">
                  <span className="text-[9px] font-bold text-indigo-400">{row.name[0]}</span>
                </div>
                <p className="flex-1 truncate text-[11px] font-medium text-zinc-300">{row.name}</p>
                <p className="mr-2.5 hidden text-[10px] text-zinc-600 sm:block">{row.dept}</p>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${row.badge}`}>
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-28 pt-32 sm:pt-36">
      {/* Radial background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 75% 45% at 50% -5%, rgba(99,102,241,0.2) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Badge */}
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-800/50 bg-indigo-950/50 px-4 py-1.5 text-xs font-semibold text-indigo-300 ring-1 ring-inset ring-indigo-800/30">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" aria-hidden="true" />
            Smart Workforce Management · Now in Beta
          </span>
        </div>

        {/* Headline */}
        <h1 className="mx-auto mt-6 max-w-3xl text-center text-5xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
          Manage Casual Workers{' '}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(135deg, #818cf8 0%, #a78bfa 50%, #c4b5fd 100%)',
            }}
          >
            Without the Chaos
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-zinc-400 sm:text-xl">
          Recruitment, attendance tracking, AI-powered candidate matching, and real-time
          notifications — one platform for the whole workforce.
        </p>

        {/* CTA row */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/auth/sign-up"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-150 hover:bg-indigo-500 hover:shadow-indigo-900/40"
          >
            Get Started Free
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M2.5 7h9M8 3.5L11.5 7 8 10.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-300 transition-all duration-150 hover:border-zinc-500 hover:text-white"
          >
            See how it works
          </a>
        </div>

        <p className="mt-3 text-center text-xs text-zinc-600">
          No credit card required · Free plan, forever
        </p>

        {/* Dashboard mockup */}
        <DashboardMockup />
      </div>
    </section>
  )
}
