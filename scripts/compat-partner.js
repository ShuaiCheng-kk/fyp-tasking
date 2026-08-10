/**
 * scripts/compat-partner.js - Compatibility check for the Partner role only.
 * Usage: npm run dev (in one terminal), then node scripts/compat-partner.js (in another).
 * See scripts/compat-lib.js for what this actually checks.
 */
const { runRole } = require('./compat-lib')

runRole({
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
})
