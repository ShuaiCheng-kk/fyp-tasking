import { Baloo_2 } from 'next/font/google';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const marketingFont = Baloo_2({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-marketing',
});

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`marketing-page ${marketingFont.variable}`}
      style={{
        '--font-heading': 'var(--font-marketing)',
        '--font-body': 'var(--font-marketing)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      } as React.CSSProperties}
    >
      <Navbar theme="light" />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</main>
      <Footer />
    </div>
  );
}
