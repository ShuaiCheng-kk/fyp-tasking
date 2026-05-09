const PROBLEMS = [
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 3v18M3 15h6M9 15h12" />
      </svg>
    ),
    title: 'Spreadsheet Hell',
    description:
      'Hours wasted every week maintaining shift schedules across multiple files. One wrong formula cascades into missed shifts, unpaid overtime, and worker complaints.',
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
        <path d="M9 15l6-6" />
      </svg>
    ),
    title: 'Invisible Attendance',
    description:
      'No-shows discovered after the shift starts. Buddy-punching you can\'t catch. Manual headcounts that pull a manager away from operations every single day.',
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
    title: 'Hiring That Moves Too Slow',
    description:
      'Posting a role on WhatsApp, collecting applications through DMs, and scheduling interviews by hand takes days — when you needed someone on the floor yesterday.',
  },
]

export default function Problem() {
  return (
    <section className="bg-zinc-900 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            The Problem
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Managing Casual Workers Is Harder Than It Looks
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Most SMEs cobble together WhatsApp groups, spreadsheets, and gut feel. It works — until it doesn't.
          </p>
        </div>

        {/* Cards */}
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {PROBLEMS.map((p) => (
            <div
              key={p.title}
              className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-800/60"
            >
              {/* Red-tinted icon */}
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-red-900/40 bg-red-950/50 text-red-400">
                {p.icon}
              </div>
              <h3 className="mb-2 text-base font-bold text-white">{p.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{p.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
