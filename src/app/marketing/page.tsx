import type { Metadata } from 'next'
import Navbar from '@/components/marketing/Navbar'
import Hero from '@/components/marketing/Hero'
import Problem from '@/components/marketing/Problem'
import Features from '@/components/marketing/Features'
import Pricing from '@/components/marketing/Pricing'
import Testimonials from '@/components/marketing/Testimonials'
import FAQ from '@/components/marketing/FAQ'
import Footer from '@/components/marketing/Footer'

export const metadata: Metadata = {
  title: 'Tasking — Smart Workforce Management for SMEs',
  description:
    'Automate casual worker recruitment, attendance tracking, and task allocation. AI-powered matching, photo verification, and real-time notifications — one platform for the whole workforce.',
  openGraph: {
    title: 'Tasking — Smart Workforce Management for SMEs',
    description:
      'Automate casual worker recruitment, attendance tracking, and task allocation. One platform for growing businesses.',
    type: 'website',
  },
}

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <Features />
        <Pricing />
        <Testimonials />
        <FAQ />
      </main>
      <Footer />
    </div>
  )
}
