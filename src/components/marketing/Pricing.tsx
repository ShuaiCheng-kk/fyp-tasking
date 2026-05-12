import Link from 'next/link'

const FREE_FEATURES = [
  '1 business location',
  'Up to 10 casual workers',
  '3 active job postings',
  'Basic attendance tracking',
  'Email notifications',
  'Community support',
]

const PRO_FEATURES = [
  'Everything in Starter',
  'Unlimited locations & workers',
  'Unlimited job postings',
  'AI candidate matching & scoring',
  'Photo verification at clock-in',
  'Cross-department management',
  'Advanced analytics & reports',
  'Priority support (4 h SLA)',
]

function CheckIcon({ className }: { className: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M3 8l3.5 3.5L13 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Pricing() {
  return (
    <section id="pricing" className="bg-zinc-900 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Start Free, Scale When Ready
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            No credit card required. Upgrade any time without losing your data.
          </p>
        </div>

        {/* Cards */}
        <div className="mx-auto mt-14 grid max-w-4xl gap-6 lg:grid-cols-2">
          {/* Free / Starter */}
          <div className="flex flex-col rounded-2xl border border-zinc-700 bg-zinc-900 p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Starter</p>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-5xl font-extrabold text-white">Free</span>
              </div>
              <p className="mt-2 text-sm text-zinc-500">Forever free. No hidden limits until you grow.</p>
            </div>

            <ul className="my-8 flex-1 space-y-3" role="list">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-zinc-400">
                  <CheckIcon className="flex-shrink-0 text-zinc-500" />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/auth/sign-up"
              className="block rounded-lg border border-zinc-600 py-3 text-center text-sm font-semibold text-zinc-300 transition-colors duration-150 hover:border-zinc-400 hover:text-white"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro */}
          <div className="relative flex flex-col overflow-hidden rounded-2xl border border-indigo-500 bg-indigo-950/20 p-8 ring-1 ring-indigo-500/20">
            {/* Most popular badge */}
            <div className="absolute right-6 top-6">
              <span className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">
                Most Popular
              </span>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Pro</p>
              <div className="mt-3 flex items-end gap-1.5">
                <span className="text-5xl font-extrabold text-white">RM 99</span>
                <span className="mb-1.5 text-sm font-medium text-zinc-400">/ month</span>
              </div>
              <p className="mt-2 text-sm text-zinc-400">Billed monthly. Cancel anytime.</p>
            </div>

            <ul className="my-8 flex-1 space-y-3" role="list">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-zinc-300">
                  <CheckIcon className="flex-shrink-0 text-indigo-400" />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/auth/sign-up?plan=pro"
              className="block rounded-lg bg-indigo-600 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition-colors duration-150 hover:bg-indigo-500"
            >
              Start Pro Free Trial
            </Link>
          </div>
        </div>

        {/* Footnote */}
        <p className="mt-8 text-center text-xs text-zinc-600">
          All prices in Malaysian Ringgit (MYR) · No setup fees · Cancel at any time
        </p>
      </div>
    </section>
  )
}
