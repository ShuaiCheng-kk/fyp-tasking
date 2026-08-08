import { marketingService } from '@/services/marketing/marketingService';
import IndustriesPageClient from './IndustriesPageClient';

// Server-fetched so the first paint already has the real content — no client-side loading
// flash while `useMarketingCopy` would otherwise fetch after mount.
export default async function IndustriesPage() {
  const page = await marketingService.getPublicMarketingPage('industries');
  return <IndustriesPageClient initialPage={page} />;
}
