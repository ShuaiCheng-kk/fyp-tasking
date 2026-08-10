/**
 * scripts/compat-casual.js - Compatibility check for the Casual Worker role only.
 * Usage: npm run dev (in one terminal), then node scripts/compat-casual.js (in another).
 * See scripts/compat-lib.js for what this actually checks.
 */
const { runRole } = require('./compat-lib')

runRole({
  role: 'casual',
  email: 'casual1@test.com',
  pages: [
    ['dashboard', '/casual/dashboard'],
    ['attendance', '/casual/attendance'],
    ['applications', '/casual/applications'],
    ['profile', '/casual/profile'],
  ],
})
