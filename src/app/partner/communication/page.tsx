'use client'

import PartnerSidebar from '@/components/PartnerSidebar'
import CommunicationView from '@/components/communication/CommunicationView'

export default function PartnerCommunicationPage() {
  return <CommunicationView renderSidebar={p => <PartnerSidebar {...p} />} basePath="/partner" />
}
