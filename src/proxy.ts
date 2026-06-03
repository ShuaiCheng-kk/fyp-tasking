import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const ROLE_HOME: Record<string, string> = {
  Owner: '/owner/dashboard',
  Partner: '/partner/dashboard',
  Manager: '/manager/dashboard',
  Employee: '/employee/dashboard',
  'Casual Worker': '/casual/dashboard',
  'Guest User': '/job-board',
}

// Which roles are allowed on which prefix
const ROUTE_ROLES: { prefix: string; allowed: string[] }[] = [
  { prefix: '/owner', allowed: ['Owner'] },
  { prefix: '/partner', allowed: ['Partner'] },
  { prefix: '/manager', allowed: ['Manager'] },
  { prefix: '/employee', allowed: ['Employee'] },
  { prefix: '/casual', allowed: ['Casual Worker'] },
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const match = ROUTE_ROLES.find(r => pathname.startsWith(r.prefix))
  if (!match) return NextResponse.next()

  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (pathname === '/manager/removed' || pathname === '/employee/removed') return NextResponse.next()

  if (!session) {
    const url = request.nextUrl.clone()
    if (pathname.startsWith('/manager')) url.pathname = '/manager/removed'
    else if (pathname.startsWith('/employee')) url.pathname = '/employee/removed'
    else url.pathname = '/signin'
    return NextResponse.redirect(url)
  }

  // Fetch role from our API
  const apiUrl = new URL(`/api/user/me?user_id=${session.user.id}`, request.url)
  let role = ''
  try {
    const res = await fetch(apiUrl.toString(), { headers: { cookie: request.headers.get('cookie') ?? '' } })
    if (res.ok) {
      const data = await res.json()
      if (data.success) role = data.user?.role ?? ''
    }
  } catch {}

  if (!match.allowed.includes(role)) {
    const url = request.nextUrl.clone()
    if (!role && pathname.startsWith('/manager')) url.pathname = '/manager/removed'
    else if (!role && pathname.startsWith('/employee')) url.pathname = '/employee/removed'
    else url.pathname = ROLE_HOME[role] ?? '/signin'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/owner/:path*',
    '/partner/:path*',
    '/manager/:path*',
    '/employee/:path*',
    '/casual/:path*',
  ],
}
