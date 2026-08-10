/**
 * scripts/compat-user-admin.js - Compatibility check for the User Admin role only.
 * Usage: npm run dev (in one terminal), then node scripts/compat-user-admin.js (in another).
 * See scripts/compat-lib.js for what this actually checks.
 */
const { runRole } = require('./compat-lib')

runRole({
  role: 'user-admin',
  urlRole: 'useradmin', // User Admin's actual route prefix is /useradmin/..., not /user-admin/...
  email: 'uadmin@tasking.com',
  pages: [
    ['dashboard', '/useradmin/dashboard'],
    ['reports', '/useradmin/reports'],
    ['settings', '/useradmin/settings'],
  ],
})
