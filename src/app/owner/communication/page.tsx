'use client'

import OwnerSidebar from '@/components/OwnerSidebar'
import CommunicationView from '@/components/communication/CommunicationView'

export default function OwnerCommunicationPage() {
  return <CommunicationView renderSidebar={p => <OwnerSidebar {...p} />} basePath="/owner" />
}
