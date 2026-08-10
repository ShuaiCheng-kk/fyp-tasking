/**
 * scripts/compat-manager.js - Compatibility check for the Manager role only.
 * Usage: npm run dev (in one terminal), then node scripts/compat-manager.js (in another).
 * See scripts/compat-lib.js for what this actually checks.
 */
const { runRole } = require('./compat-lib')

runRole({
  role: 'manager',
  email: 'manager1@test.com',
  pages: [
    ['dashboard', '/manager/dashboard'],
    ['shifts', '/manager/shifts'],
    ['tasks', '/manager/tasks'],
    ['communication', '/manager/communication'],
    ['recruitment', '/manager/recruitment'],
  ],
})
