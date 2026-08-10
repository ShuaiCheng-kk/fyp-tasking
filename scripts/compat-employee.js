/**
 * scripts/compat-employee.js - Compatibility check for the Employee role only.
 * Usage: npm run dev (in one terminal), then node scripts/compat-employee.js (in another).
 * See scripts/compat-lib.js for what this actually checks.
 */
const { runRole } = require('./compat-lib')

runRole({
  role: 'employee',
  email: 'employee1@test.com',
  pages: [
    ['dashboard', '/employee/dashboard'],
    ['shifts', '/employee/shifts'],
    ['tasks', '/employee/tasks'],
    ['communication', '/employee/communication'],
  ],
})
