'use client'

import ManagerSidebar from '@/components/ManagerSidebar'
import CommunicationView from '@/components/communication/CommunicationView'

export default function ManagerCommunicationPage() {
  return <CommunicationView renderSidebar={p => <ManagerSidebar {...p} />} basePath="/manager" />
}
