/**
 * scripts/compat-guest.js - Compatibility check for the Guest User role only.
 * Usage: npm run dev (in one terminal), then node scripts/compat-guest.js (in another).
 * See scripts/compat-lib.js for what this actually checks.
 */
const { runRole } = require('./compat-lib')

runRole({
  role: 'guest',
  email: 'guest1@test.com',
  pages: [
    ['applications', '/guest/applications'],
    ['profile', '/guest/profile'],
  ],
})
