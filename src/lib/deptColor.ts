export const DEPT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#8B5CF6', // violet
  '#F97316', // orange
  '#06B6D4', // cyan
]

const colorOverrides = new Map<string, string>()

export function setDeptColorOverrides(departments: { id: string; color?: string | null }[]): void {
  colorOverrides.clear()
  for (const dept of departments) {
    if (dept.color) colorOverrides.set(dept.id, dept.color)
  }
}

export function deptColor(deptId: string): string {
  const override = colorOverrides.get(deptId)
  if (override) return override

  // djb2 hash → spread across palette using golden-ratio step to avoid adjacent collisions
  let h = 5381
  for (let i = 0; i < deptId.length; i++) h = ((h << 5) + h) ^ deptId.charCodeAt(i)
  const n = DEPT_COLORS.length
  const step = Math.round(n * 0.618) // golden ratio step — guarantees wide spread
  return DEPT_COLORS[((Math.abs(h) % n) * step) % n]
}
