'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: 'What is Tasking and who is it for?',
    a: 'Tasking is a workforce management platform built specifically for small and medium businesses that depend on casual or part-time workers — restaurants, retail stores, event companies, warehouses, and more. If you are managing shifts, hiring, and attendance through WhatsApp and spreadsheets, Tasking is built for you.',
  },
  {
    q: 'How does AI candidate matching work?',
    a: 'When a worker applies for a job posting, our AI analyses their skills, work history, and past attendance rate against your listed requirements. It returns a match score from 0 to 100 for every applicant, ranked highest first — so you can see the best candidates at a glance without screening anyone manually.',
  },
  {
    q: 'Is my workers\' data safe and private?',
    a: 'Yes. All data is encrypted in transit using TLS and encrypted at rest. We use Supabase with row-level security, meaning each business account is fully isolated and can never see another company\'s data. Attendance verification photos are stored in a private storage bucket — they are never shared or used for anything other than identity confirmation.',
  },
  {
    q: 'Can I upgrade from the Free plan to Pro at any time?',
    a: 'Yes — you can upgrade instantly from the Owner dashboard. All your existing data, workers, job postings, and attendance records carry over immediately. There is no migration process or downtime.',
  },
  {
    q: 'Do my workers need to download an app?',
    a: 'No. Tasking is fully web-based and works on any modern smartphone browser. Workers clock in through a mobile-optimised web page — no app store, no installation, no device management required on your end.',
  },
]

function ChevronDown() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <path
        d="M4.5 6.75L9 11.25L13.5 6.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="bg-zinc-900 py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">FAQ</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Everything you need to know before getting started.
          </p>
        </div>

        {/* Accordion */}
        <dl className="mt-12 space-y-2">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i
            return (
              <div
                key={i}
                className={`overflow-hidden rounded-xl border transition-colors duration-150 ${
                  isOpen ? 'border-zinc-700 bg-zinc-800/50' : 'border-zinc-800 bg-zinc-900'
                }`}
              >
                <dt>
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-semibold text-white">{faq.q}</span>
                    <span
                      className={`text-zinc-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    >
                      <ChevronDown />
                    </span>
                  </button>
                </dt>
                {isOpen && (
                  <dd className="border-t border-zinc-800 px-6 pb-5 pt-4">
                    <p className="text-sm leading-relaxed text-zinc-400">{faq.a}</p>
                  </dd>
                )}
              </div>
            )
          })}
        </dl>
      </div>
    </section>
  )
}
