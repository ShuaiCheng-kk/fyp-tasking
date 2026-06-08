import { Page } from '@playwright/test'

export async function loginAsOwner(page: Page, targetPath = '/owner/dashboard') {
  // Sign in via the app's signin page
  await page.goto('/signin')
  await page.waitForLoadState('networkidle')

  await page.getByLabel('Email').fill('owner@test.com')
  await page.getByLabel('Password').fill('111111')

  const meResponsePromise = page.waitForResponse(
    r => r.url().includes('/api/user/me') && r.status() === 200,
    { timeout: 15000 }
  )
  await page.getByRole('button', { name: 'Sign In' }).click()
  await meResponsePromise

  await page.waitForURL('**/owner/dashboard', { timeout: 15000 })

  if (targetPath !== '/owner/dashboard') {
    // Register the response listener BEFORE goto so we never miss the response
    const apiPattern = getApiPattern(targetPath)
    let navResponsePromise: Promise<unknown> | null = null
    if (apiPattern) {
      navResponsePromise = page.waitForResponse(
        r => r.url().includes(apiPattern) && r.status() === 200,
        { timeout: 20000 }
      )
    }

    await page.goto(targetPath)
    await page.waitForLoadState('domcontentloaded')

    if (navResponsePromise) {
      await navResponsePromise.catch(() => {
        // Response may have already fired — page is loaded, continue
      })
    }

    // Give any remaining async renders a moment to settle
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  }
}

function getApiPattern(path: string): string | null {
  if (path.includes('/team')) return '/api/team/members'
  if (path.includes('/shift')) return '/api/shift'
  if (path.includes('/task')) return '/api/task'
  if (path.includes('/communication')) return '/api/inbox/announcements'
  if (path.includes('/recruitment')) return '/api/recruitment'
  if (path.includes('/attendance')) return '/api/attendance'
  if (path.includes('/settings')) return '/api/company'
  if (path.includes('/dashboard')) return '/api/company/current'
  return null
}

export async function loginViaAPI(page: Page): Promise<{ authId: string; companyId: string }> {
  const result = await page.request.post('/api/auth/signin', {
    data: { email_address: 'owner@test.com', password: '111111' },
  })
  const data = await result.json()
  const authId: string = data.user.auth_id
  const companyId: string = data.user.company_id ?? ''

  await page.evaluate(
    ({ authId, companyId, session }) => {
      localStorage.setItem('tasking_user_id', authId)
      localStorage.setItem('tasking_user_role', 'Owner')
      if (companyId) localStorage.setItem(`tasking_company_id_${authId}`, companyId)
      const key = `sb-qnpwuipwyidslxndgewg-auth-token`
      localStorage.setItem(key, JSON.stringify(session))
    },
    { authId, companyId, session: data.session }
  )

  return { authId, companyId }
}
