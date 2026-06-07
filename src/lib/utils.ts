export function cn(...inputs: (string | undefined | null | false | Record<string, boolean>)[]): string {
  return inputs
    .flatMap(i => {
      if (!i) return []
      if (typeof i === 'string') return [i]
      return Object.entries(i).filter(([, v]) => v).map(([k]) => k)
    })
    .join(' ')
}
