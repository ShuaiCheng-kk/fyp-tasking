import Link from 'next/link'

const PRODUCT_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

const COMPANY_LINKS = [
  { label: 'About', href: '#' },
  { label: 'Blog', href: '#' },
  { label: 'Careers', href: '#' },
]

const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '#' },
  { label: 'Terms of Service', href: '#' },
  { label: 'Cookie Policy', href: '#' },
]

function FooterLogoMark() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2.5 8.5l3.5 3.5 7.5-8"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-4">
          {/* Brand column */}
          <div className="md:col-span-1">
            <Link href="/marketing" className="flex items-center gap-2.5">
              <FooterLogoMark />
              <span className="text-base font-bold tracking-tight text-white">Tasking</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">
              Smart workforce management for SMEs. Simplify recruitment, attendance, and task
              allocation — all in one place.
            </p>
          </div>

          {/* Product links */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Product</h3>
            <ul className="mt-4 space-y-3" role="list">
              {PRODUCT_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm text-zinc-400 transition-colors duration-150 hover:text-white"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Company</h3>
            <ul className="mt-4 space-y-3" role="list">
              {COMPANY_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm text-zinc-400 transition-colors duration-150 hover:text-white"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Legal</h3>
            <ul className="mt-4 space-y-3" role="list">
              {LEGAL_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm text-zinc-400 transition-colors duration-150 hover:text-white"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-zinc-800 pt-8 sm:flex-row">
          <p className="text-xs text-zinc-600">
            © 2026 Tasking. All rights reserved.
          </p>
          <p className="text-xs text-zinc-700">
            Built as a Final Year Project · Powered by Next.js &amp; Supabase
          </p>
        </div>
      </div>
    </footer>
  )
}
