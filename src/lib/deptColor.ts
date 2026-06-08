const DEPT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#8B5CF6', // violet
  '#F59E0B', // amber
  '#06B6D4', // cyan
  '#EC4899', // pink
  '#F97316', // orange
  '#EF4444', // red
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#84CC16', // lime
  '#A855F7', // purple
]

export function deptColor(deptId: string): string {
  // djb2 hash → spread across palette using golden-ratio step to avoid adjacent collisions
  let h = 5381
  for (let i = 0; i < deptId.length; i++) h = ((h << 5) + h) ^ deptId.charCodeAt(i)
  const n = DEPT_COLORS.length
  const step = Math.round(n * 0.618) // golden ratio step — guarantees wide spread
  return DEPT_COLORS[((Math.abs(h) % n) * step) % n]
}
