'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';

// Pages that render their own full-screen layout — no Navbar or Footer
const STANDALONE_ROUTES = ['/signin', '/get-started'];

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalone = STANDALONE_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '/'),
  );

  if (isStandalone) {
    return <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>{children}</div>;
  }

  return (
    <>
      <Navbar />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
    </>
  );
}
