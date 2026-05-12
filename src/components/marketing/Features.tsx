const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <path d="M12 12v4M10 14h4" />
      </svg>
    ),
    name: 'Recruitment',
    description:
      'Post job openings, collect applications, and manage the full hiring pipeline — from posting to offer — in one dashboard.',
    iconBg: 'bg-indigo-950/60 border-indigo-900/40',
    iconColor: 'text-indigo-400',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="M9 15l2 2 4-4" />
      </svg>
    ),
    name: 'Attendance Tracking',
    description:
      'Real-time clock-in and clock-out with automated status detection — present, late, or absent — and shift coverage reports for managers.',
    iconBg: 'bg-violet-950/60 border-violet-900/40',
    iconColor: 'text-violet-400',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09z" />
        <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456z" />
      </svg>
    ),
    name: 'AI Candidate Matching',
    description:
      'Our AI scores every applicant against your job requirements and past performance data, surfacing the best fits without manual screening.',
    iconBg: 'bg-purple-950/60 border-purple-900/40',
    iconColor: 'text-purple-400',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316z" />
        <path d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zM18.75 10.5h.008v.008h-.008V10.5z" />
      </svg>
    ),
    name: 'Photo Verification',
    description:
      'Workers submit a selfie when clocking in. Eliminate buddy-punching and attendance disputes with timestamped photo evidence.',
    iconBg: 'bg-cyan-950/60 border-cyan-900/40',
    iconColor: 'text-cyan-400',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="6" height="4" rx="1" />
        <rect x="16" y="3" width="6" height="4" rx="1" />
        <rect x="9" y="17" width="6" height="4" rx="1" />
        <path d="M5 7v4h14V7M12 11v6" />
      </svg>
    ),
    name: 'Cross-dept Management',
    description:
      'Assign and reassign casual workers across departments and locations from a single unified view — no more siloed spreadsheets per team.',
    iconBg: 'bg-teal-950/60 border-teal-900/40',
    iconColor: 'text-teal-400',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
      </svg>
    ),
    name: 'Smart Notifications',
    description:
      'Automated alerts for shift reminders, attendance anomalies, and application status updates — so no one misses a beat.',
    iconBg: 'bg-orange-950/60 border-orange-900/40',
    iconColor: 'text-orange-400',
  },
]

export default function Features() {
  return (
    <section id="features" className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Everything in One Place
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Six modules built together from the ground up — not bolted on as an afterthought.
          </p>
        </div>

        {/* Feature grid */}
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.name}
              className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-800/70"
            >
              <div
                className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border ${f.iconBg} ${f.iconColor}`}
              >
                {f.icon}
              </div>
              <h3 className="mb-2 text-base font-bold text-white">{f.name}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
