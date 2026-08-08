import { redirect } from 'next/navigation'
import { getServerSessionUser } from '@/lib/serverAuth'

// Server-side gate for the User Admin route group. Runs on every request, using the session
// cookie (not a client-tampered localStorage value), so a non-'User Admin' session can never
// reach this shell — this is the URL-layer half of RBAC; each API route under /api/useradmin
// enforces the same check independently.
export default async function UserAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSessionUser()
  if (!session || session.user.role !== 'User Admin') {
    redirect('/signin')
  }

  return <>{children}</>
}
