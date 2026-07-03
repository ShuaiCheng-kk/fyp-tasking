export const MIN_MANAGERS_PER_DAY = 1
export const MIN_EMPLOYEES_PER_DAY = 1

// Monday-start convention used throughout scheduling/attendance date-window logic. Local-time
// date arithmetic throughout (parse without 'Z', format back out via local getters rather than
// toISOString()) so the output date-key doesn't skew across a UTC day boundary on a non-UTC server.
export function weekStart(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`)
  const dow = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - dow)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function countRolesForGroup(
  items: Array<{ user_id?: string | null }>,
  usersById: Map<string, { role: string }>,
): { managers: number; employees: number } {
  const managers = new Set<string>()
  const employees = new Set<string>()
  for (const item of items) {
    if (!item.user_id) continue
    const role = usersById.get(item.user_id)?.role
    if (role === 'Manager') managers.add(item.user_id)
    if (role === 'Employee') employees.add(item.user_id)
  }
  return { managers: managers.size, employees: employees.size }
}
