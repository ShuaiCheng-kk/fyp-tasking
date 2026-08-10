/**
 * scripts/compat-marketing-admin.js - Compatibility check for the Marketing Admin role only.
 * Usage: npm run dev (in one terminal), then node scripts/compat-marketing-admin.js (in another).
 * See scripts/compat-lib.js for what this actually checks.
 */
const { runRole } = require('./compat-lib')

runRole({
  role: 'marketing-admin',
  urlRole: 'admin', // Marketing Admin's actual route prefix is /admin/..., not /marketing-admin/...
  email: 'madmin@tasking.com',
  pages: [
    ['editor', '/admin/dashboard'],
    ['reviews', '/admin/reviews'],
  ],
})
