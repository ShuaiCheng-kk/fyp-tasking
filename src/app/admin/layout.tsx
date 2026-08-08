import { redirect } from 'next/navigation'
import { getServerSessionUser } from '@/lib/serverAuth'

// Server-side gate for the Marketing Admin route group. Replaces the old client-side check that
// trusted a localStorage['tasking_user_role'] value (freely editable via devtools) with a real
// session-cookie check on the server, so a non-'Marketing Admin' session can never reach this
// shell — this is the URL-layer half of RBAC; each API route under /api/marketingadmin enforces
// the same check independently.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSessionUser()
  if (!session || session.user.role !== 'Marketing Admin') {
    redirect('/signin')
  }

  return <>{children}</>
}
