const TESTIMONIALS = [
  {
    quote:
      'Before Tasking, I spent three hours every Monday just sorting out the week\'s roster. Now it takes fifteen minutes. The AI matching is genuinely impressive — it surfaces exactly the workers I would have picked anyway.',
    name: 'Ahmad Rashid',
    role: 'Operations Manager',
    company: 'Nasi Lemak Antarabangsa',
    initials: 'AR',
    avatarBg: 'bg-indigo-600/20',
    avatarText: 'text-indigo-400',
  },
  {
    quote:
      'We completely eliminated buddy-punching with photo verification. The attendance disputes we dealt with every single week are just gone. Our managers have their mornings back.',
    name: 'Jenny Loh',
    role: 'HR Manager',
    company: 'Urban Retail Solutions',
    initials: 'JL',
    avatarBg: 'bg-violet-600/20',
    avatarText: 'text-violet-400',
  },
  {
    quote:
      'We scaled from 10 to 80 casual workers in four months without hiring a single admin staff member. Tasking handles all the coordination the old spreadsheet system never could.',
    name: 'Marcus Tan',
    role: 'Founder',
    company: 'EventBoss Sdn Bhd',
    initials: 'MT',
    avatarBg: 'bg-cyan-600/20',
    avatarText: 'text-cyan-400',
  },
]

function StarRating() {
  return (
    <div className="flex gap-0.5" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="currentColor"
          className="text-amber-400"
          aria-hidden="true"
        >
          <path d="M7 1l1.854 3.755L13 5.39l-3 2.923.708 4.128L7 10.5l-3.708 1.94L4 8.313 1 5.39l4.146-.635L7 1z" />
        </svg>
      ))}
    </div>
  )
}

export default function Testimonials() {
  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Testimonials
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Trusted by SMEs Across Malaysia
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            See how businesses like yours are managing their workforce with Tasking.
          </p>
        </div>

        {/* Testimonial cards */}
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition-all duration-200 hover:border-zinc-700"
            >
              <StarRating />

              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-zinc-300">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <div className="mt-6 flex items-center gap-3 border-t border-zinc-800 pt-5">
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${t.avatarBg}`}
                  aria-hidden="true"
                >
                  <span className={`text-sm font-bold ${t.avatarText}`}>{t.initials}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-zinc-500">
                    {t.role} · {t.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
