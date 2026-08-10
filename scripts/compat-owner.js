/**
 * scripts/compat-owner.js - Compatibility check for the Owner role only.
 * Usage: npm run dev (in one terminal), then node scripts/compat-owner.js (in another).
 * See scripts/compat-lib.js for what this actually checks.
 */
const { runRole } = require('./compat-lib')

runRole({
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
})
