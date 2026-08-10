/**
 * scripts/compatibility-test.js - Compatibility NFR verification, ALL roles back to back.
 *
 * Runs every role's compatibility check in sequence (see scripts/compat-lib.js for what each
 * check actually does, and scripts/compat-<role>.js to run just one role at a time - useful when
 * you want to review one role's screenshots without waiting for the full sweep).
 *
 * Usage:
 *   npm run dev                         # in one terminal
 *   node scripts/compatibility-test.js  # in another terminal
 *
 * Requires the database to be seeded (node scripts/seed.js) so the *@test.com / *@tasking.com
 * accounts exist.
 */

const { runRole } = require('./compat-lib')

const ROLES = [
  {
    role: 'owner',
    email: 'owner@test.com',
    pages: [
      ['dashboard', '/owner/dashboard'],
      ['shifts', '/owner/shifts'],
      ['tasks', '/owner/tasks'],
      ['team', '/owner/team'],
      ['communication', '/owner/communication'],
      ['recruitment', '/owner/recruitment'],
      ['attendance', '/owner/attendance'],
      ['report', '/owner/report'],
    ],
  },
  {
    role: 'partner',
    email: 'partner1@test.com',
    pages: [
      ['dashboard', '/partner/dashboard'],
      ['shifts', '/partner/shifts'],
      ['tasks', '/partner/tasks'],
      ['team', '/partner/team'],
      ['communication', '/partner/communication'],
      ['recruitment', '/partner/recruitment'],
      ['attendance', '/partner/attendance'],
      ['report', '/partner/report'],
    ],
  },
  {
    role: 'manager',
    email: 'manager1@test.com',
    pages: [
      ['dashboard', '/manager/dashboard'],
      ['shifts', '/manager/shifts'],
      ['tasks', '/manager/tasks'],
      ['communication', '/manager/communication'],
      ['recruitment', '/manager/recruitment'],
    ],
  },
  {
    role: 'employee',
    email: 'employee1@test.com',
    pages: [
      ['dashboard', '/employee/dashboard'],
      ['shifts', '/employee/shifts'],
      ['tasks', '/employee/tasks'],
      ['communication', '/employee/communication'],
    ],
  },
  {
    role: 'casual',
    email: 'casual1@test.com',
    pages: [
      ['dashboard', '/casual/dashboard'],
      ['attendance', '/casual/attendance'],
      ['applications', '/casual/applications'],
      ['profile', '/casual/profile'],
    ],
  },
  {
    role: 'guest',
    email: 'guest1@test.com',
    pages: [
      ['applications', '/guest/applications'],
      ['profile', '/guest/profile'],
    ],
  },
  {
    role: 'marketing-admin',
    urlRole: 'admin', // Marketing Admin's actual route prefix is /admin/..., not /marketing-admin/...
    email: 'madmin@tasking.com',
    pages: [
      ['editor', '/admin/dashboard'],
      ['reviews', '/admin/reviews'],
    ],
  },
  {
    role: 'user-admin',
    urlRole: 'useradmin', // User Admin's actual route prefix is /useradmin/..., not /user-admin/...
    email: 'uadmin@tasking.com',
    pages: [
      ['dashboard', '/useradmin/dashboard'],
      ['reports', '/useradmin/reports'],
      ['settings', '/useradmin/settings'],
    ],
  },
]

async function main() {
  const allResults = []
  for (const roleConfig of ROLES) {
    const results = await runRole(roleConfig)
    allResults.push(...results)
    console.log()
  }

  const failures = allResults.filter(r => !r.pass)
  console.log('='.repeat(60))
  console.log(
    failures.length === 0
      ? `RESULT (ALL ROLES): ALL PASS. ${allResults.length} role/page/viewport/browser combinations, zero page-level scroll detected.`
      : `RESULT (ALL ROLES): FAIL. ${failures.length}/${allResults.length} combinations had a page-level scrollbar.`
  )
}

main()
